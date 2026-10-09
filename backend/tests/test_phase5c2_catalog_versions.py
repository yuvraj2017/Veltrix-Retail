import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.subscription_status import BillingInterval, SubscriptionStatus
from app.models.commercial_event import PaymentGatewayConfig, SubscriptionPayment
from app.models.entitlement import EntitlementDefinition, EntitlementKind, EntitlementValueType
from app.models.plan_catalog import PlanCatalogEntitlementSnapshot, PlanCatalogVersion
from app.models.subscription import ShopSubscription
from app.schemas.subscription import (
    CatalogEntitlementSnapshotRequest,
    CheckoutSessionRequest,
    EntitlementValuePayload,
    PaymentCreateRequest,
    PlanCatalogPublishRequest,
    PlanCreateRequest,
    PlanUpdateRequest,
    RazorpayVerifyPaymentRequest,
    ShopOverrideCreateRequest,
    SubscriptionAssignRequest,
)
from app.services import commercial_service
from app.services.entitlement_service import get_limit
from app.services.secret_service import encrypt_secret


def _now():
    return datetime.now(timezone.utc)


def _create_plan(db, actor, code="catalog", monthly="100.00"):
    return commercial_service.create_plan(
        db,
        PlanCreateRequest(
            code=code,
            name=f"{code.title()} Plan",
            monthly_price=Decimal(monthly),
            annual_price=Decimal("1000.00"),
            currency="INR",
            trial_days=7,
            grace_period_days=3,
        ),
        actor,
    )


def _publish(db, actor, plan, *, monthly="200.00", entitlements=None):
    return commercial_service.publish_plan_catalog_version(
        db,
        plan.id,
        PlanCatalogPublishRequest(
            monthly_price=Decimal(monthly),
            annual_price=Decimal("2000.00"),
            currency="INR",
            trial_days=7,
            grace_period_days=3,
            entitlements=entitlements or [],
        ),
        actor,
    )


