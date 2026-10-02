from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.invoice import Invoice
from app.models.invoice_payment import InvoicePayment
from app.models.invoice_return import InvoiceRefund, InvoiceReturn, InvoiceReturnItem
from app.models.product import Product
from app.models.shop import Shop
from app.schemas.invoice import (
    InvoiceCancelPayload,
    InvoiceCreate,
    InvoicePaymentCreate,
    InvoiceRefundCreate,
    InvoiceReturnCreate,
)
from app.services.invoice_service import (
    add_invoice_payment,
    add_return_refund,
    cancel_invoice,
    create_invoice,
    create_invoice_return,
    delete_invoice,
)


def _make_product(
    db_session,
    shop_id: int,
    *,
    sku: str,
    stock_quantity: int = 20,
    gst_rate: Decimal = Decimal("18.00"),
    price: Decimal = Decimal("1000.00"),
) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Return {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("100.00"),
        mrp=price,
        selling_price=price,
        hsn_sac="9988",
        gst_rate=gst_rate,
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _enable_gst(db_session, shop_id: int):
    shop = db_session.query(Shop).filter(Shop.id == shop_id).one()
    shop.gst_enabled = True
    shop.gstin = "24ABCDE1234F1Z5"
    shop.state = "Gujarat"
    shop.gst_state_code = "24"
    db_session.commit()


def _invoice_payload(
    product: Product,
    *,
    key: str,
    quantity: int = 1,
    paid_amount: Decimal = Decimal("0.00"),
    payment_mode: str | None = None,
) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "client_request_id": key,
            "customer": {
                "first_name": "Return",
                "last_name": "Customer",
                "phone": "9000000200",
                "state": "Gujarat",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": date(2026, 10, 1),
            "payment_status": "pending",
            "payment_mode": payment_mode,
            "paid_amount": paid_amount,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _return_payload(
    invoice: Invoice,
    *,
    key: str,
    quantity: Decimal,
    reason: str = "Customer returned item",
) -> InvoiceReturnCreate:
    return InvoiceReturnCreate.model_validate(
        {
            "client_request_id": key,
            "reason": reason,
            "items": [
                {
                    "invoice_item_id": invoice.items[0].id,
                    "quantity": quantity,
                }
            ],
        }
    )


def _refund_payload(*, key: str, amount: Decimal, method: str = "cash") -> InvoiceRefundCreate:
    return InvoiceRefundCreate.model_validate(
        {
            "client_request_id": key,
            "amount": amount,
            "refund_method": method,
        }
    )


def _payment_payload(
    *,
    key: str,
    amount: Decimal,
    method: str = "cash",
    reference: str | None = None,
) -> InvoicePaymentCreate:
    return InvoicePaymentCreate.model_validate(
        {
            "client_request_id": key,
            "amount": amount,
            "payment_method": method,
            "payment_reference": reference,
        }
    )


def _refresh(db_session, obj):
    db_session.refresh(obj)
    return obj


def test_partial_return_restores_stock_and_generates_credit_note(db_session, make_user):
    user = make_user(email="return-partial@example.com")
    _enable_gst(db_session, user.shop_id)
    product = _make_product(db_session, user.shop_id, sku="PARTRET", stock_quantity=10)
    invoice = create_invoice(_invoice_payload(product, key="return-partial-invoice", quantity=3), db_session, user)

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-partial-key", quantity=Decimal("1")),
        db_session,
        user,
    )

    assert return_record.return_number.startswith("RTN-")
    assert return_record.credit_note_number.startswith("CN-")
    assert return_record.total_amount == Decimal("1180.00")
    assert return_record.taxable_amount == Decimal("1000.00")
    assert return_record.cgst_amount == Decimal("90.00")
    assert return_record.sgst_amount == Decimal("90.00")
    assert return_record.igst_amount == Decimal("0.00")
    assert db_session.query(InvoiceReturnItem).filter_by(return_id=return_record.id).one().quantity == Decimal("1.00")
    assert _refresh(db_session, product).stock_quantity == 8
    assert _refresh(db_session, invoice).final_amount == Decimal("3540.00")
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.RETURN_CREATED)
        .count()
        == 1
    )
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.CREDIT_NOTE_CREATED)
        .count()
        == 1
    )


