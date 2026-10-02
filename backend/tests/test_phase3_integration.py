import csv
import io
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.purchase import VendorCredit
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.vendor import Vendor
from app.schemas.invoice import InvoiceCreate, InvoiceReturnCreate
from app.schemas.product import ProductCreate
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
)
from app.schemas.stock import StockAdjustmentCreate
from app.schemas.vendor import VendorBillCreate, VendorBillPaymentCreate
from app.services.inventory_reporting_service import (
    get_inventory_activity,
    get_inventory_summary,
    list_vendor_purchasing_insights,
)
from app.services.invoice_service import create_invoice, create_invoice_return
from app.services.product_service import create_product
from app.services.purchase_service import (
    create_goods_receipt,
    create_purchase_order,
    create_purchase_return,
)
from app.services.stock_service import create_stock_adjustment, reconcile_stock_balances
from app.services.vendor_service import add_bill_payment, create_vendor_bill


TODAY = date.today()


def _product(db, user, *, sku: str, stock: int, name: str | None = None):
    return create_product(
        ProductCreate(
            name=name or f"Integrated {sku}",
            sku=sku,
            category="Integration",
            buying_price=Decimal("40.00"),
            mrp=Decimal("100.00"),
            selling_price=Decimal("100.00"),
            stock_quantity=stock,
            low_stock_threshold=2,
            unit="pcs",
        ),
        user,
        db,
    )