def _definition(db, key="products.max"):
    row = EntitlementDefinition(
        key=key,
        name="Maximum products",
        kind=EntitlementKind.LIMIT,
        value_type=EntitlementValueType.INTEGER,
        resource_key="products",
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_plan_creation_publishes_baseline_and_direct_price_edit_is_rejected(
    db_session, super_admin
):
    plan = _create_plan(db_session, super_admin)
    baseline = db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).one()

    assert baseline.version_number == 1
    assert baseline.status == "published"
    assert baseline.monthly_price == Decimal("100.00")

    with pytest.raises(HTTPException) as exc:
        commercial_service.update_plan(
            db_session,
            plan.id,
            PlanUpdateRequest(monthly_price=Decimal("999.00")),
            super_admin,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "CATALOG_PUBLICATION_REQUIRED"
    db_session.refresh(baseline)
    assert baseline.monthly_price == Decimal("100.00")


def test_publication_snapshots_entitlements_and_grandfathers_existing_subscription(
    db_session, make_shop, super_admin
):
    shop = make_shop("Catalog Grandfather Shop")
    plan = _create_plan(db_session, super_admin, code="grandfather")
    definition = _definition(db_session)
    commercial_service.upsert_plan_entitlement(
        db_session,
        plan.id,
        definition.id,
        EntitlementValuePayload(limit_value=Decimal("10")),
        super_admin,
    )
    contracted = (
        db_session.query(PlanCatalogVersion)
        .filter_by(plan_id=plan.id)
        .order_by(PlanCatalogVersion.version_number.desc())
        .first()
    )
    subscription = commercial_service.assign_shop_subscription(
        db_session,
        shop.id,
        SubscriptionAssignRequest(
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTHLY,
            current_period_start=_now(),
            current_period_end=_now() + timedelta(days=30),
            reason="Initial contracted catalog assignment",
        ),
        super_admin,
    )
    assert subscription.catalog_version_id == contracted.id

    latest = _publish(
        db_session,
        super_admin,
        plan,
        entitlements=[
            CatalogEntitlementSnapshotRequest(
                entitlement_id=definition.id,
                limit_value=Decimal("5"),
            )
        ],
    )

    assert latest.id != contracted.id
    assert get_limit(shop.id, "products", db_session).limit_value == Decimal("10")
    old_snapshot = (
        db_session.query(PlanCatalogEntitlementSnapshot)
        .filter_by(catalog_version_id=contracted.id, entitlement_id=definition.id)
        .one()
    )
    assert old_snapshot.limit_value == Decimal("10")

    commercial_service.create_shop_override(
        db_session,
        shop.id,
        ShopOverrideCreateRequest(
            entitlement_id=definition.id,
            limit_value=Decimal("12"),
            reason="Contractual exception",
        ),
        super_admin,
    )
    effective = get_limit(shop.id, "products", db_session)
    assert effective.source == "override"
    assert effective.limit_value == Decimal("12")


def test_checkout_payment_stays_bound_after_new_publication_and_archive(
    db_session, make_shop, super_admin, monkeypatch
):
    shop = make_shop("Version Bound Checkout")
    plan = _create_plan(db_session, super_admin, code="checkout-bound")
    baseline = db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).one()
    secret = "catalog-checkout-secret"
    db_session.add(
        PaymentGatewayConfig(
            provider="razorpay",
            display_name="Razorpay",
            is_active=True,
            is_test_mode=True,
            key_id="rzp_catalog",
            key_secret_encrypted=encrypt_secret(secret),
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        commercial_service,
        "_create_razorpay_order",
        lambda **_kwargs: {
            "id": "order_catalog_bound",
            "amount": 10000,
            "currency": "INR",
        },
    )

    checkout = commercial_service.create_checkout_session(
        db_session,
        shop.id,
        CheckoutSessionRequest(
            plan_id=plan.id,
            catalog_version_id=baseline.id,
            billing_interval=BillingInterval.MONTHLY,
        ),
    )
    _publish(db_session, super_admin, plan, monthly="250.00")
    commercial_service.update_plan(
        db_session,
        plan.id,
        PlanUpdateRequest(is_active=False, is_archived=True),
        super_admin,
    )

    payment_id = "pay_catalog_bound"
    signature = hmac.new(
        secret.encode(),
        f"{checkout.metadata['order_id']}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    result = commercial_service.verify_razorpay_payment(
        db_session,
        shop.id,
        RazorpayVerifyPaymentRequest(
            razorpay_order_id=str(checkout.metadata["order_id"]),
            razorpay_payment_id=payment_id,
            razorpay_signature=signature,
        ),
    )

    payment = db_session.query(SubscriptionPayment).one()
    subscription = db_session.query(ShopSubscription).filter_by(shop_id=shop.id).one()
    assert result.status == "verified"
    assert payment.catalog_version_id == baseline.id
    assert payment.amount == Decimal("100.00")
    assert subscription.catalog_version_id == baseline.id


def test_same_plan_renewal_keeps_contracted_version_and_paid_time(
    db_session, make_shop, super_admin
):
    shop = make_shop("Catalog Renewal Shop")
    plan = _create_plan(db_session, super_admin, code="renew-catalog")
    baseline = db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).one()
    original_expiry = _now() + timedelta(days=20)
    subscription = commercial_service.assign_shop_subscription(
        db_session,
        shop.id,
        SubscriptionAssignRequest(
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTHLY,
            current_period_start=_now(),
            current_period_end=original_expiry,
            reason="Paid subscription fixture",
        ),
        super_admin,
    )
    latest = _publish(db_session, super_admin, plan, monthly="300.00")

    payment = commercial_service.record_payment(
        db_session,
        PaymentCreateRequest(
            shop_id=shop.id,
            plan_id=plan.id,
            catalog_version_id=latest.id,
            amount=Decimal("100.00"),
            currency="INR",
            billing_interval=BillingInterval.MONTHLY,
            provider="manual",
            provider_payment_id="catalog-renewal",
            status="succeeded",
            reason="Bank settlement verified",
        ),
        super_admin,
    )

    db_session.refresh(subscription)
    assert payment.catalog_version_id == baseline.id
    assert subscription.catalog_version_id == baseline.id
    assert subscription.current_period_end.replace(tzinfo=timezone.utc) >= original_expiry + timedelta(days=30)


