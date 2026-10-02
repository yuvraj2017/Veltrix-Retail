from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.purchase import GoodsReceipt, GoodsReceiptItem, PurchaseOrder
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.vendor import Vendor
from app.schemas.product import ProductCreate
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderUpdate,
)
from app.services.product_service import create_product
from app.services.purchase_service import (
    cancel_purchase_order,
    create_goods_receipt,
    create_purchase_order,
    list_goods_receipts,
    update_purchase_order,
)
from app.services.stock_service import reconcile_stock_balances


ORDER_DATE = date(2026, 10, 2)


def _vendor(db, user, *, name="Supply Partner", active=True):
    vendor = Vendor(
        shop_id=user.shop_id,
        vendor_name=name,
        company_name=name,
        is_active=active,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def _product(db, user, *, sku: str, stock=5, active=True):
    product = create_product(
        ProductCreate(
            name=f"Purchase {sku}",
            sku=sku,
            category="General",
            buying_price=Decimal("40.00"),
            mrp=Decimal("80.00"),
            selling_price=Decimal("70.00"),
            stock_quantity=stock,
            unit="pcs",
            is_active=active,
        ),
        user,
        db,
    )
    return product


def _po_payload(vendor, items, *, status="ordered", tax="0.00"):
    return PurchaseOrderCreate(
        vendor_id=vendor.id,
        order_date=ORDER_DATE,
        expected_date=date(2026, 10, 9),
        status=status,
        tax_amount=Decimal(tax),
        notes="Restock order",
        items=[
            PurchaseOrderItemCreate(
                product_id=product.id,
                ordered_quantity=quantity,
                unit_cost=Decimal(cost),
            )
            for product, quantity, cost in items
        ],
    )


def _receipt(po, quantities, *, key="receipt-request-key", notes=None):
    by_product = {item.product_id: item for item in po.items}
    return GoodsReceiptCreate(
        client_request_id=key,
        received_date=ORDER_DATE,
        notes=notes,
        items=[
            GoodsReceiptItemCreate(
                purchase_order_item_id=by_product[product_id].id,
                received_quantity=quantity,
                unit_cost=Decimal(cost) if cost is not None else None,
            )
            for product_id, quantity, cost in quantities
        ],
    )


def test_create_po_calculates_totals_and_does_not_change_stock(db_session, make_user):
    user = make_user(email="po-create@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-CREATE", stock=7)

    po = create_purchase_order(
        db_session,
        payload=_po_payload(vendor, [(product, 4, "12.35")], status="draft", tax="5.00"),
        current_user=user,
    )

    db_session.refresh(product)
    assert po.purchase_order_number == "PO-20261002-001"
    assert po.status == "draft"
    assert (po.subtotal, po.tax_amount, po.total_amount) == (
        Decimal("49.40"),
        Decimal("5.00"),
        Decimal("54.40"),
    )
    assert product.stock_quantity == 7
    assert not any(row.movement_type == StockMovementType.PURCHASE_RECEIPT for row in db_session.query(StockMovement))
    assert db_session.query(BusinessAuditLog).filter_by(action=BusinessAuditAction.PURCHASE_ORDER_CREATED).count() == 1


def test_po_number_sequence_is_per_shop_and_day(db_session, make_user):
    user_a = make_user(email="po-number-a@example.com")
    user_b = make_user(email="po-number-b@example.com")
    vendor_a = _vendor(db_session, user_a, name="A")
    vendor_b = _vendor(db_session, user_b, name="B")
    product_a = _product(db_session, user_a, sku="NUM-A")
    product_b = _product(db_session, user_b, sku="NUM-B")

    first = create_purchase_order(
        db_session, payload=_po_payload(vendor_a, [(product_a, 1, "10")]), current_user=user_a
    )
    second = create_purchase_order(
        db_session, payload=_po_payload(vendor_a, [(product_a, 1, "10")]), current_user=user_a
    )
    other_shop = create_purchase_order(
        db_session, payload=_po_payload(vendor_b, [(product_b, 1, "10")]), current_user=user_b
    )

    assert [first.purchase_order_number, second.purchase_order_number] == [
        "PO-20261002-001",
        "PO-20261002-002",
    ]
    assert other_shop.purchase_order_number == "PO-20261002-001"


@pytest.mark.parametrize("foreign_kind", ["vendor", "product"])
def test_po_creation_validates_tenant_vendor_and_products(db_session, make_user, foreign_kind):
    user_a = make_user(email=f"po-tenant-a-{foreign_kind}@example.com")
    user_b = make_user(email=f"po-tenant-b-{foreign_kind}@example.com")
    vendor_a = _vendor(db_session, user_a, name="Vendor A")
    vendor_b = _vendor(db_session, user_b, name="Vendor B")
    product_a = _product(db_session, user_a, sku=f"LOCAL-{foreign_kind}")
    product_b = _product(db_session, user_b, sku=f"FOREIGN-{foreign_kind}")
    vendor = vendor_b if foreign_kind == "vendor" else vendor_a
    product = product_a if foreign_kind == "vendor" else product_b

    with pytest.raises(HTTPException) as exc:
        create_purchase_order(
            db_session,
            payload=_po_payload(vendor, [(product, 1, "10")]),
            current_user=user_a,
        )
    assert exc.value.status_code == 404


def test_inactive_vendor_and_product_are_rejected(db_session, make_user):
    user = make_user(email="po-inactive@example.com")
    inactive_vendor = _vendor(db_session, user, name="Inactive", active=False)
    active_vendor = _vendor(db_session, user, name="Active")
    active_product = _product(db_session, user, sku="ACTIVE")
    inactive_product = _product(db_session, user, sku="INACTIVE", active=False)

    with pytest.raises(HTTPException) as vendor_error:
        create_purchase_order(
            db_session,
            payload=_po_payload(inactive_vendor, [(active_product, 1, "10")]),
            current_user=user,
        )
    assert vendor_error.value.status_code == 409
    db_session.rollback()

    with pytest.raises(HTTPException) as product_error:
        create_purchase_order(
            db_session,
            payload=_po_payload(active_vendor, [(inactive_product, 1, "10")]),
            current_user=user,
        )
    assert product_error.value.status_code == 409


def test_draft_po_can_be_edited_then_ordered_but_not_changed_afterward(db_session, make_user):
    user = make_user(email="po-edit@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-EDIT")
    po = create_purchase_order(
        db_session,
        payload=_po_payload(vendor, [(product, 2, "10")], status="draft"),
        current_user=user,
    )

    updated = update_purchase_order(
        db_session,
        po_id=po.id,
        payload=PurchaseOrderUpdate(
            status="ordered",
            tax_amount=Decimal("2.00"),
            items=[PurchaseOrderItemCreate(product_id=product.id, ordered_quantity=3, unit_cost=Decimal("11"))],
        ),
        current_user=user,
    )
    assert (updated.status, updated.items[0].ordered_quantity, updated.total_amount) == (
        "ordered",
        3,
        Decimal("35.00"),
    )
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.PURCHASE_ORDER_UPDATED, entity_id=po.id
    ).count() == 1

    with pytest.raises(HTTPException) as exc:
        update_purchase_order(
            db_session,
            po_id=po.id,
            payload=PurchaseOrderUpdate(notes="Unsafe rewrite"),
            current_user=user,
        )
    assert exc.value.status_code == 409


