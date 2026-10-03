from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.purchase import PurchaseReturn, PurchaseReturnItem, VendorCredit
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.vendor import Vendor
from app.models.vendor_bill import VendorBill
from app.models.vendor_bill_payment import VendorBillPayment
from app.schemas.product import ProductCreate
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
)
from app.schemas.vendor import VendorBillCreate, VendorBillPaymentCreate, VendorBillUpdate
from app.services.product_service import create_product
from app.services.purchase_service import (
    create_goods_receipt,
    create_purchase_order,
    create_purchase_return,
    get_purchase_return_eligibility,
    list_purchase_returns,
)
from app.services.stock_service import apply_stock_movement, reconcile_stock_balances
from app.services.vendor_service import (
    add_bill_payment,
    create_vendor_bill,
    delete_vendor,
    list_bill_payments,
    update_vendor_bill,
)


TODAY = date(2026, 10, 3)


def _vendor(db, user, name="Return Vendor"):
    row = Vendor(shop_id=user.shop_id, vendor_name=name, company_name=name, is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _product(db, user, sku, stock=2):
    return create_product(
        ProductCreate(
            name=f"Return {sku}", sku=sku, category="General",
            buying_price=Decimal("25.00"), mrp=Decimal("50.00"),
            selling_price=Decimal("45.00"), stock_quantity=stock,
            unit="pcs", is_active=True,
        ),
        user,
        db,
    )


def _received_po(db, user, vendor, products, quantities=None):
    quantities = quantities or [5] * len(products)
    po = create_purchase_order(
        db,
        payload=PurchaseOrderCreate(
            vendor_id=vendor.id,
            order_date=TODAY,
            status="ordered",
            items=[
                PurchaseOrderItemCreate(
                    product_id=product.id, ordered_quantity=quantity, unit_cost=Decimal("20.00")
                )
                for product, quantity in zip(products, quantities)
            ],
        ),
        current_user=user,
    )
    receipt = create_goods_receipt(
        db,
        po_id=po.id,
        payload=GoodsReceiptCreate(
            client_request_id=f"receipt-{po.id}-request",
            received_date=TODAY,
            items=[
                GoodsReceiptItemCreate(
                    purchase_order_item_id=item.id,
                    received_quantity=item.ordered_quantity,
                )
                for item in po.items
            ],
        ),
        current_user=user,
    )
    return po, receipt


def _return_payload(receipt, quantities, key="purchase-return-key", reason="damaged", notes=None):
    return PurchaseReturnCreate(
        client_request_id=key,
        return_date=TODAY,
        reason=reason,
        notes=notes,
        items=[
            PurchaseReturnItemCreate(
                goods_receipt_item_id=item.id,
                returned_quantity=quantity,
            )
            for item, quantity in zip(receipt.items, quantities)
        ],
    )


def _bill_payload(number="BILL-1", total="1000.00", paid="0.00"):
    return VendorBillCreate(
        bill_number=number,
        bill_date=TODAY,
        total_amount=Decimal(total),
        paid_amount=Decimal(paid),
        payment_mode="cash" if Decimal(paid) else None,
    )


def _payment(key, amount, method="cash"):
    return VendorBillPaymentCreate(
        client_request_id=key,
        payment_date=TODAY,
        amount=Decimal(amount),
        payment_mode=method,
    )


def _legacy_bill(
    db,
    user,
    vendor,
    *,
    number,
    total,
    paid,
    remaining,
    status="partial",
    payment_mode="cash",
    payment_reference=None,
):
    bill = VendorBill(
        shop_id=user.shop_id,
        vendor_id=vendor.id,
        bill_number=number,
        bill_date=TODAY,
        total_amount=Decimal(total),
        paid_amount=Decimal(paid),
        remaining_amount=Decimal(remaining),
        status=status,
        payment_mode=payment_mode,
        payment_reference=payment_reference,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def test_purchase_return_reduces_stock_creates_movement_credit_and_audit(db_session, make_user):
    user = make_user(email="purchase-return@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "PR-ONE", stock=2)
    po, receipt = _received_po(db_session, user, vendor, [product])

    result = create_purchase_return(
        db_session, po_id=po.id, payload=_return_payload(receipt, [2]), current_user=user
    )

    db_session.refresh(product)
    assert result.return_number == "PR-20261003-001"
    assert result.total_amount == Decimal("40.00")
    assert product.stock_quantity == 5
    movement = db_session.query(StockMovement).filter_by(
        movement_type=StockMovementType.PURCHASE_RETURN, reference_id=result.id
    ).one()
    assert (movement.quantity_delta, movement.quantity_before, movement.quantity_after) == (-2, 7, 5)
    assert db_session.query(VendorCredit).filter_by(purchase_return_id=result.id).one().amount == Decimal("40.00")
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.PURCHASE_RETURN_CREATED, entity_id=result.id
    ).count() == 1
    reconciliation = reconcile_stock_balances(db_session, shop_id=user.shop_id)
    assert reconciliation["mismatch_count"] == 0


def test_partial_multiple_returns_preserve_received_history(db_session, make_user):
    user = make_user(email="multiple-returns@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "PR-MULTI", stock=1)
    po, receipt = _received_po(db_session, user, vendor, [product], [10])
    received_before = receipt.items[0].received_quantity

    first = create_purchase_return(
        db_session, po_id=po.id, payload=_return_payload(receipt, [2], key="return-first"), current_user=user
    )
    second = create_purchase_return(
        db_session, po_id=po.id, payload=_return_payload(receipt, [3], key="return-second"), current_user=user
    )

    db_session.refresh(receipt.items[0])
    db_session.refresh(po)
    assert receipt.items[0].received_quantity == received_before == 10
    assert po.status == "received"
    assert sum(row.items[0].returned_quantity for row in [first, second]) == 5
    eligibility = get_purchase_return_eligibility(db_session, po_id=po.id, current_user=user)[0]
    assert eligibility["remaining_returnable_quantity"] == 5


def test_multi_product_return_is_atomic_on_validation_failure(db_session, make_user):
    user = make_user(email="atomic-return@example.com")
    vendor = _vendor(db_session, user)
    first = _product(db_session, user, "PR-A", stock=0)
    second = _product(db_session, user, "PR-B", stock=0)
    po, receipt = _received_po(db_session, user, vendor, [first, second], [3, 3])
    apply_stock_movement(
        db_session, product=second, shop_id=user.shop_id,
        movement_type=StockMovementType.ADJUSTMENT_OUT, quantity_delta=-3,
        reference_type="test", reference_id=1, actor=user, reason="sold elsewhere",
        client_request_id="consume-second-stock",
    )
    db_session.commit()
    first_before = first.stock_quantity

    with pytest.raises(HTTPException) as exc:
        create_purchase_return(
            db_session, po_id=po.id,
            payload=_return_payload(receipt, [1, 1], key="atomic-return-key"),
            current_user=user,
        )
    db_session.rollback()
    db_session.refresh(first)
    assert exc.value.status_code == 409
    assert first.stock_quantity == first_before
    assert db_session.query(PurchaseReturn).filter_by(purchase_order_id=po.id).count() == 0


def test_over_return_and_insufficient_sellable_stock_are_rejected(db_session, make_user):
    user = make_user(email="return-limits@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "PR-LIMIT", stock=0)
    po, receipt = _received_po(db_session, user, vendor, [product], [3])
    with pytest.raises(HTTPException, match="only 3"):
        create_purchase_return(
            db_session, po_id=po.id, payload=_return_payload(receipt, [4]), current_user=user
        )
    db_session.rollback()
    apply_stock_movement(
        db_session, product=product, shop_id=user.shop_id,
        movement_type=StockMovementType.ADJUSTMENT_OUT, quantity_delta=-2,
        reference_type="test", reference_id=2, actor=user, reason="sale simulation",
        client_request_id="consume-return-stock",
    )
    db_session.commit()
    with pytest.raises(HTTPException, match="sellable stock"):
        create_purchase_return(
            db_session, po_id=po.id,
            payload=_return_payload(receipt, [2], key="stock-limit-key"), current_user=user,
        )


def test_purchase_return_idempotency_and_payload_conflict(db_session, make_user):
    user = make_user(email="return-idempotent@example.com")
    vendor = _vendor(db_session, user)
    product = _product(db_session, user, "PR-IDEM", stock=0)
    po, receipt = _received_po(db_session, user, vendor, [product], [5])
    payload = _return_payload(receipt, [2], key="stable-return-key")
    first = create_purchase_return(db_session, po_id=po.id, payload=payload, current_user=user)
    replay = create_purchase_return(db_session, po_id=po.id, payload=payload, current_user=user)
    assert replay.id == first.id
    assert db_session.query(PurchaseReturn).filter_by(purchase_order_id=po.id).count() == 1
    assert db_session.query(StockMovement).filter_by(
        movement_type=StockMovementType.PURCHASE_RETURN, reference_id=first.id
    ).count() == 1
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.PURCHASE_RETURN_CREATED, entity_id=first.id
    ).count() == 1
    with pytest.raises(HTTPException) as exc:
        create_purchase_return(
            db_session, po_id=po.id,
            payload=_return_payload(receipt, [1], key="stable-return-key"), current_user=user,
        )
    assert exc.value.status_code == 409


def test_return_reason_validation_and_tenant_isolation(db_session, make_user):
    with pytest.raises(ValidationError, match="notes are required"):
        PurchaseReturnCreate(
            client_request_id="other-reason-key", return_date=TODAY, reason="other",
            items=[PurchaseReturnItemCreate(goods_receipt_item_id=1, returned_quantity=1)],
        )
    user_a = make_user(email="return-tenant-a@example.com")
    user_b = make_user(email="return-tenant-b@example.com")
    vendor = _vendor(db_session, user_b)
    product = _product(db_session, user_b, "PR-TENANT", stock=0)
    po, receipt = _received_po(db_session, user_b, vendor, [product])
    with pytest.raises(HTTPException) as exc:
        create_purchase_return(
            db_session, po_id=po.id, payload=_return_payload(receipt, [1]), current_user=user_a
        )
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException):
        list_purchase_returns(db_session, po_id=po.id, current_user=user_a)


def test_vendor_bill_initial_payment_and_derived_status(db_session, make_user):
    user = make_user(email="vendor-bill@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(vendor.id, _bill_payload(paid="250.00"), db_session, user)
    assert (bill.paid_amount, bill.remaining_amount, bill.status) == (
        Decimal("250.00"), Decimal("750.00"), "partial"
    )
    payments = list_bill_payments(bill.id, db_session, user)
    assert len(payments) == 1
    assert payments[0].client_request_id == f"vendor-bill-initial-{bill.id}"
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.VENDOR_BILL_CREATED, entity_id=bill.id
    ).count() == 1


@pytest.mark.parametrize(
    ("paid", "remaining", "status"),
    [
        ("20000.00", "80000.00", "partial"),
        ("100000.00", "0.00", "completed"),
    ],
)
def test_valid_legacy_bill_imports_payment_once(
    db_session, make_user, paid, remaining, status
):
    user = make_user(email=f"legacy-valid-{paid}@example.com")
    vendor = _vendor(db_session, user)
    bill = _legacy_bill(
        db_session,
        user,
        vendor,
        number=f"LEGACY-{paid}",
        total="100000.00",
        paid=paid,
        remaining=remaining,
        status=status,
        payment_mode="cash",
        payment_reference="legacy-reference",
    )

    first = list_bill_payments(bill.id, db_session, user)
    replay = list_bill_payments(bill.id, db_session, user)

    assert len(first) == len(replay) == 1
    assert first[0].id == replay[0].id
    assert first[0].amount == Decimal(paid)
    assert first[0].payment_date == bill.bill_date
    assert first[0].payment_mode == "cash"
    assert first[0].reference_number == "legacy-reference"
    assert first[0].client_request_id == f"legacy-vendor-bill-{bill.id}"
    assert "validated legacy" in first[0].notes


def test_zero_paid_legacy_bill_does_not_create_payment(db_session, make_user):
    user = make_user(email="legacy-zero@example.com")
    vendor = _vendor(db_session, user)
    bill = _legacy_bill(
        db_session, user, vendor, number="LEGACY-ZERO",
        total="100000.00", paid="0.00", remaining="100000.00", status="pending",
        payment_mode=None,
    )

    assert list_bill_payments(bill.id, db_session, user) == []
    assert db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).count() == 0


def test_overpaid_legacy_bill_is_rejected_without_mutation(db_session, make_user):
    user = make_user(email="legacy-overpaid@example.com")
    vendor = _vendor(db_session, user)
    bill = _legacy_bill(
        db_session, user, vendor, number="345",
        total="140000.00", paid="200000.00", remaining="0.00", status="completed",
        payment_mode=None,
    )

    with pytest.raises(HTTPException, match="requires remediation") as exc:
        list_bill_payments(bill.id, db_session, user)

    assert exc.value.status_code == 409
    assert db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).count() == 0
    db_session.refresh(bill)
    assert (bill.total_amount, bill.paid_amount, bill.remaining_amount, bill.status) == (
        Decimal("140000.00"), Decimal("200000.00"), Decimal("0.00"), "completed"
    )


