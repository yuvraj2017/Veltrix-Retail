from __future__ import annotations

import hashlib
import hmac
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.core.subscription_status import BillingInterval, LicenseStatus, SubscriptionStatus
from app.core.user_status import UserRole, UserStatus
from app.models.commercial_event import (
    PaymentGatewayConfig,
    PaymentWebhookEvent,
    SubscriptionEvent,
    SubscriptionPayment,
    SubscriptionPaymentStatus,
)
from app.models.license import ShopLicense
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.subscription import (
    PaymentCreateRequest,
    RazorpayVerifyPaymentRequest,
    UpiPaymentReviewRequest,
)
from app.services import commercial_service
from app.services.commercial_transition_service import as_utc
from app.services.license_service import create_license_for_subscription
from app.services.secret_service import encrypt_secret


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for Phase 5B concurrency verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database()")).scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Phase 5B concurrency tests refuse to run against ims_db")
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    yield engine, Session
    engine.dispose()


def _setup_commercial(Session, *, with_subscription: bool = False):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Phase5B {unique}", status="active")
        db.add(organization)
        db.flush()
        shop = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            status="active",
            name=f"Phase5B Shop {unique}",
            category="Test",
            email=f"shop-{unique}@example.com",
            phone="9000000000",
        )
        plan = Plan(
            code=f"phase5b-{unique}",
            name="Phase 5B",
            monthly_price=Decimal("100.00"),
            annual_price=Decimal("1000.00"),
            currency="INR",
            is_active=True,
            is_archived=False,
        )
        db.add_all([shop, plan])
        db.flush()
        catalog_version = commercial_service._ensure_baseline_catalog_version(db, plan)
        actor = User(
            shop_id=None,
            full_name="Phase 5B Platform Admin",
            email=f"admin-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(actor)
        db.flush()
        subscription_id = None
        license_id = None
        expiry = None
        if with_subscription:
            expiry = datetime.now(timezone.utc) + timedelta(days=20)
            subscription = ShopSubscription(
                shop_id=shop.id,
                plan_id=plan.id,
                catalog_version_id=catalog_version.id,
                status=SubscriptionStatus.ACTIVE,
                billing_interval=BillingInterval.MONTHLY,
                current_period_start=datetime.now(timezone.utc),
                current_period_end=expiry,
            )
            db.add(subscription)
            db.flush()
            license_row, _ = create_license_for_subscription(
                db=db,
                subscription=subscription,
                status=LicenseStatus.ACTIVE,
            )
            license_row.expires_at = expiry
            db.flush()
            subscription_id = subscription.id
            license_id = license_row.id
        db.commit()
        return {
            "shop_id": shop.id,
            "plan_id": plan.id,
            "actor_id": actor.id,
            "subscription_id": subscription_id,
            "license_id": license_id,
            "expiry": expiry,
            "unique": unique,
        }


def _manual_request(ids, payment_id):
    return PaymentCreateRequest(
        shop_id=ids["shop_id"],
        plan_id=ids["plan_id"],
        amount=Decimal("100.00"),
        currency="INR",
        billing_interval=BillingInterval.MONTHLY,
        provider="manual",
        provider_payment_id=payment_id,
        status=SubscriptionPaymentStatus.SUCCEEDED,
        reason="Concurrency settlement verification",
    )


def _configure_razorpay(db, *, key_secret: str, webhook_secret: str):
    config = db.query(PaymentGatewayConfig).filter_by(provider="razorpay").first()
    if config is None:
        config = PaymentGatewayConfig(provider="razorpay", display_name="Razorpay")
        db.add(config)
    config.is_active = True
    config.is_test_mode = True
    config.key_id = "phase5b-key"
    config.key_secret_encrypted = encrypt_secret(key_secret)
    config.webhook_secret_encrypted = encrypt_secret(webhook_secret)
    db.commit()


def _webhook(event_id, order_id, payment_id, *, amount=10000):
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


def test_concurrent_verify_and_webhook_apply_one_commercial_term(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session)
    order_id = f"order-{ids['unique']}"
    provider_payment_id = f"pay-{ids['unique']}"
    event_id = f"event-{ids['unique']}"
    key_secret = f"key-secret-{ids['unique']}"
    webhook_secret = f"webhook-secret-{ids['unique']}"
    with Session() as db:
        _configure_razorpay(db, key_secret=key_secret, webhook_secret=webhook_secret)
        db.add(
            SubscriptionPayment(
                shop_id=ids["shop_id"],
                plan_id=ids["plan_id"],
                provider="razorpay",
                provider_payment_id=order_id,
                provider_order_id=order_id,
                status=SubscriptionPaymentStatus.PENDING,
                amount=Decimal("100.00"),
                currency="INR",
                billing_interval=BillingInterval.MONTHLY,
            )
        )
        db.commit()

    checkout_signature = hmac.new(
        key_secret.encode(),
        f"{order_id}|{provider_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    body = _webhook(event_id, order_id, provider_payment_id)
    webhook_signature = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    barrier = threading.Barrier(2)

    def verify():
        with Session() as db:
            barrier.wait(timeout=10)
            return commercial_service.verify_razorpay_payment(
                db,
                ids["shop_id"],
                RazorpayVerifyPaymentRequest(
                    razorpay_order_id=order_id,
                    razorpay_payment_id=provider_payment_id,
                    razorpay_signature=checkout_signature,
                ),
            ).status

    def webhook():
        with Session() as db:
            barrier.wait(timeout=10)
            return commercial_service.handle_razorpay_webhook(
                db=db,
                raw_body=body,
                signature=webhook_signature,
            )["status"]

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(verify), executor.submit(webhook)]
        outcomes = [future.result(timeout=20) for future in results]

    with Session() as db:
        payment = db.query(SubscriptionPayment).filter_by(provider_order_id=order_id).one()
        assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
        assert db.query(ShopSubscription).filter_by(shop_id=ids["shop_id"]).count() == 1
        assert db.query(SubscriptionEvent).filter_by(shop_id=ids["shop_id"]).count() == 1
        assert db.query(PaymentWebhookEvent).filter_by(provider_event_id=event_id).count() == 1
        repeated = commercial_service.verify_razorpay_payment(
            db,
            ids["shop_id"],
            RazorpayVerifyPaymentRequest(
                razorpay_order_id=order_id,
                razorpay_payment_id=provider_payment_id,
                razorpay_signature=checkout_signature,
            ),
        )
        duplicate = commercial_service.handle_razorpay_webhook(
            db=db, raw_body=body, signature=webhook_signature
        )
    assert set(outcomes).issubset({"verified", "already_verified", "processed", "duplicate"})
    assert repeated.status == "already_verified"
    assert duplicate["status"] == "duplicate"


def test_concurrent_cross_plan_confirmation_requires_one_reconciliation(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session, with_subscription=True)
    with Session() as db:
        requested_plan = Plan(
            code=f"phase5b-cross-plan-{ids['unique']}",
            name="Phase 5B Cross Plan",
            monthly_price=Decimal("100.00"),
            annual_price=Decimal("1000.00"),
            currency="INR",
            is_active=True,
            is_archived=False,
        )
        db.add(requested_plan)
        db.flush()
        requested_plan_id = requested_plan.id
        order_id = f"cross-order-{ids['unique']}"
        provider_payment_id = f"cross-payment-{ids['unique']}"
        event_id = f"cross-event-{ids['unique']}"
        key_secret = f"cross-key-{ids['unique']}"
        webhook_secret = f"cross-webhook-{ids['unique']}"
        _configure_razorpay(
            db,
            key_secret=key_secret,
            webhook_secret=webhook_secret,
        )
        db.add(
            SubscriptionPayment(
                shop_id=ids["shop_id"],
                plan_id=requested_plan_id,
                provider="razorpay",
                provider_payment_id=order_id,
                provider_order_id=order_id,
                status=SubscriptionPaymentStatus.PENDING,
                amount=Decimal("100.00"),
                currency="INR",
                billing_interval=BillingInterval.MONTHLY,
            )
        )
        db.commit()

    checkout_signature = hmac.new(
        key_secret.encode(),
        f"{order_id}|{provider_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    body = _webhook(event_id, order_id, provider_payment_id)
    webhook_signature = hmac.new(
        webhook_secret.encode(), body, hashlib.sha256
    ).hexdigest()
    barrier = threading.Barrier(2)

    def verify():
        with Session() as db:
            barrier.wait(timeout=10)
            return commercial_service.verify_razorpay_payment(
                db,
                ids["shop_id"],
                RazorpayVerifyPaymentRequest(
                    razorpay_order_id=order_id,
                    razorpay_payment_id=provider_payment_id,
                    razorpay_signature=checkout_signature,
                ),
            ).status

    def webhook():
        with Session() as db:
            barrier.wait(timeout=10)
            return commercial_service.handle_razorpay_webhook(
                db=db,
                raw_body=body,
                signature=webhook_signature,
            )["status"]

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = [
            future.result(timeout=20)
            for future in (executor.submit(verify), executor.submit(webhook))
        ]

    with Session() as db:
        payment = db.query(SubscriptionPayment).filter_by(
            provider_order_id=order_id
        ).one()
        subscription = db.get(ShopSubscription, ids["subscription_id"])
        assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
        assert payment.subscription_id is None
        assert payment.failure_reason.startswith(
            commercial_service.RECONCILIATION_REQUIRED_PREFIX
        )
        assert subscription.plan_id == ids["plan_id"]
        assert as_utc(subscription.current_period_end) == as_utc(ids["expiry"])
        assert (
            db.query(SubscriptionEvent)
            .filter_by(
                subscription_id=subscription.id,
                event_type="payment_reconciliation_required",
            )
            .count()
            == 1
        )
        assert db.query(PaymentWebhookEvent).filter_by(
            provider_event_id=event_id
        ).count() == 1
    assert outcomes == ["reconciliation_required", "reconciliation_required"]


def test_concurrent_same_plan_renewals_preserve_both_terms(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session, with_subscription=True)
    barrier = threading.Barrier(2)

    def renew(index: int):
        with Session() as db:
            actor = db.get(User, ids["actor_id"])
            barrier.wait(timeout=10)
            return commercial_service.record_payment(
                db,
                _manual_request(ids, f"renew-{ids['unique']}-{index}"),
                actor,
            ).id

    with ThreadPoolExecutor(max_workers=2) as executor:
        payment_ids = list(executor.map(renew, range(2)))

    with Session() as db:
        subscription = db.get(ShopSubscription, ids["subscription_id"])
        event_count = (
            db.query(SubscriptionEvent)
            .filter_by(subscription_id=subscription.id, event_type="payment_renewed")
            .count()
        )
    assert len(set(payment_ids)) == 2
    assert as_utc(subscription.current_period_end) == as_utc(ids["expiry"]) + timedelta(days=60)
    assert event_count == 2


def test_license_revocation_race_never_resurrects_revoked_key(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session, with_subscription=True)
    barrier = threading.Barrier(2)

    def revoke():
        with Session() as db:
            actor = db.get(User, ids["actor_id"])
            barrier.wait(timeout=10)
            commercial_service.update_license_status(
                db,
                ids["license_id"],
                LicenseStatus.REVOKED,
                actor,
                reason="Concurrent compromise response",
            )
            return "revoked"

    def confirm_payment():
        with Session() as db:
            actor = db.get(User, ids["actor_id"])
            barrier.wait(timeout=10)
            try:
                commercial_service.record_payment(
                    db,
                    _manual_request(ids, f"revoke-race-{ids['unique']}"),
                    actor,
                )
                return "paid"
            except HTTPException as exc:
                db.rollback()
                return f"blocked:{exc.status_code}"

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(revoke), executor.submit(confirm_payment)]
        outcomes = [future.result(timeout=20) for future in futures]

    with Session() as db:
        license_row = db.get(ShopLicense, ids["license_id"])
        assert license_row.status == LicenseStatus.REVOKED
        assert license_row.revoked_at is not None
    assert "revoked" in outcomes


def test_concurrent_manual_upi_review_applies_once(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session)
    with Session() as db:
        payment = SubscriptionPayment(
            shop_id=ids["shop_id"],
            plan_id=ids["plan_id"],
            provider="upi_manual",
            provider_payment_id=f"upi-{ids['unique']}",
            provider_order_id=f"upi-{ids['unique']}",
            customer_reference=f"UTR{ids['unique'].upper()}",
            status=SubscriptionPaymentStatus.SUBMITTED,
            amount=Decimal("100.00"),
            currency="INR",
            billing_interval=BillingInterval.MONTHLY,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        db.commit()
        payment_id = payment.id
    barrier = threading.Barrier(2)

    def approve():
        with Session() as db:
            actor = db.get(User, ids["actor_id"])
            barrier.wait(timeout=10)
            return commercial_service.review_upi_payment(
                db,
                payment_id,
                UpiPaymentReviewRequest(
                    status=SubscriptionPaymentStatus.SUCCEEDED,
                    reason="UPI settlement reconciled",
                ),
                actor,
            ).status

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda _index: approve(), range(2)))

    with Session() as db:
        payment = db.get(SubscriptionPayment, payment_id)
        assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
        assert db.query(SubscriptionEvent).filter_by(shop_id=ids["shop_id"]).count() == 1
    assert sorted(outcomes) == ["already_verified", "verified"]


