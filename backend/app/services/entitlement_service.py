"""Central entitlement resolution and usage service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.domain_errors import DomainErrorCode
from app.core.domain_errors import DomainError
from app.core.subscription_status import (
    license_allows_entitlements,
    normalize_license_status,
    normalize_subscription_status,
    subscription_allows_entitlements,
)
from app.models.entitlement import (
    EntitlementDefinition,
    EntitlementKind,
    PlanEntitlement,
    ShopEntitlementOverride,
)
from app.models.invoice import Invoice
from app.models.license import ShopLicense
from app.models.plan_catalog import PlanCatalogEntitlementSnapshot
from app.models.product import Product
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.vendor import Vendor


@dataclass(slots=True)
class CommercialAccess:
    allowed: bool
    code: str | None = None
    message: str | None = None
    subscription: ShopSubscription | None = None
    license: ShopLicense | None = None


@dataclass(slots=True)
class EffectiveEntitlement:
    key: str
    kind: str
    resource_key: str | None
    configured: bool
    source: str | None = None
    limit_value: Decimal | None = None
    is_unlimited: bool = False
    feature_enabled: bool | None = None


@dataclass(slots=True)
class UsageResult:
    resource_key: str
    supported: bool
    used: int | None = None
    code: str | None = None
    message: str | None = None


@dataclass(slots=True)
class CreateCapability:
    allowed: bool
    resource_key: str
    code: str | None = None
    message: str | None = None
    used: int | None = None
    limit: Decimal | None = None
    remaining: Decimal | None = None
    is_unlimited: bool = False


def validate_entitlement_configuration(
    *,
    definition: EntitlementDefinition,
    limit_value: Decimal | None = None,
    is_unlimited: bool = False,
    feature_enabled: bool | None = None,
) -> None:
    """Validate one configured entitlement value.

    SQL constraints catch the generic non-negative/unlimited shape. This helper
    carries the domain rules that depend on the entitlement definition kind.
    """
    if definition.kind == EntitlementKind.LIMIT:
        if feature_enabled is not None:
            raise ValueError("Limit entitlements cannot set feature_enabled")
        if is_unlimited and limit_value is not None:
            raise ValueError("Unlimited limit entitlements cannot set limit_value")
        if not is_unlimited and limit_value is None:
            raise ValueError("Limited entitlements require limit_value")
        if limit_value is not None and limit_value < 0:
            raise ValueError("Limit value cannot be negative")
        return

    if definition.kind == EntitlementKind.FEATURE:
        if limit_value is not None or is_unlimited:
            raise ValueError("Feature entitlements cannot set limit values")
        if feature_enabled is None:
            raise ValueError("Feature entitlements require feature_enabled")
        return

    raise ValueError(f"Unsupported entitlement kind: {definition.kind}")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _latest_subscription(shop_id: int, db: Session) -> ShopSubscription | None:
    return (
        db.query(ShopSubscription)
        .options(
            joinedload(ShopSubscription.plan),
            joinedload(ShopSubscription.catalog_version),
        )
        .filter(ShopSubscription.shop_id == shop_id)
        .order_by(ShopSubscription.created_at.desc(), ShopSubscription.id.desc())
        .first()
    )


def _latest_license(subscription_id: int, db: Session) -> ShopLicense | None:
    return (
        db.query(ShopLicense)
        .filter(ShopLicense.subscription_id == subscription_id)
        .order_by(ShopLicense.created_at.desc(), ShopLicense.id.desc())
        .first()
    )


def evaluate_shop_access(shop_id: int, db: Session) -> CommercialAccess:
    now = _utcnow()
    subscription = _latest_subscription(shop_id, db)
    if not subscription:
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.SUBSCRIPTION_REQUIRED,
            message="A subscription is required for this shop.",
        )

    subscription_status = normalize_subscription_status(subscription.status)
    if subscription_status == "expired" or subscription_status == "cancelled":
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.SUBSCRIPTION_EXPIRED,
            message="This shop subscription has expired.",
            subscription=subscription,
        )

    if subscription_status == "suspended":
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.SUBSCRIPTION_SUSPENDED,
            message="This shop subscription is not active.",
            subscription=subscription,
        )

    if not subscription_allows_entitlements(subscription_status):
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.SUBSCRIPTION_REQUIRED,
            message="This shop subscription is not active.",
            subscription=subscription,
        )

    current_period_end = _as_utc(subscription.current_period_end)
    trial_end = _as_utc(subscription.trial_end_at)
    plan_grace_days = int(
        getattr(subscription.catalog_version, "grace_period_days", None)
        if subscription.catalog_version is not None
        else getattr(subscription.plan, "grace_period_days", 0)
        or 0
    )

    if current_period_end and current_period_end < now:
        grace_until = current_period_end + timedelta(days=plan_grace_days)
        if plan_grace_days <= 0 or grace_until < now:
            return CommercialAccess(
                allowed=False,
                code=DomainErrorCode.SUBSCRIPTION_EXPIRED,
                message="This shop subscription has expired.",
                subscription=subscription,
            )

    if (
        subscription_status == "active"
        and trial_end
        and trial_end < now
        and current_period_end is None
    ):
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.SUBSCRIPTION_EXPIRED,
            message="This shop trial has expired.",
            subscription=subscription,
        )

    license_row = _latest_license(subscription.id, db)
    if not license_row:
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.LICENSE_INACTIVE,
            message="This shop license is not active.",
            subscription=subscription,
        )

    license_status = normalize_license_status(license_row.status)
    if not license_allows_entitlements(license_status):
        code = (
            DomainErrorCode.LICENSE_EXPIRED
            if license_status == "expired"
            else DomainErrorCode.LICENSE_INACTIVE
        )
        return CommercialAccess(
            allowed=False,
            code=code,
            message="This shop license is not active.",
            subscription=subscription,
            license=license_row,
        )

    license_expires_at = _as_utc(license_row.expires_at)
    if license_expires_at and license_expires_at < now:
        return CommercialAccess(
            allowed=False,
            code=DomainErrorCode.LICENSE_EXPIRED,
            message="This shop license has expired.",
            subscription=subscription,
            license=license_row,
        )

    return CommercialAccess(
        allowed=True,
        subscription=subscription,
        license=license_row,
    )


def _find_limit_definition(db: Session, resource_key: str) -> EntitlementDefinition | None:
    return (
        db.query(EntitlementDefinition)
        .filter(
            EntitlementDefinition.kind == EntitlementKind.LIMIT,
            EntitlementDefinition.is_active == True,  # noqa: E712
            (
                (EntitlementDefinition.resource_key == resource_key)
                | (EntitlementDefinition.key == resource_key)
            ),
        )
        .order_by(EntitlementDefinition.id.asc())
        .first()
    )


def _find_feature_definition(db: Session, feature_key: str) -> EntitlementDefinition | None:
    return (
        db.query(EntitlementDefinition)
        .filter(
            EntitlementDefinition.kind == EntitlementKind.FEATURE,
            EntitlementDefinition.is_active == True,  # noqa: E712
            EntitlementDefinition.key == feature_key,
        )
        .first()
    )


def _active_override(
    *,
    db: Session,
    shop_id: int,
    entitlement_id: int,
    at_time: datetime | None = None,
) -> ShopEntitlementOverride | None:
    now = at_time or _utcnow()
    return (
        db.query(ShopEntitlementOverride)
        .filter(
            ShopEntitlementOverride.shop_id == shop_id,
            ShopEntitlementOverride.entitlement_id == entitlement_id,
            ShopEntitlementOverride.starts_at <= now,
            (
                (ShopEntitlementOverride.ends_at.is_(None))
                | (ShopEntitlementOverride.ends_at > now)
            ),
        )
        .order_by(
            ShopEntitlementOverride.starts_at.desc(),
            ShopEntitlementOverride.id.desc(),
        )
        .first()
    )


def _effective_from_rows(
    *,
    definition: EntitlementDefinition,
    plan_entitlement: PlanEntitlement | None,
    override: ShopEntitlementOverride | None,
) -> EffectiveEntitlement:
    if override:
        return EffectiveEntitlement(
            key=definition.key,
            kind=definition.kind,
            resource_key=definition.resource_key,
            configured=True,
            source="override",
            limit_value=override.limit_value,
            is_unlimited=bool(override.is_unlimited),
            feature_enabled=override.feature_enabled,
        )

    if plan_entitlement:
        return EffectiveEntitlement(
            key=definition.key,
            kind=definition.kind,
            resource_key=definition.resource_key,
            configured=True,
            source="plan",
            limit_value=plan_entitlement.limit_value,
            is_unlimited=bool(plan_entitlement.is_unlimited),
            feature_enabled=plan_entitlement.feature_enabled,
        )

    return EffectiveEntitlement(
        key=definition.key,
        kind=definition.kind,
        resource_key=definition.resource_key,
        configured=False,
    )


def _effective_from_snapshot(
    *,
    snapshot: PlanCatalogEntitlementSnapshot,
    override: ShopEntitlementOverride | None,
) -> EffectiveEntitlement:
    if override:
        return EffectiveEntitlement(
            key=snapshot.entitlement_key,
            kind=snapshot.kind,
            resource_key=snapshot.resource_key,
            configured=True,
            source="override",
            limit_value=override.limit_value,
            is_unlimited=bool(override.is_unlimited),
            feature_enabled=override.feature_enabled,
        )
    return EffectiveEntitlement(
        key=snapshot.entitlement_key,
        kind=snapshot.kind,
        resource_key=snapshot.resource_key,
        configured=True,
        source="catalog_version",
        limit_value=snapshot.limit_value,
        is_unlimited=bool(snapshot.is_unlimited),
        feature_enabled=snapshot.feature_enabled,
    )


def get_effective_entitlements(shop_id: int, db: Session) -> dict[str, EffectiveEntitlement]:
    access = evaluate_shop_access(shop_id, db)
    if not access.allowed or not access.subscription:
        return {}

    if access.subscription.catalog_version_id:
        snapshots = (
            db.query(PlanCatalogEntitlementSnapshot)
            .filter(
                PlanCatalogEntitlementSnapshot.catalog_version_id
                == access.subscription.catalog_version_id
            )
            .order_by(PlanCatalogEntitlementSnapshot.id.asc())
            .all()
        )
        return {
            snapshot.entitlement_key: _effective_from_snapshot(
                snapshot=snapshot,
                override=_active_override(
                    db=db,
                    shop_id=shop_id,
                    entitlement_id=snapshot.entitlement_id,
                ),
            )
            for snapshot in snapshots
        }

    rows = (
        db.query(EntitlementDefinition, PlanEntitlement)
        .outerjoin(
            PlanEntitlement,
            (PlanEntitlement.entitlement_id == EntitlementDefinition.id)
            & (PlanEntitlement.plan_id == access.subscription.plan_id),
        )
        .filter(EntitlementDefinition.is_active == True)  # noqa: E712
        .all()
    )

    effective: dict[str, EffectiveEntitlement] = {}
    for definition, plan_entitlement in rows:
        override = _active_override(
            db=db,
            shop_id=shop_id,
            entitlement_id=definition.id,
        )
        effective[definition.key] = _effective_from_rows(
            definition=definition,
            plan_entitlement=plan_entitlement,
            override=override,
        )

    return effective


def get_limit(shop_id: int, resource_key: str, db: Session) -> EffectiveEntitlement:
    access = evaluate_shop_access(shop_id, db)
    if not access.allowed or not access.subscription:
        return EffectiveEntitlement(
            key=resource_key,
            kind=EntitlementKind.LIMIT,
            resource_key=resource_key,
            configured=False,
        )

    if access.subscription.catalog_version_id:
        snapshot = (
            db.query(PlanCatalogEntitlementSnapshot)
            .filter(
                PlanCatalogEntitlementSnapshot.catalog_version_id
                == access.subscription.catalog_version_id,
                PlanCatalogEntitlementSnapshot.kind == EntitlementKind.LIMIT,
                (
                    (PlanCatalogEntitlementSnapshot.resource_key == resource_key)
                    | (PlanCatalogEntitlementSnapshot.entitlement_key == resource_key)
                ),
            )
            .order_by(PlanCatalogEntitlementSnapshot.id.asc())
            .first()
        )
        if not snapshot:
            return EffectiveEntitlement(
                key=resource_key,
                kind=EntitlementKind.LIMIT,
                resource_key=resource_key,
                configured=False,
            )
        return _effective_from_snapshot(
            snapshot=snapshot,
            override=_active_override(
                db=db,
                shop_id=shop_id,
                entitlement_id=snapshot.entitlement_id,
            ),
        )

    definition = _find_limit_definition(db, resource_key)
    if not definition:
        return EffectiveEntitlement(
            key=resource_key,
            kind=EntitlementKind.LIMIT,
            resource_key=resource_key,
            configured=False,
        )

    plan_entitlement = (
        db.query(PlanEntitlement)
        .filter(
            PlanEntitlement.plan_id == access.subscription.plan_id,
            PlanEntitlement.entitlement_id == definition.id,
        )
        .first()
    )
    override = _active_override(
        db=db,
        shop_id=shop_id,
        entitlement_id=definition.id,
    )
    return _effective_from_rows(
        definition=definition,
        plan_entitlement=plan_entitlement,
        override=override,
    )


def get_feature(shop_id: int, feature_key: str, db: Session) -> EffectiveEntitlement:
    access = evaluate_shop_access(shop_id, db)
    if not access.allowed or not access.subscription:
        return EffectiveEntitlement(
            key=feature_key,
            kind=EntitlementKind.FEATURE,
            resource_key=None,
            configured=False,
        )

    if access.subscription.catalog_version_id:
        snapshot = (
            db.query(PlanCatalogEntitlementSnapshot)
            .filter(
                PlanCatalogEntitlementSnapshot.catalog_version_id
                == access.subscription.catalog_version_id,
                PlanCatalogEntitlementSnapshot.kind == EntitlementKind.FEATURE,
                PlanCatalogEntitlementSnapshot.entitlement_key == feature_key,
            )
            .first()
        )
        if not snapshot:
            return EffectiveEntitlement(
                key=feature_key,
                kind=EntitlementKind.FEATURE,
                resource_key=None,
                configured=False,
            )
        return _effective_from_snapshot(
            snapshot=snapshot,
            override=_active_override(
                db=db,
                shop_id=shop_id,
                entitlement_id=snapshot.entitlement_id,
            ),
        )

    definition = _find_feature_definition(db, feature_key)
    if not definition:
        return EffectiveEntitlement(
            key=feature_key,
            kind=EntitlementKind.FEATURE,
            resource_key=None,
            configured=False,
        )

    plan_entitlement = (
        db.query(PlanEntitlement)
        .filter(
            PlanEntitlement.plan_id == access.subscription.plan_id,
            PlanEntitlement.entitlement_id == definition.id,
        )
        .first()
    )
    override = _active_override(
        db=db,
        shop_id=shop_id,
        entitlement_id=definition.id,
    )
    return _effective_from_rows(
        definition=definition,
        plan_entitlement=plan_entitlement,
        override=override,
    )


def has_feature(shop_id: int, feature_key: str, db: Session) -> bool:
    effective = get_feature(shop_id, feature_key, db)
    return bool(effective.configured and effective.feature_enabled)


def ensure_feature_enabled(
    shop_id: int,
    feature_key: str,
    db: Session,
) -> EffectiveEntitlement:
    """Require commercial access and one effective boolean entitlement.

    Callers must still enforce authentication, branch membership, and RBAC.
    This helper is the commercial half of that composition and intentionally
    fails closed for missing or disabled features.
    """
    access = evaluate_shop_access(shop_id, db)
    if not access.allowed:
        raise DomainError(
            code=access.code or DomainErrorCode.FEATURE_NOT_AVAILABLE,
            message=access.message or "This commercial feature is not available.",
            details={"shop_id": shop_id, "feature_key": feature_key},
        ).to_http_exception()

    effective = get_feature(shop_id, feature_key, db)
    if effective.configured and effective.feature_enabled:
        return effective

    raise DomainError(
        code=DomainErrorCode.FEATURE_NOT_AVAILABLE,
        message=f"The feature '{feature_key}' is not available for this shop.",
        details={
            "feature_key": feature_key,
            "configured": effective.configured,
            "source": effective.source,
        },
    ).to_http_exception()


def get_usage(shop_id: int, resource_key: str, db: Session) -> UsageResult:
    if resource_key == "products":
        used = (
            db.query(func.count(Product.id))
            .filter(Product.shop_id == shop_id)
            .scalar()
            or 0
        )
        return UsageResult(resource_key=resource_key, supported=True, used=int(used))

    if resource_key == "vendors":
        used = (
            db.query(func.count(Vendor.id))
            .filter(Vendor.shop_id == shop_id)
            .scalar()
            or 0
        )
        return UsageResult(resource_key=resource_key, supported=True, used=int(used))

    if resource_key == "orders.monthly":
        today = date.today()
        month_start = today.replace(day=1)
        if month_start.month == 12:
            next_month_start = date(month_start.year + 1, 1, 1)
        else:
            next_month_start = date(month_start.year, month_start.month + 1, 1)

        used = (
            db.query(func.count(Invoice.id))
            .filter(
                Invoice.shop_id == shop_id,
                Invoice.invoice_status != "cancelled",
                Invoice.invoice_date >= month_start,
                Invoice.invoice_date < next_month_start,
            )
            .scalar()
            or 0
        )
        return UsageResult(resource_key=resource_key, supported=True, used=int(used))

    return UsageResult(
        resource_key=resource_key,
        supported=False,
        code=DomainErrorCode.USAGE_UNSUPPORTED,
        message=f"Usage for '{resource_key}' is not supported yet.",
    )


def can_create(shop_id: int, resource_key: str, db: Session) -> CreateCapability:
    access = evaluate_shop_access(shop_id, db)
    if not access.allowed:
        return CreateCapability(
            allowed=False,
            resource_key=resource_key,
            code=access.code,
            message=access.message,
        )

    limit = get_limit(shop_id, resource_key, db)
    if not limit.configured:
        return CreateCapability(
            allowed=False,
            resource_key=resource_key,
            code=DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED,
            message=f"No entitlement is configured for '{resource_key}'.",
        )

    usage = get_usage(shop_id, resource_key, db)
    if not usage.supported:
        return CreateCapability(
            allowed=False,
            resource_key=resource_key,
            code=usage.code,
            message=usage.message,
        )

    if limit.is_unlimited:
        return CreateCapability(
            allowed=True,
            resource_key=resource_key,
            used=usage.used,
            is_unlimited=True,
        )

    if limit.limit_value is None:
        return CreateCapability(
            allowed=False,
            resource_key=resource_key,
            code=DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED,
            message=f"No finite limit is configured for '{resource_key}'.",
            used=usage.used,
        )

    used = Decimal(usage.used or 0)
    remaining = limit.limit_value - used
    if remaining <= 0:
        return CreateCapability(
            allowed=False,
            resource_key=resource_key,
            code=DomainErrorCode.PLAN_LIMIT_REACHED,
            message=f"The limit for '{resource_key}' has been reached.",
            used=usage.used,
            limit=limit.limit_value,
            remaining=Decimal("0"),
        )

    return CreateCapability(
        allowed=True,
        resource_key=resource_key,
        used=usage.used,
        limit=limit.limit_value,
        remaining=remaining,
    )


def ensure_can_create(shop_id: int, resource_key: str, db: Session) -> CreateCapability:
    """Validate a create operation and raise a structured domain HTTP error.

    The shop row is selected ``FOR UPDATE`` where the database supports it.
    Future enforcement calls should happen inside the same transaction as the
    insert. That serializes create attempts per shop/resource boundary on
    Postgres and avoids the classic "two requests both saw 99/100" race.
    SQLite ignores the clause in tests, which is acceptable for local coverage.
    """
    (
        db.query(Shop)
        .filter(Shop.id == shop_id)
        .with_for_update()
        .first()
    )
    capability = can_create(shop_id, resource_key, db)
    if capability.allowed:
        return capability

    details = {
        "resource_key": resource_key,
        "used": capability.used,
        "limit": str(capability.limit) if capability.limit is not None else None,
        "remaining": str(capability.remaining) if capability.remaining is not None else None,
        "is_unlimited": capability.is_unlimited,
    }
    raise DomainError(
        code=capability.code or DomainErrorCode.PLAN_LIMIT_REACHED,
        message=capability.message or "This action is not available for the current plan.",
        details=details,
    ).to_http_exception()