def test_legacy_bill_remaining_mismatch_is_rejected(db_session, make_user):
    user = make_user(email="legacy-remaining@example.com")
    vendor = _vendor(db_session, user)
    bill = _legacy_bill(
        db_session, user, vendor, number="LEGACY-REMAINING",
        total="100000.00", paid="20000.00", remaining="70000.00",
    )

    with pytest.raises(HTTPException, match="requires remediation") as exc:
        list_bill_payments(bill.id, db_session, user)

    assert exc.value.status_code == 409
    assert db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).count() == 0


def test_existing_matching_payment_history_is_not_duplicated(db_session, make_user):
    user = make_user(email="legacy-existing@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(
        vendor.id, _bill_payload(number="EXISTING-HISTORY", paid="250.00"),
        db_session, user,
    )

    assert len(list_bill_payments(bill.id, db_session, user)) == 1
    assert db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).count() == 1


def test_hybrid_legacy_payment_mismatch_is_rejected(db_session, make_user):
    user = make_user(email="legacy-hybrid@example.com")
    vendor = _vendor(db_session, user)
    bill = _legacy_bill(
        db_session, user, vendor, number="LEGACY-HYBRID",
        total="1000.00", paid="500.00", remaining="500.00",
    )
    original = VendorBillPayment(
        shop_id=user.shop_id,
        vendor_bill_id=bill.id,
        payment_date=TODAY,
        amount=Decimal("200.00"),
        payment_mode="cash",
        client_request_id="existing-hybrid-payment",
        request_fingerprint="existing-hybrid-fingerprint",
    )
    db_session.add(original)
    db_session.commit()

    with pytest.raises(HTTPException, match="requires remediation") as exc:
        list_bill_payments(bill.id, db_session, user)

    assert exc.value.status_code == 409
    payments = db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).all()
    assert [payment.id for payment in payments] == [original.id]


