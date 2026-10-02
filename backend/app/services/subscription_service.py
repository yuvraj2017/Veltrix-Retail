"""Subscription bootstrap helpers for the current application phase."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.subscription_status import BillingInterval, LicenseStatus, SubscriptionStatus
from app.models.entitlement import (
    EntitlementDefinition,
    EntitlementKind,
    EntitlementValueType,
    PlanEntitlement,
)
from app.models.plan import Plan
from app.models.subscription import ShopSubscription
from app.services.license_service import create_license_for_subscription

LEGACY_PLAN_CODE = "legacy"

DEFAULT_ENTITLEMENTS = (
    {
        "key": "products.max",
        "name": "Maximum products",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.INTEGER,
        "resource_key": "products",
    },
    {
        "key": "vendors.max",
        "name": "Maximum vendors",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.INTEGER,
        "resource_key": "vendors",
    },
    {
        "key": "orders.monthly.max",
        "name": "Maximum monthly orders",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.INTEGER,
        "resource_key": "orders.monthly",
    },
    {
        "key": "staff.max",
        "name": "Maximum staff/users",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.INTEGER,
        "resource_key": "staff",
    },
    {
        "key": "locations.max",
        "name": "Maximum locations",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.INTEGER,
        "resource_key": "locations",
    },
    {
        "key": "storage.max",
        "name": "Storage limit",
        "kind": EntitlementKind.LIMIT,
        "value_type": EntitlementValueType.DECIMAL,
        "resource_key": "storage",
    },
    {
        "key": "reports.advanced",
        "name": "Advanced reporting",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
    {
        "key": "export.enabled",
        "name": "CSV/Excel export",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
    {
        "key": "api.enabled",
        "name": "API access",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
    {
        "key": "multi_location.enabled",
        "name": "Multi-location support",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
    {
        "key": "custom_branding.enabled",
        "name": "Custom branding",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
    {
        "key": "integrations.enabled",
        "name": "Integrations",
        "kind": EntitlementKind.FEATURE,
        "value_type": EntitlementValueType.BOOLEAN,
        "resource_key": None,
    },
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_legacy_plan(db: Session) -> Plan:
    plan = db.query(Plan).filter(Plan.code == LEGACY_PLAN_CODE).first()
    if plan:
        _ensure_default_entitlements_for_plan(db, plan)
        return plan

    plan = Plan(
        code=LEGACY_PLAN_CODE,
        name="Legacy",
        description="Internal compatibility plan for shops that predate subscription billing.",
        monthly_price=Decimal("0.00"),
        annual_price=Decimal("0.00"),
        currency="INR",
        trial_days=0,
        grace_period_days=0,
        is_active=True,
        is_archived=False,
        display_order=0,
    )
    db.add(plan)
    db.flush()

    _ensure_default_entitlements_for_plan(db, plan)

    db.flush()
    return plan


def _ensure_default_entitlements_for_plan(db: Session, plan: Plan) -> None:
    for definition_data in DEFAULT_ENTITLEMENTS:
        definition = (
            db.query(EntitlementDefinition)
            .filter(EntitlementDefinition.key == definition_data["key"])
            .first()
        )
        if not definition:
            definition = EntitlementDefinition(
                key=definition_data["key"],
                name=definition_data["name"],
                description=None,
                kind=definition_data["kind"],
                value_type=definition_data["value_type"],
                resource_key=definition_data["resource_key"],
                is_active=True,
            )
            db.add(definition)
            db.flush()

        existing = (
            db.query(PlanEntitlement)
            .filter(
                PlanEntitlement.plan_id == plan.id,
                PlanEntitlement.entitlement_id == definition.id,
            )
            .first()
        )
        if existing:
            continue

        if definition.kind == EntitlementKind.LIMIT:
            entitlement = PlanEntitlement(
                plan_id=plan.id,
                entitlement_id=definition.id,
                limit_value=None,
                is_unlimited=True,
                feature_enabled=None,
            )
        else:
            entitlement = PlanEntitlement(
                plan_id=plan.id,
                entitlement_id=definition.id,
                limit_value=None,
                is_unlimited=False,
                feature_enabled=True,
            )
        db.add(entitlement)


def ensure_legacy_subscription_for_shop(
    *,
    db: Session,
    shop_id: int,
) -> ShopSubscription:
    existing = (
        db.query(ShopSubscription)
        .filter(ShopSubscription.shop_id == shop_id)
        .order_by(ShopSubscription.created_at.desc(), ShopSubscription.id.desc())
        .first()
    )
    if existing:
        return existing

    plan = ensure_legacy_plan(db)
    now = _utcnow()
    subscription = ShopSubscription(
        shop_id=shop_id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        billing_interval=BillingInterval.LEGACY,
        current_period_start=now,
        current_period_end=None,
    )
    db.add(subscription)
    db.flush()

    create_license_for_subscription(
        db=db,
        subscription=subscription,
        status=LicenseStatus.ACTIVE,
    )
    db.flush()
    return subscription