def test_postgresql_commercial_failure_rolls_back_every_required_record(pg, monkeypatch):
    _engine, Session = pg
    ids = _setup_commercial(Session)

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("forced audit failure")

    monkeypatch.setattr(commercial_service, "_audit", fail_audit)
    with Session() as db:
        actor = db.get(User, ids["actor_id"])
        with pytest.raises(RuntimeError, match="forced audit failure"):
            commercial_service.record_payment(
                db,
                _manual_request(ids, f"rollback-{ids['unique']}"),
                actor,
            )

    with Session() as db:
        assert db.query(SubscriptionPayment).filter_by(shop_id=ids["shop_id"]).count() == 0
        assert db.query(ShopSubscription).filter_by(shop_id=ids["shop_id"]).count() == 0
        assert db.query(ShopLicense).filter_by(shop_id=ids["shop_id"]).count() == 0


def test_postgresql_failed_webhook_is_retryable_after_atomic_rollback(pg):
    _engine, Session = pg
    ids = _setup_commercial(Session)
    order_id = f"retry-order-{ids['unique']}"
    payment_id = f"retry-payment-{ids['unique']}"
    event_id = f"retry-event-{ids['unique']}"
    key_secret = f"retry-key-{ids['unique']}"
    webhook_secret = f"retry-webhook-{ids['unique']}"
    with Session() as db:
        _configure_razorpay(db, key_secret=key_secret, webhook_secret=webhook_secret)
        db.add(
            SubscriptionPayment(
                shop_id=ids["shop_id"],
                plan_id=ids["plan_id"],
                provider="razorpay",
                provider_payment_id=order_id,
                provider_order_id=order_id,
                status=SubscriptionPaymentStatus.PENDING,
                amount=Decimal("100.00"),
                currency="INR",
                billing_interval=BillingInterval.MONTHLY,
            )
        )
        db.commit()

        invalid_body = _webhook(event_id, order_id, payment_id, amount=9999)
        invalid_signature = hmac.new(
            webhook_secret.encode(), invalid_body, hashlib.sha256
        ).hexdigest()
        with pytest.raises(HTTPException) as exc:
            commercial_service.handle_razorpay_webhook(
                db=db,
                raw_body=invalid_body,
                signature=invalid_signature,
            )
        assert exc.value.status_code == 409
        assert db.query(PaymentWebhookEvent).filter_by(provider_event_id=event_id).count() == 0

        valid_body = _webhook(event_id, order_id, payment_id)
        valid_signature = hmac.new(
            webhook_secret.encode(), valid_body, hashlib.sha256
        ).hexdigest()
        result = commercial_service.handle_razorpay_webhook(
            db=db,
            raw_body=valid_body,
            signature=valid_signature,
        )
        assert result["status"] == "processed"
        assert db.query(PaymentWebhookEvent).filter_by(provider_event_id=event_id).count() == 1
        payment = db.query(SubscriptionPayment).filter_by(provider_order_id=order_id).one()
        assert payment.status == SubscriptionPaymentStatus.SUCCEEDED
