from datetime import date
from decimal import Decimal

import pytest

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.invoice import Invoice
from app.models.product import Product
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.schemas.product import ProductCreate, ProductUpdate
from app.services import invoice_service
from app.services.business_audit_service import record_business_audit
from app.services.invoice_service import create_invoice, delete_invoice, update_invoice
from app.services.product_service import create_product, update_product


def _make_product(
    db_session,
    shop_id: int,
    *,
    sku: str,
    stock_quantity: int = 10,
    selling_price: Decimal = Decimal("100.00"),
) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Product {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("40.00"),
        mrp=selling_price,
        selling_price=selling_price,
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _invoice_payload(product: Product, quantity=1) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "customer": {
                "first_name": "Audit",
                "last_name": "Customer",
                "phone": "9000000001",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": date(2026, 9, 27),
            "payment_status": "pending",
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _audit_entries(db_session):
    return (
        db_session.query(BusinessAuditLog)
        .order_by(BusinessAuditLog.id.asc())
        .all()
    )


def test_invoice_creation_records_business_audit(db_session, make_user):
    user = make_user(email="audit-invoice-create@example.com")
    product = _make_product(db_session, user.shop_id, sku="AIC")

    invoice = create_invoice(_invoice_payload(product), db_session, user)
    entry = _audit_entries(db_session)[-1]

    assert invoice.id
    assert entry.shop_id == user.shop_id
    assert entry.actor_user_id == user.id
    assert entry.action == BusinessAuditAction.INVOICE_CREATED
    assert entry.entity_type == "invoice"
    assert entry.entity_id == invoice.id
    assert entry.after_data["invoice_number"] == invoice.invoice_number
    assert entry.after_data["item_count"] == 1


def test_invoice_update_records_before_after_data(db_session, make_user):
    user = make_user(email="audit-invoice-update@example.com")
    product = _make_product(db_session, user.shop_id, sku="AIU")
    invoice = create_invoice(_invoice_payload(product), db_session, user)

    update_invoice(
        invoice.id,
        InvoiceUpdate.model_validate({"notes": "Payment will be collected later"}),
        db_session,
        user,
    )

    entry = (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.INVOICE_UPDATED)
        .one()
    )
    assert entry.before_data["notes"] is None
    assert entry.after_data["notes"] == "Payment will be collected later"
    assert entry.entity_id == invoice.id


def test_invoice_cancellation_records_audit_event(db_session, make_user):
    user = make_user(email="audit-invoice-cancel@example.com")
    product = _make_product(db_session, user.shop_id, sku="AICAN")
    invoice = create_invoice(_invoice_payload(product), db_session, user)

    delete_invoice(invoice.id, db_session, user)

    entry = (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.INVOICE_CANCELLED)
        .one()
    )
    assert entry.before_data["invoice_status"] == "saved"
    assert entry.after_data["invoice_status"] == "cancelled"


def test_product_creation_records_business_audit(db_session, make_user):
    user = make_user(email="audit-product-create@example.com")

    product = create_product(
        ProductCreate(
            name="Audit Product",
            sku="APC",
            category="General",
            buying_price=Decimal("10.00"),
            mrp=Decimal("20.00"),
            selling_price=Decimal("18.00"),
            stock_quantity=5,
            low_stock_threshold=1,
            unit="pcs",
        ),
        user,
        db_session,
    )

    entry = _audit_entries(db_session)[-1]
    assert entry.action == BusinessAuditAction.PRODUCT_CREATED
    assert entry.entity_type == "product"
    assert entry.entity_id == product.id
    assert entry.after_data["sku"] == "APC"
    assert entry.after_data["stock_quantity"] == 5


def test_product_update_records_price_and_stock_changes(db_session, make_user):
    user = make_user(email="audit-product-update@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="APU",
        stock_quantity=5,
        selling_price=Decimal("100.00"),
    )

    update_product(
        product.id,
        ProductUpdate(selling_price=Decimal("120.00"), stock_quantity=8),
        user,
        db_session,
    )

    entry = (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.PRODUCT_UPDATED)
        .one()
    )
    assert entry.before_data == {
        "selling_price": "100.00",
        "stock_quantity": 5,
    }
    assert entry.after_data == {
        "selling_price": "120.00",
        "stock_quantity": 8,
    }


def test_product_no_change_update_does_not_create_misleading_audit(db_session, make_user):
    user = make_user(email="audit-product-nochange@example.com")
    product = _make_product(db_session, user.shop_id, sku="APN")

    update_product(
        product.id,
        ProductUpdate(selling_price=product.selling_price, stock_quantity=product.stock_quantity),
        user,
        db_session,
    )

    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.PRODUCT_UPDATED)
        .count()
        == 0
    )


def test_business_audit_read_api_is_tenant_isolated(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user_a = make_user(email="audit-tenant-a@example.com")
    user_b = make_user(email="audit-tenant-b@example.com")

    create_product(
        ProductCreate(
            name="Tenant A Product",
            sku="TENANTA",
            category="General",
            buying_price=Decimal("10.00"),
            mrp=Decimal("20.00"),
            selling_price=Decimal("18.00"),
            stock_quantity=5,
            low_stock_threshold=1,
            unit="pcs",
        ),
        user_a,
        db_session,
    )
    create_product(
        ProductCreate(
            name="Tenant B Product",
            sku="TENANTB",
            category="General",
            buying_price=Decimal("10.00"),
            mrp=Decimal("20.00"),
            selling_price=Decimal("18.00"),
            stock_quantity=5,
            low_stock_threshold=1,
            unit="pcs",
        ),
        user_b,
        db_session,
    )

    response = client.get("/api/v1/audit-logs", headers=auth_headers(user_a.email))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["shop_id"] == user_a.shop_id
    assert body["items"][0]["after_data"]["sku"] == "TENANTA"


def test_business_audit_sanitizes_sensitive_fields(db_session, make_user):
    user = make_user(email="audit-sensitive@example.com")

    record_business_audit(
        db_session,
        shop_id=user.shop_id,
        actor=user,
        action=BusinessAuditAction.PRODUCT_UPDATED,
        entity_type="product",
        entity_id=123,
        summary="Sensitive test",
        before_data={"selling_price": Decimal("10.00"), "password": "secret"},
        after_data={"selling_price": Decimal("12.00"), "api_key": "abc123"},
        metadata={"authorization": "Bearer token", "safe_note": "ok"},
    )
    db_session.commit()

    entry = _audit_entries(db_session)[-1]
    assert entry.before_data["password"] == "<REDACTED>"
    assert entry.after_data["api_key"] == "<REDACTED>"
    assert entry.audit_metadata["authorization"] == "<REDACTED>"
    assert entry.audit_metadata["safe_note"] == "ok"


def test_audit_failure_prevents_false_business_commit(db_session, make_user, monkeypatch):
    user = make_user(email="audit-failure@example.com")
    product = _make_product(db_session, user.shop_id, sku="AFAIL")

    def fail_audit(*args, **kwargs):
        raise RuntimeError("forced audit failure")

    monkeypatch.setattr(invoice_service, "record_business_audit", fail_audit)

    with pytest.raises(RuntimeError):
        create_invoice(_invoice_payload(product), db_session, user)

    db_session.rollback()
    assert db_session.query(Invoice).count() == 0
    assert db_session.query(BusinessAuditLog).count() == 0