def test_partial_then_full_multiple_receipts_update_stock_and_reconcile(db_session, make_user):
    user = make_user(email="po-partial@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-PARTIAL", stock=5)
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 10, "9")]), current_user=user
    )

    first = create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 4, None)], key="partial-receipt-one"),
        current_user=user,
    )
    db_session.refresh(po)
    assert first.receipt_number == "GR-20261002-001-001"
    assert po.status == "partially_received"
    assert po.items[0].received_quantity == 4

    second = create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 6, "9.50")], key="partial-receipt-two"),
        current_user=user,
    )
    db_session.refresh(po)
    db_session.refresh(product)
    assert second.receipt_number == "GR-20261002-001-002"
    assert second.items[0].unit_cost == Decimal("9.50")
    assert po.status == "received"
    assert po.items[0].received_quantity == 10
    assert product.stock_quantity == 15
    assert product.buying_price == Decimal("40.00")
    assert len(list_goods_receipts(db_session, po_id=po.id, current_user=user)) == 2
    movements = db_session.query(StockMovement).filter_by(
        product_id=product.id, movement_type=StockMovementType.PURCHASE_RECEIPT
    ).all()
    assert [movement.quantity_delta for movement in movements] == [4, 6]
    assert reconcile_stock_balances(db_session, shop_id=user.shop_id)["mismatch_count"] == 0


