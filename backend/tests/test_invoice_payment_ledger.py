from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.invoice import Invoice
from app.models.invoice_payment import InvoicePayment
from app.models.product import Product
from app.models.product_sales_analytics import ProductSalesAnalytics
from app.schemas.invoice import InvoiceCreate, InvoicePaymentCreate, InvoiceUpdate
from app.services.invoice_service import add_invoice_payment, create_invoice, delete_invoice, update_invoice


def _make_product(db_session, shop_id: int, *, sku: str, stock_quantity: int = 20) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Payment {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("50.00"),
        mrp=Decimal("1000.00"),
        selling_price=Decimal("1000.00"),
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _invoice_payload(
    product: Product,
    *,
    key: str,
    quantity: int = 1,
    paid_amount: Decimal = Decimal("0.00"),
    payment_mode: str | None = None,
    payments: list[dict] | None = None,
) -> InvoiceCreate:
    data = {
        "client_request_id": key,
        "customer": {
            "first_name": "Ledger",
            "last_name": "Customer",
            "phone": "9000000100",
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
    if payments is not None:
        data["payments"] = payments
    return InvoiceCreate.model_validate(data)


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


def _refresh_invoice(db_session, invoice: Invoice) -> Invoice:
    db_session.refresh(invoice)
    return invoice


def test_full_payment_updates_invoice_summary(db_session, make_user):
    user = make_user(email="ledger-full@example.com")
    product = _make_product(db_session, user.shop_id, sku="FULL")
    invoice = create_invoice(_invoice_payload(product, key="invoice-full"), db_session, user)

    payment = add_invoice_payment(
        invoice.id,
        _payment_payload(key="payment-full", amount=Decimal("1000.00"), method="cash"),
        db_session,
        user,
    )

    invoice = _refresh_invoice(db_session, invoice)
    assert payment.id
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 1
    assert invoice.paid_amount == Decimal("1000.00")
    assert invoice.remaining_amount == Decimal("0.00")
    assert invoice.payment_status == "paid"
    assert invoice.payment_mode == "cash"


def test_partial_and_later_payment_update_history_and_status(db_session, make_user):
    user = make_user(email="ledger-partial@example.com")
    product = _make_product(db_session, user.shop_id, sku="PARTIAL")
    invoice = create_invoice(_invoice_payload(product, key="invoice-partial"), db_session, user)

    add_invoice_payment(
        invoice.id,
        _payment_payload(key="payment-partial-a", amount=Decimal("600.00"), method="cash"),
        db_session,
        user,
    )
    invoice = _refresh_invoice(db_session, invoice)
    assert invoice.paid_amount == Decimal("600.00")
    assert invoice.remaining_amount == Decimal("400.00")
    assert invoice.payment_status == "partial"

    add_invoice_payment(
        invoice.id,
        _payment_payload(key="payment-partial-b", amount=Decimal("400.00"), method="upi"),
        db_session,
        user,
    )
    invoice = _refresh_invoice(db_session, invoice)
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 2
    assert invoice.paid_amount == Decimal("1000.00")
    assert invoice.remaining_amount == Decimal("0.00")
    assert invoice.payment_status == "paid"
    assert invoice.payment_mode == "mixed"


def test_split_payment_during_invoice_creation_creates_payment_rows(db_session, make_user):
    user = make_user(email="ledger-split@example.com")
    product = _make_product(db_session, user.shop_id, sku="SPLIT")

    invoice = create_invoice(
        _invoice_payload(
            product,
            key="invoice-split",
            payments=[
                {"amount": Decimal("500.00"), "payment_method": "cash"},
                {"amount": Decimal("500.00"), "payment_method": "upi", "payment_reference": "UPI123"},
            ],
        ),
        db_session,
        user,
    )

    assert invoice.paid_amount == Decimal("1000.00")
    assert invoice.remaining_amount == Decimal("0.00")
    assert invoice.payment_status == "paid"
    assert invoice.payment_mode == "mixed"
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 2
    assert db_session.query(ProductSalesAnalytics).filter_by(invoice_id=invoice.id).count() == 1


def test_unpaid_invoice_has_no_fake_payment_row(db_session, make_user):
    user = make_user(email="ledger-unpaid@example.com")
    product = _make_product(db_session, user.shop_id, sku="UNPAID")
    invoice = create_invoice(_invoice_payload(product, key="invoice-unpaid"), db_session, user)

    assert invoice.paid_amount == Decimal("0.00")
    assert invoice.remaining_amount == Decimal("1000.00")
    assert invoice.payment_status == "pending"
    assert invoice.payment_mode is None
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 0


def test_overpayment_is_rejected_without_payment_row(db_session, make_user):
    user = make_user(email="ledger-overpay@example.com")
    product = _make_product(db_session, user.shop_id, sku="OVERPAY")
    invoice = create_invoice(_invoice_payload(product, key="invoice-overpay"), db_session, user)
    add_invoice_payment(
        invoice.id,
        _payment_payload(key="payment-overpay-a", amount=Decimal("800.00"), method="cash"),
        db_session,
        user,
    )

    with pytest.raises(HTTPException) as exc:
        add_invoice_payment(
            invoice.id,
            _payment_payload(key="payment-overpay-b", amount=Decimal("201.00"), method="upi"),
            db_session,
            user,
        )

    assert exc.value.status_code == 409
    invoice = _refresh_invoice(db_session, invoice)
    assert invoice.paid_amount == Decimal("800.00")
    assert invoice.remaining_amount == Decimal("200.00")
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 1


def test_payment_idempotency_replays_and_conflicts(db_session, make_user):
    user = make_user(email="ledger-idem@example.com")
    product = _make_product(db_session, user.shop_id, sku="IDEMPAY")
    invoice = create_invoice(_invoice_payload(product, key="invoice-idem-pay"), db_session, user)
    payload = _payment_payload(
        key="payment-idempotent",
        amount=Decimal("300.00"),
        method="card",
        reference="CARD-1",
    )

    first = add_invoice_payment(invoice.id, payload, db_session, user)
    second = add_invoice_payment(invoice.id, payload, db_session, user)

    assert second.id == first.id
    invoice = _refresh_invoice(db_session, invoice)
    assert invoice.paid_amount == Decimal("300.00")
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 1
    assert (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.action == BusinessAuditAction.PAYMENT_RECEIVED,
            BusinessAuditLog.entity_id == first.id,
        )
        .count()
        == 1
    )

    with pytest.raises(HTTPException) as exc:
        add_invoice_payment(
            invoice.id,
            _payment_payload(key="payment-idempotent", amount=Decimal("301.00"), method="card"),
            db_session,
            user,
        )
    assert exc.value.status_code == 409


def test_initial_payment_is_not_duplicated_on_invoice_idempotency_replay(db_session, make_user):
    user = make_user(email="ledger-initial-replay@example.com")
    product = _make_product(db_session, user.shop_id, sku="INITREPLAY", stock_quantity=5)
    payload = _invoice_payload(
        product,
        key="invoice-with-initial-payment",
        paid_amount=Decimal("500.00"),
        payment_mode="cash",
    )

    first = create_invoice(payload, db_session, user)
    second = create_invoice(payload, db_session, user)

    assert second.id == first.id
    assert db_session.query(Invoice).filter_by(shop_id=user.shop_id).count() == 1
    assert db_session.query(InvoicePayment).filter_by(invoice_id=first.id).count() == 1
    assert _refresh_invoice(db_session, first).paid_amount == Decimal("500.00")
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.PAYMENT_RECEIVED)
        .count()
        == 1
    )


