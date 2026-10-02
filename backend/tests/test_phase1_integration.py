from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.domain_errors import DomainErrorCode
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.invoice import Invoice
from app.models.product import Product
from app.models.subscription import ShopSubscription
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.services.invoice_service import create_invoice, update_invoice


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _make_product(db_session, shop_id: int, *, sku: str, stock_quantity: int = 10) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Phase 1 {sku}",
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


def _invoice_payload(product: Product, quantity=1, *, invoice_status: str = "saved") -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "customer": {
                "first_name": "Phase",
                "last_name": "One",
                "phone": "9000000002",
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
            "invoice_status": invoice_status,
        }
    )


def _invoice_api_payload(product: Product, quantity=1, *, invoice_status: str = "saved") -> dict:
    return {
        "customer": {
            "first_name": "Phase",
            "last_name": "One",
            "phone": "9000000002",
        },
        "items": [
            {
                "product_id": product.id,
                "product_code": product.sku,
                "quantity": str(quantity),
                "discount_percentage": "0",
            }
        ],
        "invoice_date": "2026-09-27",
        "payment_status": "pending",
        "payment_mode": "cash",
        "paid_amount": "0",
        "total_tax_amount": "0",
        "invoice_status": invoice_status,
    }


def _expire_subscription(db_session, shop_id: int):
    subscription = (
        db_session.query(ShopSubscription)
        .filter(ShopSubscription.shop_id == shop_id)
        .order_by(ShopSubscription.created_at.desc(), ShopSubscription.id.desc())
        .first()
    )
    assert subscription is not None
    subscription.current_period_end = _utcnow() - timedelta(days=30)
    subscription.plan.grace_period_days = 0
    db_session.commit()


def _stock(db_session, product: Product) -> int:
    db_session.refresh(product)
    return product.stock_quantity


def test_active_tenant_invoice_stock_number_and_audit_work_together(db_session, make_user):
    user = make_user(email="phase1-active-flow@example.com")
    product = _make_product(db_session, user.shop_id, sku="P1ACTIVE", stock_quantity=5)

    invoice = create_invoice(
        _invoice_payload(product, quantity=2, invoice_status="draft"),
        db_session,
        user,
    )

    assert invoice.invoice_number == "INV-20260927-001"
    assert _stock(db_session, product) == 3

    audit = (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.shop_id == user.shop_id,
            BusinessAuditLog.action == BusinessAuditAction.INVOICE_CREATED,
            BusinessAuditLog.entity_id == invoice.id,
        )
        .one()
    )
    assert audit.after_data["invoice_number"] == invoice.invoice_number


def test_expired_tenant_invoice_api_rejects_before_business_mutation(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1-expired-flow@example.com")
    product = _make_product(db_session, user.shop_id, sku="P1EXP", stock_quantity=5)
    _expire_subscription(db_session, user.shop_id)

    response = client.post(
        "/api/v1/invoices",
        json=_invoice_api_payload(product, quantity=2),
        headers=auth_headers(user.email),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_EXPIRED
    assert _stock(db_session, product) == 5
    assert db_session.query(Invoice).count() == 0
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.INVOICE_CREATED)
        .count()
        == 0
    )


def test_insufficient_stock_leaves_no_successful_invoice_audit(db_session, make_user):
    user = make_user(email="phase1-insufficient-flow@example.com")
    product = _make_product(db_session, user.shop_id, sku="P1LOW", stock_quantity=1)

    with pytest.raises(HTTPException):
        create_invoice(_invoice_payload(product, quantity=2), db_session, user)

    db_session.rollback()
    assert _stock(db_session, product) == 1
    assert db_session.query(Invoice).count() == 0
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.INVOICE_CREATED)
        .count()
        == 0
    )


def test_invoice_update_adjusts_stock_and_records_audit(db_session, make_user):
    user = make_user(email="phase1-update-flow@example.com")
    product = _make_product(db_session, user.shop_id, sku="P1EDIT", stock_quantity=10)
    invoice = create_invoice(
        _invoice_payload(product, quantity=2, invoice_status="draft"),
        db_session,
        user,
    )

    update_invoice(
        invoice.id,
        InvoiceUpdate.model_validate(
            {
                **_invoice_api_payload(product, quantity=4, invoice_status="draft"),
                "customer": {
                    "first_name": "Phase",
                    "last_name": "One",
                    "phone": "9000000002",
                },
            }
        ),
        db_session,
        user,
    )

    assert _stock(db_session, product) == 6
    assert (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.action == BusinessAuditAction.INVOICE_UPDATED,
            BusinessAuditLog.entity_id == invoice.id,
        )
        .count()
        == 1
    )


def test_tenant_a_cannot_access_tenant_b_invoice_or_audit(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user_a = make_user(email="phase1-tenant-a@example.com")
    user_b = make_user(email="phase1-tenant-b@example.com")
    product_b = _make_product(db_session, user_b.shop_id, sku="P1B", stock_quantity=5)
    invoice_b = create_invoice(_invoice_payload(product_b), db_session, user_b)

    headers_a = auth_headers(user_a.email)

    invoice_response = client.get(f"/api/v1/invoices/{invoice_b.id}", headers=headers_a)
    audit_response = client.get("/api/v1/audit-logs", headers=headers_a)

    assert invoice_response.status_code == 404
    assert audit_response.status_code == 200
    assert audit_response.json()["total"] == 0


def test_expired_tenant_can_still_access_subscription_recovery(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1-renewal-flow@example.com")
    _expire_subscription(db_session, user.shop_id)
    headers = auth_headers(user.email)

    assert client.get("/api/v1/subscription/me", headers=headers).status_code == 200
    assert client.get("/api/v1/subscription/plans", headers=headers).status_code == 200
