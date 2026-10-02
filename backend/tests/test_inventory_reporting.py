from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.product import Product
from app.models.purchase import VendorCredit
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.vendor import Vendor
from app.models.vendor_bill import VendorBill
from app.schemas.product import ProductCreate
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
)
from app.services.inventory_reporting_service import (
    get_inventory_activity,
    get_inventory_summary,
    get_product_inventory_detail,
    list_inventory_movements,
    list_inventory_products,
    list_purchasing_report,
    list_reconciliation_report,
    list_vendor_purchasing_insights,
)
from app.services.product_service import create_product
from app.services.purchase_service import (
    cancel_purchase_order,
    create_goods_receipt,
    create_purchase_order,
    create_purchase_return,
)
from app.services.stock_service import apply_stock_movement


TODAY = date.today()


def _product(db, user, sku, stock, threshold=5, buying="10.00", active=True):
    return create_product(
        ProductCreate(
            name=f"Inventory {sku}", sku=sku, barcode=f"BAR-{sku}", category="Inventory",
            buying_price=Decimal(buying), mrp=Decimal("20.00"), selling_price=Decimal("18.00"),
            stock_quantity=stock, low_stock_threshold=threshold, unit="pcs", is_active=active,
        ),
        user,
        db,
    )


def _vendor(db, user, name="Inventory Vendor"):
    vendor = Vendor(shop_id=user.shop_id, vendor_name=name, company_name=name, is_active=True)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def _po(
    db,
    user,
    vendor,
    product,
    quantity=10,
    status="ordered",
    order_date=TODAY,
    expected_date=None,
):
    return create_purchase_order(
        db,
        payload=PurchaseOrderCreate(
            vendor_id=vendor.id, order_date=order_date, expected_date=expected_date,
            status=status,
            items=[PurchaseOrderItemCreate(
                product_id=product.id, ordered_quantity=quantity, unit_cost=Decimal("8.00")
            )],
        ),
        current_user=user,
    )


def _receive(db, user, po, quantity, key):
    return create_goods_receipt(
        db,
        po_id=po.id,
        payload=GoodsReceiptCreate(
            client_request_id=key,
            received_date=TODAY,
            items=[GoodsReceiptItemCreate(
                purchase_order_item_id=po.items[0].id, received_quantity=quantity
            )],
        ),
        current_user=user,
    )


def test_inventory_summary_is_tenant_scoped_and_uses_current_cost(db_session, make_user):
    user = make_user(email="inventory-summary@example.com")
    other = make_user(email="inventory-summary-other@example.com")
    _product(db_session, user, "NORMAL", 10, threshold=5, buying="2.50")
    _product(db_session, user, "LOW", 3, threshold=5, buying="4.00")
    _product(db_session, user, "ZERO", 0, threshold=2, buying="100.00")
    _product(db_session, user, "INACTIVE", 99, threshold=100, buying="100.00", active=False)
    _product(db_session, other, "FOREIGN", 500, threshold=1000, buying="100.00")

    summary = get_inventory_summary(db_session, shop_id=user.shop_id)

    assert summary["active_products"] == 3
    assert summary["total_sellable_units"] == 13
    assert summary["low_stock_products"] == 1
    assert summary["out_of_stock_products"] == 1
    assert summary["current_inventory_value"] == Decimal("37.00")
    assert summary["reconciliation_mismatches"] == 0
    assert "buying price" in summary["valuation_basis"]


def test_low_stock_classification_search_and_pagination(db_session, make_user):
    user = make_user(email="inventory-low@example.com")
    low = _product(db_session, user, "LOW-FILTER", 2, threshold=4)
    _product(db_session, user, "OUT-FILTER", 0, threshold=4)
    _product(db_session, user, "NORMAL-FILTER", 8, threshold=4)

    result = list_inventory_products(
        db_session, shop_id=user.shop_id, stock_status="low_stock",
        search="BAR-LOW", page=1, page_size=1,
    )

    assert result["total"] == 1
    assert result["items"][0]["product_id"] == low.id
    assert result["items"][0]["stock_status"] == "low_stock"
    assert result["items"][0]["threshold_gap"] == 2
    assert result["page_size"] == 1


