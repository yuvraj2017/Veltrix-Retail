from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.invoice_idempotency import InvoiceIdempotencyKey
from app.models.product import Product
from app.models.product_sales_analytics import ProductSalesAnalytics
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.services.invoice_service import create_invoice, delete_invoice, update_invoice


def _make_product(
    db_session,
    shop_id: int,
    *,
    sku: str,
    stock_quantity: int = 10,
) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Idempotency {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("40.00"),
        mrp=Decimal("100.00"),
        selling_price=Decimal("100.00"),
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _payload(
    product: Product,
    *,
    key: str = "invoice-request-001",
    quantity: int | str | Decimal = 1,
    invoice_status: str = "saved",
) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "client_request_id": key,
            "customer": {
                "first_name": "Idem",
                "last_name": "Customer",
                "phone": "9000000099",
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
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": invoice_status,
        }
    )


def _update_payload(product: Product, quantity: int) -> InvoiceUpdate:
    return InvoiceUpdate.model_validate(
        {
            "customer": {
                "first_name": "Idem",
                "last_name": "Customer",
                "phone": "9000000099",
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
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "draft",
        }
    )


def _stock(db_session, product: Product) -> int:
    db_session.refresh(product)
    return product.stock_quantity


def test_same_idempotency_key_replays_existing_invoice_without_side_effects(
    db_session,
    make_user,
):
    user = make_user(email="idem-replay@example.com")
    product = _make_product(db_session, user.shop_id, sku="REPLAY", stock_quantity=5)

    first = create_invoice(_payload(product, key="same-key-001", quantity=2), db_session, user)
    second = create_invoice(_payload(product, key="same-key-001", quantity=2), db_session, user)

    assert second.id == first.id
    assert second.invoice_number == first.invoice_number
    assert db_session.query(Invoice).filter(Invoice.shop_id == user.shop_id).count() == 1
    assert db_session.query(InvoiceIdempotencyKey).count() == 1
    assert _stock(db_session, product) == 3

    customer = db_session.get(Customer, first.customer_id)
    assert customer.total_orders == 1
    assert customer.total_spent == Decimal("200.00")
    assert db_session.query(ProductSalesAnalytics).filter_by(invoice_id=first.id).count() == 1
    assert (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.action == BusinessAuditAction.INVOICE_CREATED,
            BusinessAuditLog.entity_id == first.id,
        )
        .count()
        == 1
    )


def test_same_key_with_different_payload_is_rejected_without_mutation(db_session, make_user):
    user = make_user(email="idem-conflict@example.com")
    product = _make_product(db_session, user.shop_id, sku="CONFLICT", stock_quantity=10)

    first = create_invoice(_payload(product, key="same-key-different", quantity=1), db_session, user)

    with pytest.raises(HTTPException) as exc:
        create_invoice(_payload(product, key="same-key-different", quantity=3), db_session, user)

    assert exc.value.status_code == 409
    assert db_session.query(Invoice).filter(Invoice.shop_id == user.shop_id).count() == 1
    assert _stock(db_session, product) == 9
    assert db_session.query(ProductSalesAnalytics).filter_by(invoice_id=first.id).count() == 1


def test_identical_payload_with_different_keys_creates_intentional_sales(db_session, make_user):
    user = make_user(email="idem-different-keys@example.com")
    product = _make_product(db_session, user.shop_id, sku="DIFFKEY", stock_quantity=5)

    first = create_invoice(_payload(product, key="different-key-a", quantity=1), db_session, user)
    second = create_invoice(_payload(product, key="different-key-b", quantity=1), db_session, user)

    assert second.id != first.id
    assert first.invoice_number != second.invoice_number
    assert db_session.query(Invoice).filter(Invoice.shop_id == user.shop_id).count() == 2
    assert _stock(db_session, product) == 3


def test_same_idempotency_key_is_scoped_per_tenant(db_session, make_user):
    user_a = make_user(email="idem-tenant-a@example.com")
    user_b = make_user(email="idem-tenant-b@example.com")
    product_a = _make_product(db_session, user_a.shop_id, sku="TENANTA", stock_quantity=5)
    product_b = _make_product(db_session, user_b.shop_id, sku="TENANTB", stock_quantity=5)

    invoice_a = create_invoice(_payload(product_a, key="shared-key", quantity=1), db_session, user_a)
    invoice_b = create_invoice(_payload(product_b, key="shared-key", quantity=1), db_session, user_b)

    assert invoice_a.id != invoice_b.id
    assert invoice_a.shop_id == user_a.shop_id
    assert invoice_b.shop_id == user_b.shop_id
    assert db_session.query(InvoiceIdempotencyKey).count() == 2


def test_failed_request_key_can_be_retried_after_rollback(db_session, make_user):
    user = make_user(email="idem-failure-retry@example.com")
    product = _make_product(db_session, user.shop_id, sku="FAILRETRY", stock_quantity=1)

    with pytest.raises(HTTPException):
        create_invoice(_payload(product, key="retry-after-failure", quantity=2), db_session, user)

    db_session.rollback()
    product.stock_quantity = 2
    db_session.commit()

    invoice = create_invoice(_payload(product, key="retry-after-failure", quantity=2), db_session, user)

    assert invoice.id
    assert _stock(db_session, product) == 0
    assert db_session.query(InvoiceIdempotencyKey).count() == 1


def test_finalized_invoice_rejects_commercial_edit_without_stock_change(db_session, make_user):
    user = make_user(email="lifecycle-finalized-edit@example.com")
    product = _make_product(db_session, user.shop_id, sku="FINALLOCK", stock_quantity=5)
    invoice = create_invoice(_payload(product, key="finalized-edit", quantity=1), db_session, user)

    with pytest.raises(HTTPException) as exc:
        update_invoice(invoice.id, _update_payload(product, 2), db_session, user)

    db_session.rollback()
    assert exc.value.status_code == 409
    assert _stock(db_session, product) == 4


def test_draft_invoice_can_be_edited_and_then_finalized(db_session, make_user):
    user = make_user(email="lifecycle-draft-edit@example.com")
    product = _make_product(db_session, user.shop_id, sku="DRAFTEDIT", stock_quantity=5)
    invoice = create_invoice(
        _payload(product, key="draft-edit", quantity=1, invoice_status="draft"),
        db_session,
        user,
    )

    edited = update_invoice(invoice.id, _update_payload(product, 2), db_session, user)
    assert edited.invoice_status == "draft"
    assert _stock(db_session, product) == 3

    finalized = update_invoice(
        invoice.id,
        InvoiceUpdate.model_validate({"invoice_status": "saved"}),
        db_session,
        user,
    )
    assert finalized.invoice_status == "saved"
    assert finalized.finalized_at is not None


def test_cancelled_invoice_rejects_edit_and_repeated_cancel_is_audit_safe(db_session, make_user):
    user = make_user(email="lifecycle-cancelled-edit@example.com")
    product = _make_product(db_session, user.shop_id, sku="CANCELLOCK", stock_quantity=5)
    invoice = create_invoice(_payload(product, key="cancelled-edit", quantity=1), db_session, user)

    delete_invoice(invoice.id, db_session, user)
    delete_invoice(invoice.id, db_session, user)

    with pytest.raises(HTTPException) as exc:
        update_invoice(invoice.id, InvoiceUpdate.model_validate({"notes": "nope"}), db_session, user)

    assert exc.value.status_code == 409
    assert (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.action == BusinessAuditAction.INVOICE_CANCELLED,
            BusinessAuditLog.entity_id == invoice.id,
        )
        .count()
        == 1
    )
    assert _stock(db_session, product) == 5
