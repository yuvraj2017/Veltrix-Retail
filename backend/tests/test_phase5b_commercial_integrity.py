from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.subscription_status import BillingInterval, LicenseStatus, SubscriptionStatus
from app.models.commercial_event import (
    PaymentGatewayConfig,
    PaymentWebhookEvent,
    SubscriptionEvent,
    SubscriptionPayment,
    SubscriptionPaymentStatus,
)
from app.models.license import ShopLicense
from app.models.plan import Plan
from app.models.subscription import ShopSubscription
from app.schemas.subscription import PaymentCreateRequest
from app.schemas.subscription import CheckoutSessionRequest
from app.services import commercial_service
from app.services.commercial_transition_service import (
    ADMIN_SUBSCRIPTION_TRANSITIONS,
    CommercialTransitionError,
    as_utc,
    transition_payment,
    transition_subscription,
)
from app.services.license_service import create_license_for_subscription
from app.services.secret_service import encrypt_secret


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _plan(db, code: str = "phase5b") -> Plan:
    plan = Plan(
        code=code,
        name=code.title(),
        monthly_price=Decimal("100.00"),
        annual_price=Decimal("1000.00"),
        currency="INR",
        is_active=True,
        is_archived=False,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _subscription(db, shop_id: int, plan: Plan, *, expires_at=None) -> ShopSubscription:
    subscription = ShopSubscription(
        shop_id=shop_id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        billing_interval=BillingInterval.MONTHLY,
        current_period_start=_now(),
        current_period_end=expires_at,
    )
    db.add(subscription)
    db.flush()
    license_row, _ = create_license_for_subscription(
        db=db,
        subscription=subscription,
        status=LicenseStatus.ACTIVE,
    )
    license_row.expires_at = expires_at
    db.commit()
    db.refresh(subscription)
    return subscription


def _manual_payment(shop_id: int, plan_id: int, payment_id: str, **overrides) -> PaymentCreateRequest:
    values = {
        "shop_id": shop_id,
        "plan_id": plan_id,
        "amount": Decimal("100.00"),
        "currency": "INR",
        "billing_interval": BillingInterval.MONTHLY,
        "provider": "manual",
        "provider_payment_id": payment_id,
        "status": SubscriptionPaymentStatus.SUCCEEDED,
        "reason": "Settlement verified against bank statement",
    }
    values.update(overrides)
    return PaymentCreateRequest(**values)


@pytest.mark.parametrize(
    ("old_status", "new_status"),
    [
        (old_status, new_status)
        for old_status, next_statuses in ADMIN_SUBSCRIPTION_TRANSITIONS.items()
        for new_status in next_statuses
    ],
)
def test_every_allowed_subscription_transition(old_status, new_status):
    subscription = ShopSubscription(status=old_status)

    transition_subscription(subscription, new_status, reason="Commercial review completed")

    assert subscription.status == new_status
    if new_status == SubscriptionStatus.CANCELLED:
        assert subscription.cancelled_at is not None


def test_invalid_subscription_and_payment_transitions_fail_closed():
    subscription = ShopSubscription(status=SubscriptionStatus.CANCELLED)
    payment = SubscriptionPayment(status=SubscriptionPaymentStatus.FAILED)

    with pytest.raises(CommercialTransitionError):
        transition_subscription(subscription, SubscriptionStatus.ACTIVE, reason="Not allowed")
    with pytest.raises(CommercialTransitionError):
        transition_subscription(subscription, "unknown", reason="Not allowed")
    with pytest.raises(CommercialTransitionError):
        transition_payment(payment, SubscriptionPaymentStatus.SUCCEEDED)


def test_revoked_license_is_terminal_for_payment_and_replacement_is_explicit(
    db_session, make_shop, super_admin
):
    shop = make_shop("Revoked License Shop")
    plan = _plan(db_session, "revoked-license")
    original_expiry = _now() + timedelta(days=12)
    subscription = _subscription(db_session, shop.id, plan, expires_at=original_expiry)
    revoked = db_session.query(ShopLicense).filter_by(subscription_id=subscription.id).one()
    revoked.status = LicenseStatus.REVOKED
    revoked.revoked_at = _now()
    revoked_at = revoked.revoked_at
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        commercial_service.record_payment(
            db_session,
            _manual_payment(shop.id, plan.id, "revoked-payment"),
            super_admin,
        )

    assert exc.value.status_code == 409
    db_session.expire_all()
    assert db_session.query(SubscriptionPayment).filter_by(provider_payment_id="revoked-payment").count() == 0
    persisted = db_session.get(ShopLicense, revoked.id)
    assert persisted.status == LicenseStatus.REVOKED
    assert as_utc(persisted.revoked_at) == as_utc(revoked_at)
    assert as_utc(db_session.get(ShopSubscription, subscription.id).current_period_end) == as_utc(original_expiry)

    replacement = commercial_service.issue_replacement_license(
        db_session,
        subscription.id,
        super_admin,
        reason="Compromised key replaced after explicit review",
    )
    assert replacement.status == LicenseStatus.PENDING
    commercial_service.record_payment(
        db_session,
        _manual_payment(shop.id, plan.id, "replacement-payment"),
        super_admin,
    )
    db_session.refresh(replacement)
    db_session.refresh(persisted)
    assert replacement.status == LicenseStatus.ACTIVE
    assert replacement.expires_at is not None
    assert persisted.status == LicenseStatus.REVOKED
    assert as_utc(persisted.revoked_at) == as_utc(revoked_at)


def test_early_same_plan_renewal_preserves_remaining_term_and_is_idempotent(
    db_session, make_shop, super_admin
):
    shop = make_shop("Renewal Shop")
    plan = _plan(db_session, "renewal")
    original_expiry = _now() + timedelta(days=20)
    subscription = _subscription(db_session, shop.id, plan, expires_at=original_expiry)

    request = _manual_payment(shop.id, plan.id, "renewal-one")
    first = commercial_service.record_payment(db_session, request, super_admin)
    first_expiry = as_utc(db_session.get(ShopSubscription, subscription.id).current_period_end)
    assert first_expiry == as_utc(original_expiry) + timedelta(days=30)

    duplicate = commercial_service.record_payment(db_session, request, super_admin)
    db_session.refresh(subscription)
    assert duplicate.id == first.id
    assert as_utc(subscription.current_period_end) == first_expiry

    commercial_service.record_payment(
        db_session,
        _manual_payment(shop.id, plan.id, "renewal-two"),
        super_admin,
    )
    db_session.refresh(subscription)
    assert as_utc(subscription.current_period_end) == first_expiry + timedelta(days=30)
    assert (
        db_session.query(SubscriptionEvent)
        .filter_by(subscription_id=subscription.id, event_type="payment_renewed")
        .count()
        == 2
    )


def test_cross_plan_payment_is_rejected_without_commercial_mutation(
    db_session, make_shop, super_admin
):
    shop = make_shop("Cross Plan Payment Shop")
    current_plan = _plan(db_session, "cross-plan-current")
    requested_plan = _plan(db_session, "cross-plan-requested")
    original_expiry = _now() + timedelta(days=90)
    subscription = _subscription(
        db_session,
        shop.id,
        current_plan,
        expires_at=original_expiry,
    )
    license_row = db_session.query(ShopLicense).filter_by(
        subscription_id=subscription.id
    ).one()

    with pytest.raises(HTTPException) as exc:
        commercial_service.record_payment(
            db_session,
            _manual_payment(shop.id, requested_plan.id, "cross-plan-payment"),
            super_admin,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "PLAN_CHANGE_NOT_SUPPORTED"
    db_session.expire_all()
    persisted = db_session.get(ShopSubscription, subscription.id)
    persisted_license = db_session.get(ShopLicense, license_row.id)
    assert persisted.plan_id == current_plan.id
    assert as_utc(persisted.current_period_end) == as_utc(original_expiry)
    assert persisted_license.status == LicenseStatus.ACTIVE
    assert as_utc(persisted_license.expires_at) == as_utc(original_expiry)
    assert db_session.query(SubscriptionPayment).count() == 0
    assert db_session.query(SubscriptionEvent).count() == 0


def test_cross_plan_checkout_is_rejected_before_gateway_access(
    db_session, make_shop, monkeypatch
):
    shop = make_shop("Cross Plan Checkout Shop")
    current_plan = _plan(db_session, "checkout-current")
    requested_plan = _plan(db_session, "checkout-requested")
    _subscription(
        db_session,
        shop.id,
        current_plan,
        expires_at=_now() + timedelta(days=90),
    )

    def fail_gateway_lookup(_db):
        raise AssertionError("gateway lookup must not run for an unsupported plan change")

    monkeypatch.setattr(commercial_service, "_active_payment_gateway", fail_gateway_lookup)
    with pytest.raises(HTTPException) as exc:
        commercial_service.create_checkout_session(
            db_session,
            shop.id,
            CheckoutSessionRequest(
                plan_id=requested_plan.id,
                billing_interval=BillingInterval.MONTHLY,
            ),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "PLAN_CHANGE_NOT_SUPPORTED"
    assert db_session.query(SubscriptionPayment).count() == 0


def test_shop_override_listing_does_not_take_commercial_write_lock(
    db_session, make_shop, monkeypatch
):
    shop = make_shop("Override Read Shop")

    def fail_lock(*_args, **_kwargs):
        raise AssertionError("read-only override listing must not lock the shop row")

    monkeypatch.setattr(commercial_service, "_lock_shop", fail_lock)

    assert commercial_service.list_shop_overrides(db_session, shop.id) == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount": Decimal("99.99")},
        {"currency": "USD"},
        {"billing_interval": "weekly"},
        {"provider": "razorpay"},
        {"reason": "  "},
        {"status": SubscriptionPaymentStatus.REFUNDED},
    ],
)
def test_manual_payment_requires_exact_commercial_data(
    db_session, make_shop, super_admin, overrides
):
    shop = make_shop("Strict Manual Payment Shop")
    plan = _plan(db_session, f"manual-{len(str(overrides))}")

    with pytest.raises((HTTPException, CommercialTransitionError)):
        commercial_service.record_payment(
            db_session,
            _manual_payment(shop.id, plan.id, f"invalid-{len(str(overrides))}", **overrides),
            super_admin,
        )

    assert db_session.query(SubscriptionPayment).count() == 0


def test_reused_manual_identifier_with_different_terms_is_rejected(
    db_session, make_shop, super_admin
):
    shop = make_shop("Identifier Shop")
    plan = _plan(db_session, "identifier")
    commercial_service.record_payment(
        db_session,
        _manual_payment(shop.id, plan.id, "same-id"),
        super_admin,
    )

    with pytest.raises(HTTPException) as exc:
        commercial_service.record_payment(
            db_session,
            _manual_payment(
                shop.id,
                plan.id,
                "same-id",
                amount=Decimal("1000.00"),
                billing_interval=BillingInterval.ANNUAL,
            ),
            super_admin,
        )

    assert exc.value.status_code == 409
    assert db_session.query(SubscriptionPayment).filter_by(provider_payment_id="same-id").count() == 1


def test_manual_payment_audit_failure_rolls_back_all_commercial_state(
    db_session, make_shop, super_admin, monkeypatch
):
    shop = make_shop("Atomic Payment Shop")
    plan = _plan(db_session, "atomic-payment")

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(commercial_service, "_audit", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        commercial_service.record_payment(
            db_session,
            _manual_payment(shop.id, plan.id, "atomic-payment"),
            super_admin,
        )

    assert db_session.query(SubscriptionPayment).count() == 0
    assert db_session.query(ShopSubscription).count() == 0
    assert db_session.query(ShopLicense).count() == 0


def _webhook_payload(event_id: str, order_id: str, payment_id: str, amount: int = 10000) -> bytes:
    return json.dumps(
        {
            "id": event_id,
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "order_id": order_id,
                        "amount": amount,
                        "currency": "INR",
                    }
                }
            },
        },
        separators=(",", ":"),
    ).encode()