def test_cancelled_invoice_blocks_new_payment_but_history_remains(db_session, make_user):
    user = make_user(email="ledger-cancelled@example.com")
    product = _make_product(db_session, user.shop_id, sku="CANCELPAY")
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="invoice-cancelled-payment",
            paid_amount=Decimal("200.00"),
            payment_mode="cash",
        ),
        db_session,
        user,
    )
    delete_invoice(invoice.id, db_session, user)

    with pytest.raises(HTTPException) as exc:
        add_invoice_payment(
            invoice.id,
            _payment_payload(key="payment-cancelled", amount=Decimal("100.00"), method="upi"),
            db_session,
            user,
        )

    assert exc.value.status_code == 409
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice.id).count() == 1


def test_tenant_cannot_access_or_record_other_shop_payments(client, db_session, make_user, auth_headers):
    user_a = make_user(email="ledger-tenant-a@example.com")
    user_b = make_user(email="ledger-tenant-b@example.com")
    product_b = _make_product(db_session, user_b.shop_id, sku="TENANTPAY")
    invoice_b = create_invoice(_invoice_payload(product_b, key="invoice-tenant-b"), db_session, user_b)
    headers_a = auth_headers(user_a.email)

    list_response = client.get(f"/api/v1/invoices/{invoice_b.id}/payments", headers=headers_a)
    create_response = client.post(
        f"/api/v1/invoices/{invoice_b.id}/payments",
        headers=headers_a,
        json={
            "client_request_id": "tenant-a-payment-attempt",
            "amount": "100.00",
            "payment_method": "cash",
        },
    )

    assert list_response.status_code == 404
    assert create_response.status_code == 404
    assert db_session.query(InvoicePayment).filter_by(invoice_id=invoice_b.id).count() == 0


def test_direct_invoice_payment_update_is_rejected(db_session, make_user):
    user = make_user(email="ledger-direct-update@example.com")
    product = _make_product(db_session, user.shop_id, sku="DIRECT")
    invoice = create_invoice(_invoice_payload(product, key="invoice-direct-update"), db_session, user)

    with pytest.raises(HTTPException) as exc:
        update_invoice(
            invoice.id,
            InvoiceUpdate.model_validate({"paid_amount": Decimal("100.00")}),
            db_session,
            user,
        )

    assert exc.value.status_code == 409
    assert _refresh_invoice(db_session, invoice).paid_amount == Decimal("0.00")