def test_multi_product_partial_receipt_keeps_po_partial(db_session, make_user):
    user = make_user(email="po-multi@example.com")
    vendor = _vendor(db_session, user)
    product_a = _product(db_session, user, sku="MULTI-A", stock=0)
    product_b = _product(db_session, user, sku="MULTI-B", stock=1)
    po = create_purchase_order(
        db_session,
        payload=_po_payload(vendor, [(product_a, 10, "5"), (product_b, 5, "6")]),
        current_user=user,
    )

    create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(
            po,
            [(product_a.id, 10, None), (product_b.id, 2, None)],
            key="multi-product-receipt",
        ),
        current_user=user,
    )

    db_session.refresh(po)
    db_session.refresh(product_a)
    db_session.refresh(product_b)
    assert po.status == "partially_received"
    assert {item.product_id: item.received_quantity for item in po.items} == {
        product_a.id: 10,
        product_b.id: 2,
    }
    assert (product_a.stock_quantity, product_b.stock_quantity) == (10, 3)


def test_over_receipt_is_rejected_atomically(db_session, make_user):
    user = make_user(email="po-over@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-OVER", stock=2)
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 10, "5")]), current_user=user
    )
    create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 8, None)], key="over-first-receipt"),
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(po, [(product.id, 3, None)], key="over-second-receipt"),
            current_user=user,
        )
    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product)
    assert product.stock_quantity == 10
    assert db_session.query(GoodsReceipt).filter_by(purchase_order_id=po.id).count() == 1


def test_multi_product_receipt_failure_rolls_back_all_stock(db_session, make_user):
    user = make_user(email="po-atomic@example.com")
    vendor = _vendor(db_session, user)
    product_a = _product(db_session, user, sku="ATOMIC-A", stock=2)
    product_b = _product(db_session, user, sku="ATOMIC-B", stock=3)
    po = create_purchase_order(
        db_session,
        payload=_po_payload(vendor, [(product_a, 2, "5"), (product_b, 2, "6")]),
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(
                po,
                [(product_a.id, 1, None), (product_b.id, 3, None)],
                key="atomic-failed-receipt",
            ),
            current_user=user,
        )
    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product_a)
    db_session.refresh(product_b)
    assert (product_a.stock_quantity, product_b.stock_quantity) == (2, 3)
    assert db_session.query(GoodsReceipt).filter_by(purchase_order_id=po.id).count() == 0