def test_incoming_stock_uses_unreceived_ordered_quantity(db_session, make_user):
    user = make_user(email="inventory-incoming@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "INCOMING", 2)
    po = _po(db_session, user, vendor, product, quantity=10)
    _receive(db_session, user, po, 4, "incoming-partial-receipt")

    item = list_inventory_products(
        db_session, shop_id=user.shop_id, search="INCOMING", page=1, page_size=10
    )["items"][0]

    assert item["stock_quantity"] == 6
    assert item["incoming_quantity"] == 6


def test_cancelled_and_received_pos_are_excluded_from_incoming(db_session, make_user):
    user = make_user(email="inventory-incoming-excluded@example.com")
    vendor = _vendor(db_session, user)
    cancelled_product = _product(db_session, user, "CANCELLED-INCOMING", 0)
    received_product = _product(db_session, user, "RECEIVED-INCOMING", 0)
    cancelled = _po(db_session, user, vendor, cancelled_product, quantity=5)
    cancel_purchase_order(db_session, po_id=cancelled.id, current_user=user)
    received = _po(db_session, user, vendor, received_product, quantity=5)
    _receive(db_session, user, received, 5, "full-receipt-incoming")

    rows = list_inventory_products(db_session, shop_id=user.shop_id, page=1, page_size=10)["items"]
    incoming = {row["sku"]: row["incoming_quantity"] for row in rows}
    assert incoming["CANCELLED-INCOMING"] == 0
    assert incoming["RECEIVED-INCOMING"] == 0


def test_movement_history_filters_and_human_readable_purchase_reference(db_session, make_user):
    user = make_user(email="inventory-movement@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "MOVE-REF", 0)
    po = _po(db_session, user, vendor, product, quantity=3)
    receipt = _receive(db_session, user, po, 3, "movement-reference-receipt")

    result = list_inventory_movements(
        db_session, shop_id=user.shop_id, search="MOVE-REF",
        movement_type=StockMovementType.PURCHASE_RECEIPT, direction="in",
        date_from=TODAY, date_to=TODAY, page=1, page_size=10,
    )

    assert result["total"] == 1
    assert receipt.receipt_number in result["items"][0]["reference_label"]
    assert po.purchase_order_number in result["items"][0]["reference_label"]
    assert result["items"][0]["reference_url"].startswith("/purchase-orders")
    assert result["items"][0]["actor_name"] == user.full_name


def test_movement_history_tenant_isolation(db_session, make_user):
    owner = make_user(email="movement-owner@example.com")
    other = make_user(email="movement-other@example.com")
    _product(db_session, owner, "OWNER-MOVE", 1)
    _product(db_session, other, "OTHER-MOVE", 1)
    result = list_inventory_movements(db_session, shop_id=owner.shop_id, page=1, page_size=100)
    assert {item["product_sku"] for item in result["items"]} == {"OWNER-MOVE"}


def test_reconciliation_mismatch_is_visible_and_not_repaired(db_session, make_user):
    user = make_user(email="reconciliation-report@example.com")
    product = _product(db_session, user, "RECON-VISIBLE", 5)
    product.stock_quantity = 7
    db_session.commit()

    result = list_reconciliation_report(
        db_session, shop_id=user.shop_id, mismatches_only=True, page=1, page_size=10
    )

    assert result["total"] == 1
    assert result["items"][0]["difference"] == 2
    db_session.refresh(product)
    assert product.stock_quantity == 7
    assert db_session.query(StockMovement).filter_by(product_id=product.id).count() == 1


def test_reconciliation_healthy_result(db_session, make_user):
    user = make_user(email="reconciliation-healthy@example.com")
    _product(db_session, user, "RECON-HEALTHY", 4)
    result = list_reconciliation_report(db_session, shop_id=user.shop_id, page=1, page_size=10)
    assert result["items"][0]["matches"] is True
    assert result["items"][0]["difference"] == 0


def test_inventory_activity_keeps_drafts_separate_from_sales(db_session, make_user):
    user = make_user(email="inventory-activity@example.com")
    product = _product(db_session, user, "ACTIVITY", 20)
    operations = [
        (StockMovementType.SALE, -2),
        (StockMovementType.SALE_RETURN, 1),
        (StockMovementType.PURCHASE_RECEIPT, 4),
        (StockMovementType.PURCHASE_RETURN, -1),
        (StockMovementType.ADJUSTMENT_IN, 3),
        (StockMovementType.ADJUSTMENT_OUT, -2),
        (StockMovementType.DRAFT_RESERVE, -5),
        (StockMovementType.DRAFT_RELEASE, 5),
    ]
    for index, (movement_type, delta) in enumerate(operations):
        apply_stock_movement(
            db_session, product=product, shop_id=user.shop_id, movement_type=movement_type,
            quantity_delta=delta, reference_type="test", reference_id=index, actor=user,
            client_request_id=f"activity-{index}",
        )
    db_session.commit()

    activity = get_inventory_activity(
        db_session, shop_id=user.shop_id, date_from=TODAY, date_to=TODAY
    )

    assert activity["units_sold"] == 2
    assert activity["customer_return_units_restocked"] == 1
    assert activity["purchase_units_received"] == 4
    assert activity["purchase_units_returned"] == 1
    assert activity["adjustment_in_units"] == 3
    assert activity["adjustment_out_units"] == 2
    assert activity["draft_reserved_units"] == 5
    assert activity["draft_released_units"] == 5


def test_purchasing_report_status_vendor_filter_and_return_metrics(db_session, make_user):
    user = make_user(email="purchasing-report@example.com")
    vendor = _vendor(db_session, user, "Report Vendor")
    other_vendor = _vendor(db_session, user, "Other Vendor")
    product = _product(db_session, user, "PO-REPORT", 0)
    po = _po(db_session, user, vendor, product, quantity=6)
    receipt = _receive(db_session, user, po, 4, "report-partial-receipt")
    create_purchase_return(
        db_session,
        po_id=po.id,
        payload=PurchaseReturnCreate(
            client_request_id="report-purchase-return",
            return_date=TODAY,
            reason="damaged",
            items=[PurchaseReturnItemCreate(
                goods_receipt_item_id=receipt.items[0].id, returned_quantity=1
            )],
        ),
        current_user=user,
    )
    _po(db_session, user, other_vendor, product, quantity=1)

    report = list_purchasing_report(
        db_session, shop_id=user.shop_id, vendor_id=vendor.id,
        status_filter="partially_received", page=1, page_size=10,
    )

    assert report["total"] == 1
    row = report["items"][0]
    assert (row["ordered_quantity"], row["received_quantity"], row["remaining_quantity"]) == (6, 4, 2)
    assert (row["purchase_return_quantity"], row["purchase_return_value"]) == (1, Decimal("8.00"))


def test_overdue_expected_receipt_flag(db_session, make_user):
    user = make_user(email="overdue-po-report@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "PO-OVERDUE", 0)
    _po(
        db_session,
        user,
        vendor,
        product,
        order_date=TODAY - timedelta(days=10),
        expected_date=TODAY - timedelta(days=1),
    )
    report = list_purchasing_report(db_session, shop_id=user.shop_id, page=1, page_size=10)
    assert report["items"][0]["overdue_expected_receipt"] is True


def test_vendor_purchasing_insights_keep_physical_and_financial_metrics_separate(db_session, make_user):
    user = make_user(email="vendor-insights@example.com")
    vendor = _vendor(db_session, user, "Insight Vendor")
    product = _product(db_session, user, "VENDOR-INSIGHT", 0)
    po = _po(db_session, user, vendor, product, quantity=5)
    receipt = _receive(db_session, user, po, 5, "vendor-insight-receipt")
    purchase_return = create_purchase_return(
        db_session,
        po_id=po.id,
        payload=PurchaseReturnCreate(
            client_request_id="vendor-insight-return", return_date=TODAY, reason="defective",
            items=[PurchaseReturnItemCreate(goods_receipt_item_id=receipt.items[0].id, returned_quantity=2)],
        ),
        current_user=user,
    )
    db_session.add(VendorBill(
        shop_id=user.shop_id, vendor_id=vendor.id, bill_number="INSIGHT-BILL",
        bill_date=TODAY, total_amount=Decimal("100.00"), paid_amount=Decimal("40.00"),
        remaining_amount=Decimal("60.00"), status="partial", reminder_days_before=7,
    ))
    db_session.commit()

    row = list_vendor_purchasing_insights(
        db_session, shop_id=user.shop_id, search="Insight", page=1, page_size=10
    )["items"][0]

    assert row["purchase_order_count"] == 1
    assert row["received_value"] == Decimal("40.00")
    assert row["purchase_return_value"] == purchase_return.total_amount == Decimal("16.00")
    assert row["outstanding_vendor_bills"] == Decimal("60.00")
    assert row["unapplied_vendor_credit"] == Decimal("16.00")


def test_product_inventory_detail_combines_operational_context(db_session, make_user):
    user = make_user(email="product-inventory-detail@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "DETAIL", 2)
    po = _po(db_session, user, vendor, product, quantity=4)
    _receive(db_session, user, po, 2, "detail-receipt")
    detail = get_product_inventory_detail(db_session, shop_id=user.shop_id, product_id=product.id)
    assert detail["product"]["stock_quantity"] == 4
    assert detail["product"]["incoming_quantity"] == 2
    assert detail["reconciliation"]["matches"] is True
    assert detail["recent_receipts"][0]["purchase_order_number"] == po.purchase_order_number
    assert detail["recent_movements"]


def test_inventory_csv_exports_are_tenant_scoped_and_respect_filters(
    db_session, client, make_user, auth_headers
):
    user = make_user(email="inventory-export@example.com")
    other = make_user(email="inventory-export-other@example.com")
    _product(db_session, user, "EXPORT-LOW", 1, threshold=5)
    _product(db_session, user, "EXPORT-NORMAL", 10, threshold=5)
    _product(db_session, other, "EXPORT-SECRET", 1, threshold=5)
    headers = auth_headers(user.email)

    response = client.get(
        "/api/v1/inventory/exports/low-stock?search=EXPORT", headers=headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "EXPORT-LOW" in response.text
    assert "EXPORT-NORMAL" not in response.text
    assert "EXPORT-SECRET" not in response.text
    assert "Current Inventory Value" in response.text


def test_movement_reconciliation_and_purchase_csv_exports(db_session, client, make_user, auth_headers):
    user = make_user(email="inventory-export-reports@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "EXPORT-REPORTS", 1)
    po = _po(db_session, user, vendor, product, quantity=2)
    headers = auth_headers(user.email)

    movement = client.get(
        "/api/v1/inventory/exports/movements?movement_type=opening_balance", headers=headers
    )
    reconciliation = client.get(
        "/api/v1/inventory/exports/reconciliation", headers=headers
    )
    purchasing = client.get(
        f"/api/v1/inventory/exports/purchase-orders?vendor_id={vendor.id}", headers=headers
    )

    assert movement.status_code == reconciliation.status_code == purchasing.status_code == 200
    assert "Opening" not in movement.text  # raw type remains machine-stable
    assert "opening_balance" in movement.text
    assert "Matched" in reconciliation.text
    assert po.purchase_order_number in purchasing.text
