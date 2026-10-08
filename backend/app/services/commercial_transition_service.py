from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.subscription_status import BillingInterval, SubscriptionStatus
from app.models.commercial_event import SubscriptionPayment, SubscriptionPaymentStatus
from app.models.subscription import ShopSubscription


class CommercialTransitionError(ValueError):
    pass


ADMIN_SUBSCRIPTION_TRANSITIONS = {
    SubscriptionStatus.PENDING: {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.CANCELLED,
    },
    SubscriptionStatus.ACTIVE: {
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.GRACE_PERIOD,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.CANCELLED,
    },
    SubscriptionStatus.PAST_DUE: {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.GRACE_PERIOD,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.CANCELLED,
    },
    SubscriptionStatus.GRACE_PERIOD: {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.CANCELLED,
    },
    SubscriptionStatus.SUSPENDED: {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.CANCELLED,
    },
    SubscriptionStatus.EXPIRED: {SubscriptionStatus.CANCELLED},
    SubscriptionStatus.CANCELLED: set(),
}

PAYMENT_TRANSITIONS = {
    SubscriptionPaymentStatus.PENDING: {
        SubscriptionPaymentStatus.SUBMITTED,
        SubscriptionPaymentStatus.SUCCEEDED,
        SubscriptionPaymentStatus.FAILED,
    },
    SubscriptionPaymentStatus.SUBMITTED: {
        SubscriptionPaymentStatus.SUCCEEDED,
        SubscriptionPaymentStatus.FAILED,
    },
    SubscriptionPaymentStatus.SUCCEEDED: {SubscriptionPaymentStatus.REFUNDED},
    SubscriptionPaymentStatus.FAILED: set(),
    SubscriptionPaymentStatus.REFUNDED: set(),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def require_reason(reason: str | None) -> str:
    normalized = (reason or "").strip()
    if not normalized:
        raise CommercialTransitionError("A reason is required for this commercial change")
    return normalized


def transition_subscription(
    subscription: ShopSubscription,
    new_status: str,
    *,
    reason: str | None,
    operation: str = "admin",
    effective_at: datetime | None = None,
) -> str:
    if new_status not in SubscriptionStatus.ALL:
        raise CommercialTransitionError("Invalid subscription status")
    if subscription.status not in SubscriptionStatus.ALL:
        raise CommercialTransitionError("Current subscription status is invalid")

    normalized_reason = require_reason(reason)
    previous = subscription.status
    if previous == new_status:
        raise CommercialTransitionError(f"Subscription is already {new_status}")

    if operation == "payment":
        if new_status != SubscriptionStatus.ACTIVE:
            raise CommercialTransitionError("Payment processing may only activate a subscription")
    elif new_status not in ADMIN_SUBSCRIPTION_TRANSITIONS.get(previous, set()):
        raise CommercialTransitionError(
            f"Cannot change subscription status from {previous} to {new_status}"
        )

    now = effective_at or utcnow()
    subscription.status = new_status
    if new_status == SubscriptionStatus.CANCELLED:
        subscription.cancelled_at = now
        subscription.cancel_at = subscription.cancel_at or now
    elif new_status == SubscriptionStatus.ACTIVE:
        subscription.cancelled_at = None
        subscription.cancel_at = None
    return normalized_reason


def transition_payment(
    payment: SubscriptionPayment,
    new_status: str,
    *,
    effective_at: datetime | None = None,
) -> None:
    if new_status not in SubscriptionPaymentStatus.ALL:
        raise CommercialTransitionError("Invalid payment status")
    if payment.status not in SubscriptionPaymentStatus.ALL:
        raise CommercialTransitionError("Current payment status is invalid")
    if new_status not in PAYMENT_TRANSITIONS.get(payment.status, set()):
        raise CommercialTransitionError(
            f"Cannot change payment status from {payment.status} to {new_status}"
        )

    now = effective_at or utcnow()
    payment.status = new_status
    if new_status == SubscriptionPaymentStatus.SUCCEEDED:
        payment.paid_at = payment.paid_at or now


def purchased_term(billing_interval: str) -> timedelta:
    if billing_interval == BillingInterval.MONTHLY:
        return timedelta(days=30)
    if billing_interval == BillingInterval.ANNUAL:
        return timedelta(days=365)
    raise CommercialTransitionError("Paid subscriptions require a monthly or annual interval")