def test_repeated_partial_returns_cannot_exceed_original_quantity(db_session, make_user):
    user = make_user(email="return-repeat@example.com")
    product = _make_product(db_session, user.shop_id, sku="REPEAT", stock_quantity=10)
    invoice = create_invoice(_invoice_payload(product, key="return-repeat-invoice", quantity=5), db_session, user)

    create_invoice_return(invoice.id, _return_payload(invoice, key="return-repeat-a", quantity=Decimal("2")), db_session, user)
    create_invoice_return(invoice.id, _return_payload(invoice, key="return-repeat-b", quantity=Decimal("2")), db_session, user)

    with pytest.raises(HTTPException) as exc:
        create_invoice_return(invoice.id, _return_payload(invoice, key="return-repeat-c", quantity=Decimal("2")), db_session, user)

    assert exc.value.status_code == 409
    assert _refresh(db_session, product).stock_quantity == 9
    assert db_session.query(InvoiceReturn).filter_by(invoice_id=invoice.id).count() == 2


def test_full_return_preserves_invoice_and_restores_stock(db_session, make_user):
    user = make_user(email="return-full@example.com")
    _enable_gst(db_session, user.shop_id)
    product = _make_product(db_session, user.shop_id, sku="FULLRET", stock_quantity=5)
    invoice = create_invoice(_invoice_payload(product, key="return-full-invoice", quantity=2), db_session, user)

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-full-key", quantity=Decimal("2")),
        db_session,
        user,
    )

    assert return_record.total_amount == invoice.final_amount
    assert _refresh(db_session, product).stock_quantity == 5
    assert _refresh(db_session, invoice).invoice_status == "saved"
    assert invoice.final_amount == Decimal("2360.00")


def test_return_uses_original_gst_snapshot_after_product_rate_change(db_session, make_user):
    user = make_user(email="return-gst-snapshot@example.com")
    _enable_gst(db_session, user.shop_id)
    product = _make_product(db_session, user.shop_id, sku="GSTSNAP", stock_quantity=5, gst_rate=Decimal("18.00"))
    invoice = create_invoice(_invoice_payload(product, key="return-gst-snapshot-invoice"), db_session, user)

    product.gst_rate = Decimal("5.00")
    db_session.commit()

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-gst-snapshot-key", quantity=Decimal("1")),
        db_session,
        user,
    )

    assert return_record.items[0].gst_rate == Decimal("18.00")
    assert return_record.total_tax_amount == Decimal("180.00")


def test_partially_paid_return_applies_outstanding_before_refundable(db_session, make_user):
    user = make_user(email="return-part-paid@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="PARTPAID",
        stock_quantity=5,
        gst_rate=Decimal("0.00"),
        price=Decimal("500.00"),
    )
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="return-part-paid-invoice",
            quantity=2,
            paid_amount=Decimal("600.00"),
            payment_mode="cash",
        ),
        db_session,
        user,
    )

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-part-paid-key", quantity=Decimal("1")),
        db_session,
        user,
    )

    assert return_record.total_amount == Decimal("500.00")
    assert return_record.applied_to_outstanding_amount == Decimal("400.00")
    assert return_record.refundable_amount == Decimal("100.00")

    with pytest.raises(HTTPException) as exc:
        add_return_refund(return_record.id, _refund_payload(key="refund-too-large", amount=Decimal("500.00")), db_session, user)

    assert exc.value.status_code == 409


def test_later_payment_respects_return_adjusted_outstanding(db_session, make_user):
    user = make_user(email="return-later-payment@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="RETURNPAY",
        stock_quantity=5,
        gst_rate=Decimal("0.00"),
        price=Decimal("500.00"),
    )
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="return-later-payment-invoice",
            quantity=2,
            paid_amount=Decimal("0.00"),
            payment_mode=None,
        ),
        db_session,
        user,
    )

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-later-payment-key", quantity=Decimal("1")),
        db_session,
        user,
    )
    db_session.refresh(invoice)

    assert return_record.applied_to_outstanding_amount == Decimal("500.00")
    assert invoice.remaining_amount == Decimal("500.00")

    with pytest.raises(HTTPException) as exc:
        add_invoice_payment(
            invoice.id,
            _payment_payload(key="return-later-payment-too-large", amount=Decimal("600.00")),
            db_session,
            user,
        )

    assert exc.value.status_code == 409

    payment = add_invoice_payment(
        invoice.id,
        _payment_payload(key="return-later-payment-valid", amount=Decimal("500.00"), method="upi"),
        db_session,
        user,
    )
    db_session.refresh(invoice)

    assert payment.amount == Decimal("500.00")
    assert invoice.paid_amount == Decimal("500.00")
    assert invoice.remaining_amount == Decimal("0.00")
    assert invoice.payment_status == "paid"