def _razorpay_setup(db, shop_id: int, plan: Plan, order_id: str):
    secret = "phase5b-webhook-secret"
    db.add(
        PaymentGatewayConfig(
            provider="razorpay",
            display_name="Razorpay",
            is_active=True,
            is_test_mode=True,
            webhook_secret_encrypted=encrypt_secret(secret),
        )
    )
    payment = SubscriptionPayment(
        shop_id=shop_id,
        plan_id=plan.id,
        provider="razorpay",
        provider_payment_id=order_id,
        provider_order_id=order_id,
        status=SubscriptionPaymentStatus.PENDING,
        amount=Decimal("100.00"),
        currency="INR",
        billing_interval=BillingInterval.MONTHLY,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment, secret


def test_webhook_event_is_durable_and_duplicate_does_not_reapply(
    db_session, make_shop
):
    shop = make_shop("Webhook Shop")
    plan = _plan(db_session, "webhook")
    payment, secret = _razorpay_setup(db_session, shop.id, plan, "order-webhook")
    body = _webhook_payload("event-one", "order-webhook", "payment-one")
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    first = commercial_service.handle_razorpay_webhook(
        db=db_session, raw_body=body, signature=signature
    )
    second = commercial_service.handle_razorpay_webhook(
        db=db_session, raw_body=body, signature=signature
    )

    assert first["status"] == "processed"
    assert second["status"] == "duplicate"
    db_session.refresh(payment)
    assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
    assert db_session.query(PaymentWebhookEvent).count() == 1
    assert db_session.query(SubscriptionEvent).count() == 1


def test_failed_webhook_processing_is_retryable_without_completed_marker(
    db_session, make_shop
):
    shop = make_shop("Webhook Retry Shop")
    plan = _plan(db_session, "webhook-retry")
    payment, secret = _razorpay_setup(db_session, shop.id, plan, "order-retry")
    invalid = _webhook_payload("event-retry", "order-retry", "payment-retry", amount=9999)
    invalid_signature = hmac.new(secret.encode(), invalid, hashlib.sha256).hexdigest()

    with pytest.raises(HTTPException) as exc:
        commercial_service.handle_razorpay_webhook(
            db=db_session, raw_body=invalid, signature=invalid_signature
        )
    assert exc.value.status_code == 409
    assert db_session.query(PaymentWebhookEvent).count() == 0

    valid = _webhook_payload("event-retry", "order-retry", "payment-retry")
    valid_signature = hmac.new(secret.encode(), valid, hashlib.sha256).hexdigest()
    result = commercial_service.handle_razorpay_webhook(
        db=db_session, raw_body=valid, signature=valid_signature
    )

    assert result["status"] == "processed"
    db_session.refresh(payment)
    assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
    assert db_session.query(PaymentWebhookEvent).filter_by(status="applied").count() == 1