def _vendor(db, user, name="Integrated Vendor"):
    vendor = Vendor(
        shop_id=user.shop_id,
        vendor_name=name,
        company_name=name,
        is_active=True,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def _invoice_payload(product, *, key: str, quantity: int):
    return InvoiceCreate.model_validate(
        {
            "client_request_id": key,
            "customer": {
                "first_name": "Phase Three",
                "last_name": "Customer",
                "phone": "9000093000",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": TODAY,
            "payment_status": "pending",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _po(db, user, vendor, product, *, quantity: int, cost="40.00"):
    return create_purchase_order(
        db,
        payload=PurchaseOrderCreate(
            vendor_id=vendor.id,
            order_date=TODAY,
            status="ordered",
            items=[
                PurchaseOrderItemCreate(
                    product_id=product.id,
                    ordered_quantity=quantity,
                    unit_cost=Decimal(cost),
                )
            ],
        ),
        current_user=user,
    )


def _receipt(db, user, po, *, quantity: int, key: str):
    payload = GoodsReceiptCreate(
        client_request_id=key,
        received_date=TODAY,
        items=[
            GoodsReceiptItemCreate(
                purchase_order_item_id=po.items[0].id,
                received_quantity=quantity,
            )
        ],
    )
    return create_goods_receipt(db, po_id=po.id, payload=payload, current_user=user), payload


def _purchase_return(db, user, po, receipt, *, quantity: int, key: str):
    payload = PurchaseReturnCreate(
        client_request_id=key,
        return_date=TODAY,
        reason="defective",
        items=[
            PurchaseReturnItemCreate(
                goods_receipt_item_id=receipt.items[0].id,
                returned_quantity=quantity,
            )
        ],
    )
    return create_purchase_return(db, po_id=po.id, payload=payload, current_user=user), payload


def _assert_reconciled(db, user, product, expected):
    db.refresh(product)
    assert product.stock_quantity == expected
    ledger = sum(
        movement.quantity_delta
        for movement in db.query(StockMovement).filter(StockMovement.product_id == product.id)
    )
    assert ledger == expected
    assert reconcile_stock_balances(db, shop_id=user.shop_id)["mismatch_count"] == 0


def test_complete_inventory_lifecycle_preserves_ledger_and_reports(db_session, make_user):
    user = make_user(email="phase3-lifecycle@example.com")
    product = _product(db_session, user, sku="P3-LIFE", stock=10)
    vendor = _vendor(db_session, user)

    invoice_payload = _invoice_payload(product, key="p3-sale-request", quantity=3)
    invoice = create_invoice(invoice_payload, db_session, user)
    replayed_invoice = create_invoice(invoice_payload, db_session, user)
    assert replayed_invoice.id == invoice.id
    _assert_reconciled(db_session, user, product, 7)

    customer_return = create_invoice_return(
        invoice.id,
        InvoiceReturnCreate.model_validate(
            {
                "client_request_id": "p3-customer-return",
                "reason": "Restocked customer return",
                "items": [
                    {
                        "invoice_item_id": invoice.items[0].id,
                        "quantity": 1,
                        "restocked_quantity": 1,
                        "disposition": "restock",
                    }
                ],
            }
        ),
        db_session,
        user,
    )
    assert customer_return.items[0].quantity == Decimal("1.00")
    _assert_reconciled(db_session, user, product, 8)

    create_stock_adjustment(
        db_session,
        product_id=product.id,
        payload=StockAdjustmentCreate(
            client_request_id="p3-adjust-out",
            direction="out",
            quantity=1,
            reason="damaged",
        ),
        current_user=user,
    )
    _assert_reconciled(db_session, user, product, 7)

    po = _po(db_session, user, vendor, product, quantity=5)
    _assert_reconciled(db_session, user, product, 7)
    receipt, receipt_payload = _receipt(
        db_session, user, po, quantity=5, key="p3-receipt"
    )
    replayed_receipt = create_goods_receipt(
        db_session, po_id=po.id, payload=receipt_payload, current_user=user
    )
    assert replayed_receipt.id == receipt.id
    _assert_reconciled(db_session, user, product, 12)

    purchase_return, return_payload = _purchase_return(
        db_session, user, po, receipt, quantity=2, key="p3-purchase-return"
    )
    replayed_return = create_purchase_return(
        db_session, po_id=po.id, payload=return_payload, current_user=user
    )
    assert replayed_return.id == purchase_return.id
    _assert_reconciled(db_session, user, product, 10)

    deltas = [
        movement.quantity_delta
        for movement in db_session.query(StockMovement)
        .filter(StockMovement.product_id == product.id)
        .order_by(StockMovement.id)
    ]
    assert deltas == [10, -3, 1, -1, 5, -2]
    assert db_session.query(VendorCredit).filter_by(
        purchase_return_id=purchase_return.id,
        status="unapplied",
    ).one().amount == Decimal("80.00")

    summary = get_inventory_summary(db_session, shop_id=user.shop_id)
    activity = get_inventory_activity(
        db_session,
        shop_id=user.shop_id,
        date_from=TODAY,
        date_to=TODAY,
    )
    assert summary["total_sellable_units"] == 10
    assert summary["current_inventory_value"] == Decimal("400.00")
    assert summary["unapplied_vendor_credit"] == Decimal("80.00")
    assert activity["units_sold"] == 3
    assert activity["customer_return_units_restocked"] == 1
    assert activity["purchase_units_received"] == 5
    assert activity["purchase_units_returned"] == 2


def test_receipt_sale_purchase_return_uses_current_sellable_stock(
    db_session, make_user
):
    user = make_user(email="phase3-availability@example.com")
    product = _product(db_session, user, sku="P3-AVAILABLE", stock=0)
    vendor = _vendor(db_session, user, "Availability Vendor")
    po = _po(db_session, user, vendor, product, quantity=10)
    receipt, _ = _receipt(db_session, user, po, quantity=10, key="available-receipt")
    create_invoice(
        _invoice_payload(product, key="available-sale", quantity=8),
        db_session,
        user,
    )
    _assert_reconciled(db_session, user, product, 2)

    with pytest.raises(HTTPException, match="sellable stock"):
        _purchase_return(
            db_session,
            user,
            po,
            receipt,
            quantity=5,
            key="unavailable-purchase-return",
        )
    db_session.rollback()
    _assert_reconciled(db_session, user, product, 2)

    _purchase_return(
        db_session,
        user,
        po,
        receipt,
        quantity=2,
        key="available-purchase-return",
    )
    _assert_reconciled(db_session, user, product, 0)


def test_vendor_financial_activity_does_not_mutate_inventory(
    db_session, make_user
):
    user = make_user(email="phase3-financial-separation@example.com")
    product = _product(db_session, user, sku="P3-FINANCE", stock=4)
    vendor = _vendor(db_session, user, "Financial Vendor")
    stock_before = product.stock_quantity
    movement_count = db_session.query(StockMovement).filter_by(product_id=product.id).count()

    bill = create_vendor_bill(
        vendor.id,
        VendorBillCreate(
            bill_number="P3-BILL-1",
            bill_date=TODAY,
            total_amount=Decimal("1000.00"),
            paid_amount=Decimal("0.00"),
        ),
        db_session,
        user,
    )
    payment_payload = VendorBillPaymentCreate(
        client_request_id="p3-vendor-payment",
        payment_date=TODAY,
        amount=Decimal("400.00"),
        payment_mode="upi",
    )
    payment = add_bill_payment(bill.id, payment_payload, db_session, user)
    replayed = add_bill_payment(bill.id, payment_payload, db_session, user)
    assert replayed.id == payment.id

    db_session.refresh(product)
    db_session.refresh(bill)
    assert product.stock_quantity == stock_before
    assert db_session.query(StockMovement).filter_by(product_id=product.id).count() == movement_count
    assert (bill.paid_amount, bill.remaining_amount, bill.status) == (
        Decimal("400.00"),
        Decimal("600.00"),
        "partial",
    )
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.VENDOR_PAYMENT_CREATED,
        entity_id=payment.id,
    ).count() == 1
    insight = list_vendor_purchasing_insights(
        db_session,
        shop_id=user.shop_id,
        search="Financial Vendor",
        page=1,
        page_size=10,
    )["items"][0]
    assert insight["outstanding_vendor_bills"] == Decimal("600.00")
    assert insight["received_value"] == Decimal("0.00")


def test_inventory_csv_escapes_business_text_without_internal_fields(
    db_session, client, make_user, auth_headers
):
    user = make_user(email="phase3-csv@example.com")
    product = _product(
        db_session,
        user,
        sku="P3-CSV",
        stock=3,
        name='Quoted, "Inventory" Product',
    )

    response = client.get(
        "/api/v1/inventory/exports/inventory?search=P3-CSV",
        headers=auth_headers(user.email),
    )
    assert response.status_code == 200
    rows = list(csv.reader(io.StringIO(response.text.lstrip("\ufeff"))))
    assert rows[1][0] == product.name
    assert rows[1][1] == "P3-CSV"
    assert "request_fingerprint" not in response.text
    assert "client_request_id" not in response.text