def test_fully_paid_return_refund_limit_and_payment_preservation(db_session, make_user):
    user = make_user(email="return-paid-refund@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="PAIDREF",
        stock_quantity=5,
        gst_rate=Decimal("0.00"),
        price=Decimal("300.00"),
    )
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="return-paid-refund-invoice",
            paid_amount=Decimal("300.00"),
            payment_mode="cash",
        ),
        db_session,
        user,
    )

    return_record = create_invoice_return(
        invoice.id,
        _return_payload(invoice, key="return-paid-refund-key", quantity=Decimal("1")),
        db_session,
        user,
    )
    refund = add_return_refund(return_record.id, _refund_payload(key="refund-paid", amount=Decimal("300.00")), db_session, user)

    assert refund.amount == Decimal("300.00")
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).one().amount == Decimal("300.00")
    assert db_session.query(InvoiceRefund).filter_by(return_id=return_record.id).count() == 1

    with pytest.raises(HTTPException) as exc:
        add_return_refund(return_record.id, _refund_payload(key="refund-paid-extra", amount=Decimal("1.00")), db_session, user)

    assert exc.value.status_code == 409


def test_return_and_refund_idempotency_replay_and_conflict(db_session, make_user):
    user = make_user(email="return-idem@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="IDEMRET",
        stock_quantity=5,
        gst_rate=Decimal("0.00"),
        price=Decimal("300.00"),
    )
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="return-idem-invoice",
            paid_amount=Decimal("300.00"),
            payment_mode="cash",
        ),
        db_session,
        user,
    )
    payload = _return_payload(invoice, key="return-idem-key", quantity=Decimal("1"))

    first = create_invoice_return(invoice.id, payload, db_session, user)
    second = create_invoice_return(invoice.id, payload, db_session, user)

    assert second.id == first.id
    assert db_session.query(InvoiceReturn).filter_by(invoice_id=invoice.id).count() == 1
    assert _refresh(db_session, product).stock_quantity == 5

    with pytest.raises(HTTPException) as exc:
        create_invoice_return(invoice.id, _return_payload(invoice, key="return-idem-key", quantity=Decimal("2")), db_session, user)

    assert exc.value.status_code == 409

    refund_payload = _refund_payload(key="refund-idem-key", amount=Decimal("300.00"), method="upi")
    refund_first = add_return_refund(first.id, refund_payload, db_session, user)
    refund_second = add_return_refund(first.id, refund_payload, db_session, user)
    assert refund_second.id == refund_first.id
    assert db_session.query(InvoiceRefund).filter_by(return_id=first.id).count() == 1

    with pytest.raises(HTTPException) as exc:
        add_return_refund(first.id, _refund_payload(key="refund-idem-key", amount=Decimal("200.00")), db_session, user)

    assert exc.value.status_code == 409


def test_finalized_cancellation_uses_full_return_and_is_repeat_safe(db_session, make_user):
    user = make_user(email="return-cancel@example.com")
    product = _make_product(db_session, user.shop_id, sku="CANCELRET", stock_quantity=5)
    invoice = create_invoice(_invoice_payload(product, key="return-cancel-invoice", quantity=2), db_session, user)

    response = cancel_invoice(
        invoice.id,
        InvoiceCancelPayload.model_validate({"client_request_id": "cancel-return-key", "reason": "Customer cancelled"}),
        db_session,
        user,
    )
    repeated = delete_invoice(invoice.id, db_session, user)

    assert response["message"] == "Invoice cancelled successfully"
    assert repeated["message"] == "Invoice already cancelled"
    assert _refresh(db_session, product).stock_quantity == 5
    assert _refresh(db_session, invoice).invoice_status == "cancelled"
    assert db_session.query(InvoiceReturn).filter_by(invoice_id=invoice.id).count() == 1


def test_tenant_cannot_return_or_refund_other_shop_invoice(client, db_session, make_user, auth_headers):
    user_a = make_user(email="return-tenant-a@example.com")
    user_b = make_user(email="return-tenant-b@example.com")
    product_b = _make_product(db_session, user_b.shop_id, sku="TENANTRET", stock_quantity=5)
    invoice_b = create_invoice(_invoice_payload(product_b, key="return-tenant-b-invoice"), db_session, user_b)
    headers_a = auth_headers(user_a.email)

    response = client.post(
        f"/api/v1/invoices/{invoice_b.id}/returns",
        headers=headers_a,
        json={
            "client_request_id": "tenant-return-attempt",
            "reason": "Bad tenant",
            "items": [{"invoice_item_id": invoice_b.items[0].id, "quantity": "1"}],
        },
    )

    assert response.status_code == 404
    assert db_session.query(InvoiceReturn).filter_by(invoice_id=invoice_b.id).count() == 0