def test_receipt_retry_is_idempotent_and_payload_change_conflicts(db_session, make_user):
    user = make_user(email="receipt-retry@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="RECEIPT-RETRY", stock=3)
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 5, "8")]), current_user=user
    )
    payload = _receipt(po, [(product.id, 2, None)], key="same-receipt-request")

    first = create_goods_receipt(
        db_session, po_id=po.id, payload=payload, current_user=user
    )
    replay = create_goods_receipt(
        db_session, po_id=po.id, payload=payload, current_user=user
    )
    assert replay.id == first.id
    db_session.refresh(product)
    assert product.stock_quantity == 5
    assert db_session.query(GoodsReceipt).filter_by(purchase_order_id=po.id).count() == 1
    assert db_session.query(GoodsReceiptItem).filter_by(goods_receipt_id=first.id).count() == 1
    assert db_session.query(StockMovement).filter_by(
        movement_type=StockMovementType.PURCHASE_RECEIPT, reference_id=first.id
    ).count() == 1
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.GOODS_RECEIPT_CREATED, entity_id=first.id
    ).count() == 1

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(po, [(product.id, 3, None)], key="same-receipt-request"),
            current_user=user,
        )
    assert exc.value.status_code == 409


def test_final_remaining_quantity_can_only_be_consumed_once(db_session, make_user):
    user = make_user(email="receipt-final@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="FINAL-REMAIN", stock=0)
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 2, "8")]), current_user=user
    )
    create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 2, None)], key="final-first-request"),
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(po, [(product.id, 2, None)], key="final-second-request"),
            current_user=user,
        )
    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product)
    assert product.stock_quantity == 2


def test_cancel_before_receiving_is_stock_neutral_and_idempotent(db_session, make_user):
    user = make_user(email="po-cancel@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-CANCEL", stock=4)
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 2, "8")]), current_user=user
    )

    first = cancel_purchase_order(db_session, po_id=po.id, current_user=user)
    replay = cancel_purchase_order(db_session, po_id=po.id, current_user=user)
    assert first.status == replay.status == "cancelled"
    db_session.refresh(product)
    assert product.stock_quantity == 4
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.PURCHASE_ORDER_CANCELLED, entity_id=po.id
    ).count() == 1

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(po, [(product.id, 1, None)], key="cancelled-receipt"),
            current_user=user,
        )
    assert exc.value.status_code == 409


def test_cancellation_after_receiving_is_blocked(db_session, make_user):
    user = make_user(email="po-cancel-received@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="PO-CANCEL-RECEIVED")
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 2, "8")]), current_user=user
    )
    create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 1, None)], key="received-before-cancel"),
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        cancel_purchase_order(db_session, po_id=po.id, current_user=user)
    assert exc.value.status_code == 409


def test_receipts_are_immutable_api_resources_and_tenant_scoped(
    db_session, make_user, client, auth_headers
):
    user_a = make_user(email="receipt-tenant-a@example.com")
    user_b = make_user(email="receipt-tenant-b@example.com")
    vendor = _vendor(db_session, user_a)
    product = _product(db_session, user_a, sku="RECEIPT-TENANT")
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 2, "8")]), current_user=user_a
    )
    receipt = create_goods_receipt(
        db_session,
        po_id=po.id,
        payload=_receipt(po, [(product.id, 1, None)], key="tenant-receipt-key"),
        current_user=user_a,
    )
    headers_b = auth_headers(user_b.email)

    assert client.get(f"/api/v1/purchase-orders/{po.id}", headers=headers_b).status_code == 404
    assert client.get(f"/api/v1/purchase-orders/{po.id}/receipts", headers=headers_b).status_code == 404
    assert client.put(
        f"/api/v1/purchase-orders/{po.id}/receipts/{receipt.id}", headers=headers_b, json={}
    ).status_code in {404, 405}
    assert client.delete(
        f"/api/v1/purchase-orders/{po.id}/receipts/{receipt.id}", headers=headers_b
    ).status_code in {404, 405}


def test_inactive_product_cannot_be_received_after_ordering(db_session, make_user):
    user = make_user(email="receipt-inactive@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, sku="RECEIPT-INACTIVE")
    po = create_purchase_order(
        db_session, payload=_po_payload(vendor, [(product, 2, "8")]), current_user=user
    )
    product.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_goods_receipt(
            db_session,
            po_id=po.id,
            payload=_receipt(po, [(product.id, 1, None)], key="inactive-receipt-key"),
            current_user=user,
        )
    assert exc.value.status_code == 409
