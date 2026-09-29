"""Subscription and license status vocabulary.

This module is deliberately small and central. Entitlement checks should ask
these helpers whether a subscription/license can access entitlements instead
of scattering status comparisons through services.
"""

from __future__ import annotations


class SubscriptionStatus:
    PENDING = "pending"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    GRACE_PERIOD = "grace_period"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

    ALL = (
        PENDING,
        ACTIVE,
        PAST_DUE,
        GRACE_PERIOD,
        SUSPENDED,
        EXPIRED,
        CANCELLED,
    )


class LicenseStatus:
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    REVOKED = "revoked"

    ALL = (PENDING, ACTIVE, SUSPENDED, EXPIRED, REVOKED)


class BillingInterval:
    MONTHLY = "monthly"
    ANNUAL = "annual"
    LEGACY = "legacy"

    ALL = (MONTHLY, ANNUAL, LEGACY)


ENTITLEMENT_ALLOWED_SUBSCRIPTION_STATUSES = (
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.GRACE_PERIOD,
)

ENTITLEMENT_ALLOWED_LICENSE_STATUSES = (LicenseStatus.ACTIVE,)


def normalize_subscription_status(value: str | None) -> str:
    if not value:
        return SubscriptionStatus.PENDING
    candidate = str(value).strip().lower()
    return candidate if candidate in SubscriptionStatus.ALL else SubscriptionStatus.PENDING


def normalize_license_status(value: str | None) -> str:
    if not value:
        return LicenseStatus.PENDING
    candidate = str(value).strip().lower()
    return candidate if candidate in LicenseStatus.ALL else LicenseStatus.PENDING


def subscription_allows_entitlements(value: str | None) -> bool:
    return normalize_subscription_status(value) in ENTITLEMENT_ALLOWED_SUBSCRIPTION_STATUSES


def license_allows_entitlements(value: str | None) -> bool:
    return normalize_license_status(value) in ENTITLEMENT_ALLOWED_LICENSE_STATUSES