def test_vendor_bill_rejects_initial_overpayment_and_duplicate_number(db_session, make_user):
    user = make_user(email="vendor-bill-integrity@example.com")
    vendor = _vendor(db_session, user)
    with pytest.raises(HTTPException) as exc:
        create_vendor_bill(vendor.id, _bill_payload(paid="1000.01"), db_session, user)
    assert exc.value.status_code == 409
    create_vendor_bill(vendor.id, _bill_payload(number="DUP-1"), db_session, user)
    with pytest.raises(HTTPException) as duplicate:
        create_vendor_bill(vendor.id, _bill_payload(number="DUP-1"), db_session, user)
    assert duplicate.value.status_code == 409


def test_vendor_payment_partial_full_overpayment_and_summary(db_session, make_user):
    user = make_user(email="vendor-payment@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(vendor.id, _bill_payload(), db_session, user)
    add_bill_payment(bill.id, _payment("payment-one", "600.00"), db_session, user)
    db_session.refresh(bill)
    assert (bill.paid_amount, bill.remaining_amount, bill.status) == (
        Decimal("600.00"), Decimal("400.00"), "partial"
    )
    with pytest.raises(HTTPException) as exc:
        add_bill_payment(bill.id, _payment("payment-too-large", "401.00"), db_session, user)
    assert exc.value.status_code == 409
    add_bill_payment(bill.id, _payment("payment-two", "400.00", "upi"), db_session, user)
    db_session.refresh(bill)
    assert (bill.paid_amount, bill.remaining_amount, bill.status) == (
        Decimal("1000.00"), Decimal("0.00"), "completed"
    )


def test_vendor_payment_idempotency_conflict_and_audit_once(db_session, make_user):
    user = make_user(email="vendor-payment-idem@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(vendor.id, _bill_payload(), db_session, user)
    payload = _payment("vendor-payment-stable", "300.00")
    first = add_bill_payment(bill.id, payload, db_session, user)
    replay = add_bill_payment(bill.id, payload, db_session, user)
    assert first.id == replay.id
    assert db_session.query(VendorBillPayment).filter_by(vendor_bill_id=bill.id).count() == 1
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.VENDOR_PAYMENT_CREATED, entity_id=first.id
    ).count() == 1
    with pytest.raises(HTTPException) as exc:
        add_bill_payment(bill.id, _payment("vendor-payment-stable", "200.00"), db_session, user)
    assert exc.value.status_code == 409


def test_bill_update_cannot_drop_total_below_payments_and_is_audited(db_session, make_user):
    user = make_user(email="vendor-update@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(vendor.id, _bill_payload(paid="600.00"), db_session, user)
    with pytest.raises(HTTPException) as exc:
        update_vendor_bill(
            bill.id, VendorBillUpdate(total_amount=Decimal("500.00")), db_session, user
        )
    assert exc.value.status_code == 409
    updated = update_vendor_bill(
        bill.id, VendorBillUpdate(total_amount=Decimal("1200.00")), db_session, user
    )
    assert (updated.paid_amount, updated.remaining_amount, updated.status) == (
        Decimal("600.00"), Decimal("600.00"), "partial"
    )
    assert db_session.query(BusinessAuditLog).filter_by(
        action=BusinessAuditAction.VENDOR_BILL_UPDATED, entity_id=bill.id
    ).count() == 1


def test_vendor_payment_tenant_isolation(db_session, make_user):
    owner = make_user(email="vendor-payment-owner@example.com")
    other = make_user(email="vendor-payment-other@example.com")
    vendor = _vendor(db_session, owner)
    bill = create_vendor_bill(vendor.id, _bill_payload(), db_session, owner)
    with pytest.raises(HTTPException) as exc:
        add_bill_payment(bill.id, _payment("foreign-payment", "1.00"), db_session, other)
    assert exc.value.status_code == 404


def test_vendor_with_bill_or_purchase_history_is_deactivated(db_session, make_user):
    user = make_user(email="vendor-retention@example.com")
    vendor = _vendor(db_session, user)
    bill = create_vendor_bill(vendor.id, _bill_payload(), db_session, user)
    result = delete_vendor(vendor.id, db_session, user)
    db_session.refresh(vendor)
    assert "deactivated" in result["message"].lower()
    assert vendor.is_active is False
    assert db_session.get(VendorBill, bill.id) is not None


def test_purchase_return_numbering_is_tenant_scoped(db_session, make_user):
    user_a = make_user(email="return-number-a@example.com")
    user_b = make_user(email="return-number-b@example.com")
    results = []
    for user, suffix in ((user_a, "A"), (user_a, "A2"), (user_b, "B")):
        vendor = _vendor(db_session, user, f"Vendor {suffix}")
        product = _product(db_session, user, f"PR-NUM-{suffix}", stock=0)
        po, receipt = _received_po(db_session, user, vendor, [product], [1])
        results.append(create_purchase_return(
            db_session, po_id=po.id,
            payload=_return_payload(receipt, [1], key=f"return-number-{suffix}"), current_user=user,
        ))
    assert [row.return_number for row in results] == [
        "PR-20261003-001", "PR-20261003-002", "PR-20261003-001"
    ]