def test_forged_foreign_plan_catalog_version_is_rejected(
    db_session, make_shop, super_admin
):
    shop = make_shop("Forged Catalog Shop")
    plan = _create_plan(db_session, super_admin, code="forged-primary")
    other = _create_plan(db_session, super_admin, code="forged-other")
    foreign_version = db_session.query(PlanCatalogVersion).filter_by(plan_id=other.id).one()

    with pytest.raises(HTTPException) as exc:
        commercial_service.create_checkout_session(
            db_session,
            shop.id,
            CheckoutSessionRequest(
                plan_id=plan.id,
                catalog_version_id=foreign_version.id,
                billing_interval=BillingInterval.MONTHLY,
            ),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "CATALOG_VERSION_NOT_PURCHASABLE"


def test_historical_payment_without_version_remains_explicitly_unbound(
    db_session, make_shop, super_admin
):
    shop = make_shop("Historical Payment Shop")
    plan = _create_plan(db_session, super_admin, code="historical")
    historical = SubscriptionPayment(
        shop_id=shop.id,
        plan_id=plan.id,
        catalog_version_id=None,
        provider="manual",
        provider_payment_id="historical-unbound",
        status="succeeded",
        amount=Decimal("100.00"),
        currency="INR",
        billing_interval=BillingInterval.MONTHLY,
        paid_at=_now(),
    )
    db_session.add(historical)
    db_session.commit()

    assert historical.catalog_version_id is None
    assert db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).count() == 1


def test_historical_pending_payment_is_not_repriced_by_new_publication(
    db_session, make_shop, super_admin
):
    shop = make_shop("Historical Pending Shop")
    plan = _create_plan(db_session, super_admin, code="historical-pending")
    baseline = db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).one()
    secret = "historical-payment-secret"
    db_session.add(
        PaymentGatewayConfig(
            provider="razorpay",
            display_name="Razorpay",
            is_active=True,
            is_test_mode=True,
            key_id="rzp_historical",
            key_secret_encrypted=encrypt_secret(secret),
        )
    )
    historical = SubscriptionPayment(
        shop_id=shop.id,
        plan_id=plan.id,
        catalog_version_id=None,
        provider="razorpay",
        provider_payment_id="order_historical_pending",
        provider_order_id="order_historical_pending",
        status="pending",
        amount=Decimal("100.00"),
        currency="INR",
        billing_interval=BillingInterval.MONTHLY,
    )
    db_session.add(historical)
    db_session.commit()
    _publish(db_session, super_admin, plan, monthly="250.00")

    provider_payment_id = "pay_historical_pending"
    signature = hmac.new(
        secret.encode(),
        f"{historical.provider_order_id}|{provider_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    result = commercial_service.verify_razorpay_payment(
        db_session,
        shop.id,
        RazorpayVerifyPaymentRequest(
            razorpay_order_id=historical.provider_order_id,
            razorpay_payment_id=provider_payment_id,
            razorpay_signature=signature,
        ),
    )

    subscription = db_session.query(ShopSubscription).filter_by(shop_id=shop.id).one()
    assert result.status == "verified"
    assert historical.catalog_version_id is None
    assert subscription.catalog_version_id == baseline.id


def test_database_rejects_cross_plan_catalog_binding(db_session, make_shop, super_admin):
    shop = make_shop("Cross Plan Catalog Constraint")
    plan = _create_plan(db_session, super_admin, code="constraint-primary")
    other = _create_plan(db_session, super_admin, code="constraint-other")
    foreign_version = db_session.query(PlanCatalogVersion).filter_by(plan_id=other.id).one()
    db_session.add(
        SubscriptionPayment(
            shop_id=shop.id,
            plan_id=plan.id,
            catalog_version_id=foreign_version.id,
            provider="manual",
            provider_payment_id="cross-plan-catalog-binding",
            status="pending",
            amount=Decimal("100.00"),
            currency="INR",
            billing_interval=BillingInterval.MONTHLY,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
