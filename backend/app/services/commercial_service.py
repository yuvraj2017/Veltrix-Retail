from __future__ import annotations

import json
import hmac
import hashlib
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
import base64
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.domain_errors import DomainErrorCode
from app.core.subscription_status import (
    BillingInterval,
    LicenseStatus,
    SubscriptionStatus,
)
from app.models.admin_audit_log import AuditAction
from app.models.commercial_event import (
    PaymentWebhookEvent,
    PaymentGatewayConfig,
    LicenseEvent,
    SubscriptionEvent,
    SubscriptionPayment,
    SubscriptionPaymentStatus,
)
from app.models.entitlement import (
    EntitlementDefinition,
    EntitlementKind,
    EntitlementValueType,
    PlanEntitlement,
    ShopEntitlementOverride,
)
from app.models.license import ShopLicense
from app.models.plan import Plan
from app.models.plan_catalog import (
    CatalogVersionStatus,
    PlanCatalogEntitlementSnapshot,
    PlanCatalogVersion,
)
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.subscription import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CatalogEntitlementSnapshotRequest,
    EntitlementDefinitionCreateRequest,
    EntitlementDefinitionUpdateRequest,
    EntitlementValuePayload,
    FeatureEntitlementResponse,
    PaymentCreateRequest,
    PaymentGatewayConfigRequest,
    PaymentGatewayConfigResponse,
    PaymentVerificationResponse,
    PlanCreateRequest,
    PlanCatalogPublishRequest,
    PlanCatalogVersionResponse,
    PlanEntitlementResponse,
    PlanUpdateRequest,
    PublicPlanResponse,
    ShopOverrideCreateRequest,
    ShopOverrideResponse,
    ShopSubscriptionOverviewResponse,
    SubscriptionAssignRequest,
    RazorpayVerifyPaymentRequest,
    UpiPaymentReferenceRequest,
    UpiPaymentReviewRequest,
    UsageLimitResponse,
)
from app.services import audit_service
from app.services.entitlement_service import (
    CommercialAccess,
    EffectiveEntitlement,
    evaluate_shop_access,
    get_effective_entitlements,
    get_usage,
    validate_entitlement_configuration,
)
from app.services.license_service import create_license_for_subscription
from app.services.secret_service import decrypt_secret, encrypt_secret, mask_secret
from app.services.commercial_transition_service import (
    CommercialTransitionError,
    as_utc,
    purchased_term,
    require_reason,
    transition_payment,
    transition_subscription,
)

RAZORPAY_PROVIDER = "razorpay"
UPI_MANUAL_PROVIDER = "upi_manual"
ADMIN_MANUAL_PROVIDER = "manual"
SUPPORTED_PAYMENT_PROVIDERS = (RAZORPAY_PROVIDER, UPI_MANUAL_PROVIDER)
RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
UPI_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$")
RECONCILIATION_REQUIRED_PREFIX = "RECONCILIATION_REQUIRED:"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json(value: Any) -> str:
    return json.dumps(value, default=str, sort_keys=True)


def _normalize_code(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def _transition_conflict(exc: CommercialTransitionError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def _catalog_amount(version: PlanCatalogVersion, billing_interval: str) -> Decimal:
    if billing_interval == BillingInterval.ANNUAL:
        return Decimal(version.annual_price or 0)
    if billing_interval == BillingInterval.MONTHLY:
        return Decimal(version.monthly_price or 0)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval")


def _validate_catalog_payment(
    version: PlanCatalogVersion,
    amount: Decimal,
    currency: str,
    billing_interval: str,
) -> None:
    try:
        purchased_term(billing_interval)
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if Decimal(amount) != _catalog_amount(version, billing_interval):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment amount does not match the selected catalog price",
        )
    if currency.strip().upper() != version.currency.upper():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment currency does not match the selected catalog currency",
        )


def _same_payment_request(
    existing: SubscriptionPayment,
    payload: PaymentCreateRequest,
    catalog_version_id: int | None = None,
) -> bool:
    return (
        existing.shop_id == payload.shop_id
        and existing.plan_id == payload.plan_id
        and (
            existing.catalog_version_id == catalog_version_id
            or (existing.catalog_version_id is None and payload.catalog_version_id is None)
        )
        and Decimal(existing.amount) == Decimal(payload.amount)
        and existing.currency.upper() == payload.currency.upper()
        and existing.billing_interval == payload.billing_interval
        and existing.status == payload.status
    )


def _requires_cross_plan_reconciliation(
    subscription: ShopSubscription | None,
    plan_id: int,
) -> bool:
    if subscription is None or subscription.plan_id == plan_id:
        return False

    paid_expiry = as_utc(subscription.current_period_end)
    return (
        subscription.billing_interval != BillingInterval.LEGACY
        and subscription.status
        in {
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.GRACE_PERIOD,
            SubscriptionStatus.SUSPENDED,
        }
        and paid_expiry is not None
        and paid_expiry > _utcnow()
    )


def _reject_unsupported_plan_change(
    subscription: ShopSubscription | None,
    plan_id: int,
) -> None:
    if _requires_cross_plan_reconciliation(subscription, plan_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PLAN_CHANGE_NOT_SUPPORTED",
                "message": (
                    "Changing plans through payment is not supported yet. "
                    "Renew the current plan or contact support."
                ),
                "details": {},
            },
        )


def _payment_requires_reconciliation(payment: SubscriptionPayment) -> bool:
    return bool(
        payment.status == SubscriptionPaymentStatus.SUCCEEDED
        and payment.failure_reason
        and payment.failure_reason.startswith(RECONCILIATION_REQUIRED_PREFIX)
    )


def _require_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    return shop


def _lock_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).with_for_update().first()
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    return shop


def _require_plan(db: Session, plan_id: int) -> Plan:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


def _require_assignable_plan(db: Session, plan_id: int) -> Plan:
    plan = _require_plan(db, plan_id)
    if not plan.is_active or plan.is_archived:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PLAN_NOT_ASSIGNABLE",
                "message": "This plan is inactive or archived.",
                "details": {"plan_id": plan_id},
            },
        )
    return plan


def _latest_published_catalog_version(
    db: Session,
    plan_id: int,
) -> PlanCatalogVersion | None:
    return (
        db.query(PlanCatalogVersion)
        .options(joinedload(PlanCatalogVersion.entitlement_snapshots))
        .filter(
            PlanCatalogVersion.plan_id == plan_id,
            PlanCatalogVersion.status == CatalogVersionStatus.PUBLISHED,
        )
        .order_by(PlanCatalogVersion.version_number.desc())
        .first()
    )


def _published_catalog_version(
    db: Session,
    catalog_version_id: int,
) -> PlanCatalogVersion:
    version = (
        db.query(PlanCatalogVersion)
        .options(joinedload(PlanCatalogVersion.entitlement_snapshots))
        .filter(
            PlanCatalogVersion.id == catalog_version_id,
            PlanCatalogVersion.status == CatalogVersionStatus.PUBLISHED,
        )
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Catalog version is unavailable",
        )
    return version


def _baseline_catalog_version(db: Session, plan: Plan) -> PlanCatalogVersion:
    baseline = (
        db.query(PlanCatalogVersion)
        .filter(
            PlanCatalogVersion.plan_id == plan.id,
            PlanCatalogVersion.version_number == 1,
            PlanCatalogVersion.status == CatalogVersionStatus.PUBLISHED,
        )
        .first()
    )
    return baseline or _ensure_baseline_catalog_version(db, plan)


def _snapshot_from_plan_entitlement(
    version: PlanCatalogVersion,
    row: PlanEntitlement,
) -> PlanCatalogEntitlementSnapshot:
    definition = row.entitlement
    return PlanCatalogEntitlementSnapshot(
        catalog_version=version,
        entitlement_id=row.entitlement_id,
        entitlement_key=definition.key,
        entitlement_name=definition.name,
        kind=definition.kind,
        value_type=definition.value_type,
        resource_key=definition.resource_key,
        limit_value=row.limit_value,
        is_unlimited=row.is_unlimited,
        feature_enabled=row.feature_enabled,
    )


def _ensure_baseline_catalog_version(db: Session, plan: Plan) -> PlanCatalogVersion:
    existing = _latest_published_catalog_version(db, plan.id)
    if existing:
        return existing
    rows = (
        db.query(PlanEntitlement)
        .options(joinedload(PlanEntitlement.entitlement))
        .filter(PlanEntitlement.plan_id == plan.id)
        .order_by(PlanEntitlement.id.asc())
        .all()
    )
    version = PlanCatalogVersion(
        plan_id=plan.id,
        version_number=1,
        status=CatalogVersionStatus.DRAFT,
        monthly_price=plan.monthly_price,
        annual_price=plan.annual_price,
        currency=plan.currency.upper(),
        trial_days=plan.trial_days,
        grace_period_days=plan.grace_period_days,
        published_at=None,
    )
    db.add(version)
    db.flush()
    for row in rows:
        db.add(_snapshot_from_plan_entitlement(version, row))
    db.flush()
    version.status = CatalogVersionStatus.PUBLISHED
    version.published_at = _utcnow()
    db.flush()
    db.refresh(version)
    return version


def _resolve_checkout_catalog_version(
    db: Session,
    *,
    shop_id: int,
    plan: Plan,
    requested_version_id: int | None,
) -> PlanCatalogVersion:
    subscription = _latest_subscription(db, shop_id)
    if subscription and subscription.plan_id == plan.id and subscription.catalog_version_id:
        contracted = _published_catalog_version(db, subscription.catalog_version_id)
        if requested_version_id is not None and requested_version_id != contracted.id:
            requested = _published_catalog_version(db, requested_version_id)
            latest = _ensure_baseline_catalog_version(db, plan)
            if requested.plan_id != plan.id or requested.id != latest.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "CATALOG_VERSION_NOT_PURCHASABLE",
                        "message": "The selected catalog version is unavailable.",
                        "details": {},
                    },
                )
        return contracted

    latest = _ensure_baseline_catalog_version(db, plan)
    if requested_version_id is not None and requested_version_id != latest.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CATALOG_VERSION_NOT_PURCHASABLE",
                "message": "The selected catalog version is no longer available for new purchases.",
                "details": {},
            },
        )
    return latest


def _payment_catalog_version(
    db: Session,
    payment: SubscriptionPayment,
) -> PlanCatalogVersion | None:
    if not payment.catalog_version_id:
        return None
    version = _published_catalog_version(db, payment.catalog_version_id)
    if payment.plan_id != version.plan_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment catalog version does not belong to its plan",
        )
    _validate_catalog_payment(
        version,
        payment.amount,
        payment.currency,
        payment.billing_interval or "",
    )
    return version


def _require_entitlement(db: Session, entitlement_id: int) -> EntitlementDefinition:
    entitlement = (
        db.query(EntitlementDefinition)
        .filter(EntitlementDefinition.id == entitlement_id)
        .first()
    )
    if not entitlement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entitlement definition not found",
        )
    return entitlement


def _latest_subscription(db: Session, shop_id: int) -> ShopSubscription | None:
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


def _latest_license(db: Session, subscription_id: int) -> ShopLicense | None:
    return (
        db.query(ShopLicense)
        .filter(ShopLicense.subscription_id == subscription_id)
        .order_by(ShopLicense.created_at.desc(), ShopLicense.id.desc())
        .first()
    )


def _latest_subscription_for_update(db: Session, shop_id: int) -> ShopSubscription | None:
    return (
        db.query(ShopSubscription)
        .filter(ShopSubscription.shop_id == shop_id)
        .order_by(ShopSubscription.created_at.desc(), ShopSubscription.id.desc())
        .with_for_update()
        .first()
    )


def _latest_license_for_update(db: Session, subscription_id: int) -> ShopLicense | None:
    return (
        db.query(ShopLicense)
        .filter(ShopLicense.subscription_id == subscription_id)
        .order_by(ShopLicense.created_at.desc(), ShopLicense.id.desc())
        .with_for_update()
        .first()
    )


def _audit(
    db: Session,
    *,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: int,
    previous: Any = None,
    new: Any = None,
    reason: str | None = None,
    ip_address: str | None = None,
) -> None:
    audit_service.record_admin_action(
        db,
        actor=actor,
        action=action,
        target_entity_type=entity_type,
        target_entity_id=entity_id,
        previous_value=_json(previous) if previous is not None else None,
        new_value=_json(new) if new is not None else None,
        reason=reason,
        ip_address=ip_address,
    )


def _plan_snapshot(plan: Plan) -> dict[str, Any]:
    return {
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "monthly_price": str(plan.monthly_price),
        "annual_price": str(plan.annual_price),
        "currency": plan.currency,
        "is_active": plan.is_active,
        "is_archived": plan.is_archived,
    }


def _catalog_snapshot(version: PlanCatalogVersion) -> dict[str, Any]:
    return {
        "id": version.id,
        "plan_id": version.plan_id,
        "version_number": version.version_number,
        "status": version.status,
        "monthly_price": str(version.monthly_price),
        "annual_price": str(version.annual_price),
        "currency": version.currency,
        "trial_days": version.trial_days,
        "grace_period_days": version.grace_period_days,
        "published_at": version.published_at,
    }


def list_plans(db: Session, *, include_archived: bool = False) -> list[Plan]:
    query = db.query(Plan)
    if not include_archived:
        query = query.filter(Plan.is_archived == False)  # noqa: E712
    return query.order_by(Plan.display_order.asc(), Plan.id.asc()).all()


def list_plan_catalog_versions(
    db: Session,
    plan_id: int,
) -> list[PlanCatalogVersionResponse]:
    _require_plan(db, plan_id)
    versions = (
        db.query(PlanCatalogVersion)
        .options(joinedload(PlanCatalogVersion.entitlement_snapshots))
        .filter(
            PlanCatalogVersion.plan_id == plan_id,
            PlanCatalogVersion.status == CatalogVersionStatus.PUBLISHED,
        )
        .order_by(PlanCatalogVersion.version_number.desc())
        .all()
    )
    return [PlanCatalogVersionResponse.model_validate(version) for version in versions]


def list_public_plan_catalog(db: Session) -> list[PublicPlanResponse]:
    plans = (
        db.query(Plan)
        .filter(
            Plan.is_archived == False,  # noqa: E712
            Plan.is_active == True,  # noqa: E712
        )
        .order_by(Plan.display_order.asc(), Plan.id.asc())
        .all()
    )
    responses: list[PublicPlanResponse] = []
    for plan in plans:
        version = _latest_published_catalog_version(db, plan.id)
        if not version:
            continue
        responses.append(
            PublicPlanResponse(
            id=plan.id,
            code=plan.code,
            name=plan.name,
            description=plan.description,
            monthly_price=version.monthly_price,
            annual_price=version.annual_price,
            currency=version.currency,
            trial_days=version.trial_days,
            grace_period_days=version.grace_period_days,
            is_active=plan.is_active,
            is_archived=plan.is_archived,
            display_order=plan.display_order,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            catalog_version_id=version.id,
            catalog_version_number=version.version_number,
            entitlements=[
                PlanEntitlementResponse(
                    id=row.id,
                    plan_id=plan.id,
                    entitlement_id=row.entitlement_id,
                    entitlement_key=row.entitlement_key,
                    entitlement_name=row.entitlement_name,
                    kind=row.kind,
                    resource_key=row.resource_key,
                    limit_value=row.limit_value,
                    is_unlimited=row.is_unlimited,
                    feature_enabled=row.feature_enabled,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
                for row in version.entitlement_snapshots
            ],
        ))
    return responses


def _validate_catalog_entitlements(
    db: Session,
    payloads: list[CatalogEntitlementSnapshotRequest],
) -> list[tuple[CatalogEntitlementSnapshotRequest, EntitlementDefinition]]:
    entitlement_ids = [item.entitlement_id for item in payloads]
    duplicate_ids = sorted(
        entitlement_id
        for entitlement_id in set(entitlement_ids)
        if entitlement_ids.count(entitlement_id) > 1
    )
    if duplicate_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "CATALOG_SNAPSHOT_INVALID",
                "message": "Catalog entitlement definitions must be unique.",
                "details": {"duplicate_entitlement_ids": duplicate_ids},
            },
        )

    # A PostgreSQL SHARE lock gives publication a stable definition set while
    # still allowing publications for different plans to proceed concurrently.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(text("LOCK TABLE entitlement_definitions IN SHARE MODE"))
    definition_rows = (
        db.query(EntitlementDefinition)
        .order_by(EntitlementDefinition.id.asc())
        .with_for_update()
        .all()
    )
    definitions = {row.id: row for row in definition_rows}
    active_definitions = {row.id: row for row in definition_rows if row.is_active}
    submitted_ids = set(entitlement_ids)
    active_ids = set(active_definitions)
    missing_ids = sorted(active_ids - submitted_ids)
    unknown_ids = sorted(submitted_ids - set(definitions))
    inactive_ids = sorted((submitted_ids & set(definitions)) - active_ids)
    if missing_ids or unknown_ids or inactive_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "CATALOG_SNAPSHOT_INVALID",
                "message": "Catalog versions must include exactly one value for every active entitlement.",
                "details": {
                    "missing_entitlements": [
                        {"id": entitlement_id, "key": active_definitions[entitlement_id].key}
                        for entitlement_id in missing_ids
                    ],
                    "unknown_entitlement_ids": unknown_ids,
                    "inactive_entitlements": [
                        {"id": entitlement_id, "key": definitions[entitlement_id].key}
                        for entitlement_id in inactive_ids
                    ],
                },
            },
        )

    resolved = []
    for item in payloads:
        definition = active_definitions[item.entitlement_id]
        try:
            validate_entitlement_configuration(
                definition=definition,
                limit_value=item.limit_value,
                is_unlimited=item.is_unlimited,
                feature_enabled=item.feature_enabled,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        resolved.append((item, definition))
    return resolved


def _publish_catalog_version(
    db: Session,
    *,
    plan: Plan,
    monthly_price: Decimal,
    annual_price: Decimal,
    currency: str,
    trial_days: int,
    grace_period_days: int,
    entitlements: list[CatalogEntitlementSnapshotRequest],
    actor_id: int | None,
) -> PlanCatalogVersion:
    resolved = _validate_catalog_entitlements(db, entitlements)
    next_version = (
        db.query(func.max(PlanCatalogVersion.version_number))
        .filter(PlanCatalogVersion.plan_id == plan.id)
        .scalar()
        or 0
    ) + 1
    now = _utcnow()
    version = PlanCatalogVersion(
        plan_id=plan.id,
        version_number=next_version,
        status=CatalogVersionStatus.DRAFT,
        monthly_price=monthly_price,
        annual_price=annual_price,
        currency=currency.strip().upper(),
        trial_days=trial_days,
        grace_period_days=grace_period_days,
        published_at=None,
        published_by_user_id=actor_id,
    )
    db.add(version)
    db.flush()
    for item, definition in resolved:
        db.add(
            PlanCatalogEntitlementSnapshot(
                catalog_version_id=version.id,
                entitlement_id=definition.id,
                entitlement_key=definition.key,
                entitlement_name=definition.name,
                kind=definition.kind,
                value_type=definition.value_type,
                resource_key=definition.resource_key,
                limit_value=item.limit_value,
                is_unlimited=item.is_unlimited,
                feature_enabled=item.feature_enabled,
            )
        )
    db.flush()

    version.status = CatalogVersionStatus.PUBLISHED
    version.published_at = now

    # Legacy columns/tables remain a compatibility projection of the latest
    # published catalog. Existing subscriptions resolve immutable snapshots.
    plan.monthly_price = monthly_price
    plan.annual_price = annual_price
    plan.currency = currency.strip().upper()
    plan.trial_days = trial_days
    plan.grace_period_days = grace_period_days
    existing_rows = {
        row.entitlement_id: row
        for row in db.query(PlanEntitlement).filter(PlanEntitlement.plan_id == plan.id).all()
    }
    requested_ids = {item.entitlement_id for item, _definition in resolved}
    for entitlement_id, row in existing_rows.items():
        if entitlement_id not in requested_ids:
            db.delete(row)
    for item, definition in resolved:
        row = existing_rows.get(definition.id)
        if not row:
            row = PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id)
            db.add(row)
        row.limit_value = item.limit_value
        row.is_unlimited = item.is_unlimited
        row.feature_enabled = item.feature_enabled
    db.flush()
    db.refresh(version)
    return version


def publish_plan_catalog_version(
    db: Session,
    plan_id: int,
    payload: PlanCatalogPublishRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> PlanCatalogVersionResponse:
    plan = db.query(Plan).filter(Plan.id == plan_id).with_for_update().first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    latest = _latest_published_catalog_version(db, plan.id)
    if (
        payload.expected_latest_version_number is not None
        and (
            latest is None
            or latest.version_number != payload.expected_latest_version_number
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CATALOG_VERSION_CONFLICT",
                "message": "The catalog changed since this draft was prepared. Refresh and review the latest version.",
                "current_version_number": latest.version_number if latest else None,
            },
        )
    version = _publish_catalog_version(
        db,
        plan=plan,
        monthly_price=payload.monthly_price,
        annual_price=payload.annual_price,
        currency=payload.currency,
        trial_days=payload.trial_days,
        grace_period_days=payload.grace_period_days,
        entitlements=payload.entitlements,
        actor_id=actor.id,
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.PLAN_CHANGED,
        entity_type="plan_catalog_version",
        entity_id=version.id,
        new=_catalog_snapshot(version),
        ip_address=ip_address,
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    version = (
        db.query(PlanCatalogVersion)
        .options(joinedload(PlanCatalogVersion.entitlement_snapshots))
        .filter(PlanCatalogVersion.id == version.id)
        .one()
    )
    return PlanCatalogVersionResponse.model_validate(version)


def create_plan(
    db: Session,
    payload: PlanCreateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> Plan:
    code = _normalize_code(payload.code)
    if db.query(Plan).filter(Plan.code == code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plan code already exists")
    _validate_catalog_entitlements(db, payload.entitlements)

    plan = Plan(
        code=code,
        name=payload.name.strip(),
        description=payload.description,
        monthly_price=payload.monthly_price,
        annual_price=payload.annual_price,
        currency=payload.currency.upper(),
        trial_days=payload.trial_days,
        grace_period_days=payload.grace_period_days,
        is_active=payload.is_active,
        is_archived=False,
        display_order=payload.display_order,
    )
    db.add(plan)
    db.flush()
    _publish_catalog_version(
        db,
        plan=plan,
        monthly_price=payload.monthly_price,
        annual_price=payload.annual_price,
        currency=payload.currency,
        trial_days=payload.trial_days,
        grace_period_days=payload.grace_period_days,
        entitlements=payload.entitlements,
        actor_id=actor.id,
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.PLAN_CHANGED,
        entity_type="plan",
        entity_id=plan.id,
        new=_plan_snapshot(plan),
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(plan)
    return plan


def update_plan(
    db: Session,
    plan_id: int,
    payload: PlanUpdateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> Plan:
    plan = _require_plan(db, plan_id)
    previous = _plan_snapshot(plan)

    data = payload.model_dump(exclude_unset=True)
    commercial_fields = {
        "monthly_price",
        "annual_price",
        "currency",
        "trial_days",
        "grace_period_days",
    }
    changed_commercial = {
        field
        for field in commercial_fields.intersection(data)
        if data[field] is not None
        and (
            str(data[field]).upper() if field == "currency" else data[field]
        ) != (
            str(getattr(plan, field)).upper() if field == "currency" else getattr(plan, field)
        )
    }
    if changed_commercial:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CATALOG_PUBLICATION_REQUIRED",
                "message": "Published commercial values require a new catalog version.",
                "details": {"fields": sorted(changed_commercial)},
            },
        )
    if "currency" in data and data["currency"] is not None:
        data["currency"] = data["currency"].upper()

    for field, value in data.items():
        setattr(plan, field, value)

    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.PLAN_CHANGED,
        entity_type="plan",
        entity_id=plan.id,
        previous=previous,
        new=_plan_snapshot(plan),
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(plan)
    return plan


def list_entitlement_definitions(db: Session) -> list[EntitlementDefinition]:
    return (
        db.query(EntitlementDefinition)
        .order_by(EntitlementDefinition.kind.asc(), EntitlementDefinition.key.asc())
        .all()
    )


def create_entitlement_definition(
    db: Session,
    payload: EntitlementDefinitionCreateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> EntitlementDefinition:
    if payload.kind not in EntitlementKind.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid entitlement kind")
    if payload.value_type not in EntitlementValueType.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid entitlement value_type")

    key = payload.key.strip()
    if db.query(EntitlementDefinition).filter(EntitlementDefinition.key == key).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Entitlement key already exists")

    definition = EntitlementDefinition(
        key=key,
        name=payload.name.strip(),
        description=payload.description,
        kind=payload.kind,
        value_type=payload.value_type,
        resource_key=payload.resource_key,
        is_active=payload.is_active,
    )
    db.add(definition)
    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.ENTITLEMENT_CHANGED,
        entity_type="entitlement_definition",
        entity_id=definition.id,
        new={"key": definition.key, "kind": definition.kind},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(definition)
    return definition


def update_entitlement_definition(
    db: Session,
    entitlement_id: int,
    payload: EntitlementDefinitionUpdateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> EntitlementDefinition:
    definition = _require_entitlement(db, entitlement_id)
    previous = {
        "name": definition.name,
        "description": definition.description,
        "is_active": definition.is_active,
    }
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(definition, field, value)
    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.ENTITLEMENT_CHANGED,
        entity_type="entitlement_definition",
        entity_id=definition.id,
        previous=previous,
        new={
            "name": definition.name,
            "description": definition.description,
            "is_active": definition.is_active,
        },
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(definition)
    return definition


def _plan_entitlement_response(row: PlanEntitlement) -> PlanEntitlementResponse:
    definition = row.entitlement
    return PlanEntitlementResponse(
        id=row.id,
        plan_id=row.plan_id,
        entitlement_id=row.entitlement_id,
        entitlement_key=definition.key,
        entitlement_name=definition.name,
        kind=definition.kind,
        resource_key=definition.resource_key,
        limit_value=row.limit_value,
        is_unlimited=row.is_unlimited,
        feature_enabled=row.feature_enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_plan_entitlements(db: Session, plan_id: int) -> list[PlanEntitlementResponse]:
    _require_plan(db, plan_id)
    rows = (
        db.query(PlanEntitlement)
        .options(joinedload(PlanEntitlement.entitlement))
        .filter(PlanEntitlement.plan_id == plan_id)
        .order_by(PlanEntitlement.id.asc())
        .all()
    )
    return [_plan_entitlement_response(row) for row in rows]


def upsert_plan_entitlement(
    db: Session,
    plan_id: int,
    entitlement_id: int,
    payload: EntitlementValuePayload,
    actor: User,
    *,
    ip_address: str | None = None,
) -> PlanEntitlementResponse:
    plan = db.query(Plan).filter(Plan.id == plan_id).with_for_update().first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    definition = _require_entitlement(db, entitlement_id)
    try:
        validate_entitlement_configuration(
            definition=definition,
            limit_value=payload.limit_value,
            is_unlimited=payload.is_unlimited,
            feature_enabled=payload.feature_enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    row = (
        db.query(PlanEntitlement)
        .filter(
            PlanEntitlement.plan_id == plan_id,
            PlanEntitlement.entitlement_id == entitlement_id,
        )
        .first()
    )
    previous = None
    if not row:
        row = PlanEntitlement(plan_id=plan_id, entitlement_id=entitlement_id)
        db.add(row)
    else:
        previous = {
            "limit_value": str(row.limit_value) if row.limit_value is not None else None,
            "is_unlimited": row.is_unlimited,
            "feature_enabled": row.feature_enabled,
        }

    row.limit_value = payload.limit_value
    row.is_unlimited = payload.is_unlimited
    row.feature_enabled = payload.feature_enabled
    db.flush()
    db.refresh(row)
    catalog_payloads = [
        CatalogEntitlementSnapshotRequest(
            entitlement_id=current.entitlement_id,
            limit_value=current.limit_value,
            is_unlimited=current.is_unlimited,
            feature_enabled=current.feature_enabled,
        )
        for current in db.query(PlanEntitlement)
        .filter(PlanEntitlement.plan_id == plan_id)
        .order_by(PlanEntitlement.id.asc())
        .all()
    ]
    version = _publish_catalog_version(
        db,
        plan=plan,
        monthly_price=plan.monthly_price,
        annual_price=plan.annual_price,
        currency=plan.currency,
        trial_days=plan.trial_days,
        grace_period_days=plan.grace_period_days,
        entitlements=catalog_payloads,
        actor_id=actor.id,
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.ENTITLEMENT_CHANGED,
        entity_type="plan_entitlement",
        entity_id=row.id,
        previous=previous,
        new={
            "plan_id": plan_id,
            "entitlement_id": entitlement_id,
            "limit_value": str(row.limit_value) if row.limit_value is not None else None,
            "is_unlimited": row.is_unlimited,
            "feature_enabled": row.feature_enabled,
            "catalog_version_id": version.id,
        },
        ip_address=ip_address,
    )
    db.commit()
    row = (
        db.query(PlanEntitlement)
        .options(joinedload(PlanEntitlement.entitlement))
        .filter(PlanEntitlement.id == row.id)
        .first()
    )
    return _plan_entitlement_response(row)


def list_shop_overrides(db: Session, shop_id: int) -> list[ShopOverrideResponse]:
    _require_shop(db, shop_id)
    rows = (
        db.query(ShopEntitlementOverride)
        .options(joinedload(ShopEntitlementOverride.entitlement))
        .filter(ShopEntitlementOverride.shop_id == shop_id)
        .order_by(ShopEntitlementOverride.created_at.desc(), ShopEntitlementOverride.id.desc())
        .all()
    )
    return [_override_response(row) for row in rows]


def _override_response(row: ShopEntitlementOverride) -> ShopOverrideResponse:
    definition = row.entitlement
    return ShopOverrideResponse(
        id=row.id,
        shop_id=row.shop_id,
        entitlement_id=row.entitlement_id,
        entitlement_key=definition.key,
        kind=definition.kind,
        resource_key=definition.resource_key,
        limit_value=row.limit_value,
        is_unlimited=row.is_unlimited,
        feature_enabled=row.feature_enabled,
        reason=row.reason,
        starts_at=row.starts_at,
        ends_at=row.ends_at,
        created_by_user_id=row.created_by_user_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_shop_override(
    db: Session,
    shop_id: int,
    payload: ShopOverrideCreateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> ShopOverrideResponse:
    # Resource creation uses this same row as the quota serialization point.
    # Locking it here prevents a concurrent lower override from racing a create.
    _lock_shop(db, shop_id)
    definition = _require_entitlement(db, payload.entitlement_id)
    try:
        validate_entitlement_configuration(
            definition=definition,
            limit_value=payload.limit_value,
            is_unlimited=payload.is_unlimited,
            feature_enabled=payload.feature_enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.ends_at and payload.starts_at and payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ends_at must be after starts_at")

    row = ShopEntitlementOverride(
        shop_id=shop_id,
        entitlement_id=payload.entitlement_id,
        limit_value=payload.limit_value,
        is_unlimited=payload.is_unlimited,
        feature_enabled=payload.feature_enabled,
        reason=payload.reason,
        starts_at=payload.starts_at or _utcnow(),
        ends_at=payload.ends_at,
        created_by_user_id=actor.id,
    )
    db.add(row)
    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.SHOP_ENTITLEMENT_OVERRIDE_CHANGED,
        entity_type="shop_entitlement_override",
        entity_id=row.id,
        new={
            "shop_id": shop_id,
            "entitlement_key": definition.key,
            "limit_value": str(row.limit_value) if row.limit_value is not None else None,
            "is_unlimited": row.is_unlimited,
            "feature_enabled": row.feature_enabled,
            "starts_at": row.starts_at,
            "ends_at": row.ends_at,
        },
        reason=payload.reason,
        ip_address=ip_address,
    )
    db.commit()
    row = (
        db.query(ShopEntitlementOverride)
        .options(joinedload(ShopEntitlementOverride.entitlement))
        .filter(ShopEntitlementOverride.id == row.id)
        .first()
    )
    return _override_response(row)


def expire_shop_override(
    db: Session,
    override_id: int,
    actor: User,
    *,
    reason: str | None = None,
    ip_address: str | None = None,
) -> ShopOverrideResponse:
    row = (
        db.query(ShopEntitlementOverride)
        .options(joinedload(ShopEntitlementOverride.entitlement))
        .filter(ShopEntitlementOverride.id == override_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override not found")
    _lock_shop(db, row.shop_id)
    db.refresh(row)
    previous = {"ends_at": row.ends_at}
    row.ends_at = _utcnow()
    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.SHOP_ENTITLEMENT_OVERRIDE_CHANGED,
        entity_type="shop_entitlement_override",
        entity_id=row.id,
        previous=previous,
        new={"ends_at": row.ends_at},
        reason=reason,
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(row)
    return _override_response(row)


def assign_shop_subscription(
    db: Session,
    shop_id: int,
    payload: SubscriptionAssignRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> ShopSubscription:
    # A direct assignment can change effective quota values, so it shares the
    # same lock boundary as quota-consuming resource creation.
    _lock_shop(db, shop_id)
    plan = _require_assignable_plan(db, payload.plan_id)
    catalog_version = _ensure_baseline_catalog_version(db, plan)
    if payload.status not in SubscriptionStatus.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid subscription status")
    if payload.billing_interval not in BillingInterval.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval")

    try:
        normalized_reason = require_reason(payload.reason)
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    subscription = _latest_subscription_for_update(db, shop_id)
    previous = None
    if subscription:
        previous = {
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_interval": subscription.billing_interval,
        }
        if subscription.status != payload.status:
            try:
                transition_subscription(
                    subscription,
                    payload.status,
                    reason=normalized_reason,
                )
            except CommercialTransitionError as exc:
                raise _transition_conflict(exc) from exc
    else:
        subscription = ShopSubscription(
            shop_id=shop_id,
            status=payload.status,
            billing_interval=payload.billing_interval,
        )
        db.add(subscription)

    now = _utcnow()
    subscription.plan_id = plan.id
    subscription.catalog_version_id = catalog_version.id
    if previous is None:
        subscription.status = payload.status
    subscription.billing_interval = payload.billing_interval
    subscription.current_period_start = payload.current_period_start or subscription.current_period_start or now
    subscription.current_period_end = payload.current_period_end
    db.flush()

    if not _latest_license(db, subscription.id):
        license_row, _raw_key = create_license_for_subscription(
            db=db,
            subscription=subscription,
            status=LicenseStatus.ACTIVE if payload.status == SubscriptionStatus.ACTIVE else LicenseStatus.PENDING,
        )
        db.flush()
        db.add(
            LicenseEvent(
                license_id=license_row.id,
                shop_id=shop_id,
                event_type="created",
                new_value="license created for subscription",
                reason=normalized_reason,
            )
        )

    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=shop_id,
            event_type="assigned",
            previous_value=_json(previous) if previous is not None else None,
            new_value=_json({"plan_id": plan.id, "status": payload.status}),
            reason=normalized_reason,
        )
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.SUBSCRIPTION_CHANGED,
        entity_type="shop_subscription",
        entity_id=subscription.id,
        previous=previous,
        new={"shop_id": shop_id, "plan_id": plan.id, "status": payload.status},
        reason=normalized_reason,
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(subscription)
    return subscription


def update_subscription_status(
    db: Session,
    subscription_id: int,
    new_status: str,
    actor: User,
    *,
    reason: str | None = None,
    ip_address: str | None = None,
) -> ShopSubscription:
    if new_status not in SubscriptionStatus.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid subscription status")
    existing = (
        db.query(ShopSubscription)
        .filter(ShopSubscription.id == subscription_id)
        .first()
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    _lock_shop(db, existing.shop_id)
    subscription = (
        db.query(ShopSubscription)
        .filter(ShopSubscription.id == subscription_id)
        .with_for_update()
        .one()
    )
    previous = subscription.status
    try:
        normalized_reason = transition_subscription(
            subscription,
            new_status,
            reason=reason,
        )
    except CommercialTransitionError as exc:
        raise _transition_conflict(exc) from exc

    if new_status == SubscriptionStatus.ACTIVE:
        access_end = as_utc(subscription.current_period_end or subscription.trial_end_at)
        if access_end is not None and access_end < _utcnow():
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Expired subscription time cannot be reactivated without renewal",
            )
    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=subscription.shop_id,
            event_type="status_changed",
            previous_value=previous,
            new_value=new_status,
            reason=normalized_reason,
        )
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.SUBSCRIPTION_CHANGED,
        entity_type="shop_subscription",
        entity_id=subscription.id,
        previous=previous,
        new=new_status,
        reason=normalized_reason,
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(subscription)
    return subscription


def update_license_status(
    db: Session,
    license_id: int,
    new_status: str,
    actor: User,
    *,
    reason: str | None = None,
    ip_address: str | None = None,
) -> ShopLicense:
    if new_status not in LicenseStatus.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid license status")
    existing = (
        db.query(ShopLicense)
        .filter(ShopLicense.id == license_id)
        .first()
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    _lock_shop(db, existing.shop_id)
    license_row = (
        db.query(ShopLicense)
        .filter(ShopLicense.id == license_id)
        .with_for_update()
        .one()
    )

    normalized_reason = (reason or "").strip()
    if not normalized_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reason is required for license status changes",
        )

    previous = license_row.status
    if previous == new_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"License is already {new_status}",
        )

    now = _utcnow()
    allowed_transitions = {
        LicenseStatus.PENDING: {LicenseStatus.ACTIVE, LicenseStatus.SUSPENDED, LicenseStatus.EXPIRED, LicenseStatus.REVOKED},
        LicenseStatus.ACTIVE: {LicenseStatus.SUSPENDED, LicenseStatus.EXPIRED, LicenseStatus.REVOKED},
        LicenseStatus.SUSPENDED: {LicenseStatus.ACTIVE, LicenseStatus.EXPIRED, LicenseStatus.REVOKED},
        LicenseStatus.EXPIRED: {LicenseStatus.REVOKED},
        LicenseStatus.REVOKED: set(),
    }
    if new_status not in allowed_transitions.get(previous, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change license status from {previous} to {new_status}",
        )

    if new_status == LicenseStatus.ACTIVE:
        subscription = (
            db.query(ShopSubscription)
            .options(joinedload(ShopSubscription.plan))
            .filter(ShopSubscription.id == license_row.subscription_id)
            .first()
        )
        if not subscription:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

        if subscription.status not in (SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The associated subscription is not valid for license reactivation",
            )

        current_period_end = subscription.current_period_end
        if current_period_end is not None:
            if current_period_end.tzinfo is None:
                current_period_end = current_period_end.replace(tzinfo=timezone.utc)
            else:
                current_period_end = current_period_end.astimezone(timezone.utc)
            grace_days = int(getattr(subscription.plan, "grace_period_days", 0) or 0)
            if current_period_end < now and (
                grace_days <= 0 or current_period_end + timedelta(days=grace_days) < now
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The associated subscription period has expired; renewal is required before license reactivation",
                )

        trial_end = subscription.trial_end_at
        if trial_end is not None:
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            else:
                trial_end = trial_end.astimezone(timezone.utc)
            if (
                subscription.status == SubscriptionStatus.ACTIVE
                and trial_end < now
                and subscription.current_period_end is None
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The associated trial has expired; renewal is required before license reactivation",
                )

        license_expires_at = license_row.expires_at
        if license_expires_at is not None:
            if license_expires_at.tzinfo is None:
                license_expires_at = license_expires_at.replace(tzinfo=timezone.utc)
            else:
                license_expires_at = license_expires_at.astimezone(timezone.utc)
            if license_expires_at < now:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Expired licenses require renewal or a future reissue workflow before reactivation",
                )

    license_row.status = new_status

    if new_status == LicenseStatus.ACTIVE:
        license_row.revoked_at = None
        if not license_row.activated_at:
            license_row.activated_at = now

    if new_status == LicenseStatus.REVOKED:
        license_row.revoked_at = now
    if new_status == LicenseStatus.EXPIRED:
        license_row.expires_at = license_row.expires_at or now

    db.add(
        LicenseEvent(
            license_id=license_row.id,
            shop_id=license_row.shop_id,
            event_type="status_changed",
            previous_value=previous,
            new_value=new_status,
            reason=normalized_reason,
        )
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.LICENSE_CHANGED,
        entity_type="shop_license",
        entity_id=license_row.id,
        previous={"status": previous, "shop_id": license_row.shop_id},
        new={"status": new_status, "shop_id": license_row.shop_id},
        reason=normalized_reason,
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(license_row)
    return license_row


def issue_replacement_license(
    db: Session,
    subscription_id: int,
    actor: User,
    *,
    reason: str,
    ip_address: str | None = None,
) -> ShopLicense:
    try:
        normalized_reason = require_reason(reason)
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    existing_subscription = (
        db.query(ShopSubscription)
        .filter(ShopSubscription.id == subscription_id)
        .first()
    )
    if not existing_subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    _lock_shop(db, existing_subscription.shop_id)
    subscription = (
        db.query(ShopSubscription)
        .filter(ShopSubscription.id == subscription_id)
        .with_for_update()
        .one()
    )

    latest = _latest_license_for_update(db, subscription.id)
    if not latest or latest.status != LicenseStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A replacement may only be issued after an explicit license revocation",
        )

    replacement, _raw_key = create_license_for_subscription(
        db=db,
        subscription=subscription,
        status=LicenseStatus.PENDING,
    )
    db.flush()
    db.add(
        LicenseEvent(
            license_id=replacement.id,
            shop_id=subscription.shop_id,
            event_type="replacement_issued",
            previous_value=str(latest.id),
            new_value=LicenseStatus.PENDING,
            reason=normalized_reason,
        )
    )
    _audit(
        db,
        actor=actor,
        action=AuditAction.LICENSE_CHANGED,
        entity_type="shop_license",
        entity_id=replacement.id,
        previous={"revoked_license_id": latest.id},
        new={"status": replacement.status, "masked_key": replacement.masked_key},
        reason=normalized_reason,
        ip_address=ip_address,
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(replacement)
    return replacement


def record_payment(
    db: Session,
    payload: PaymentCreateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> SubscriptionPayment:
    # Acquire the commercial aggregate lock before inserting a payment row.
    # PostgreSQL otherwise takes an FK key-share lock during INSERT and two
    # concurrent renewals can deadlock when both later request this row lock.
    _lock_shop(db, payload.shop_id)
    plan = _require_assignable_plan(db, payload.plan_id)
    catalog_version = _resolve_checkout_catalog_version(
        db,
        shop_id=payload.shop_id,
        plan=plan,
        requested_version_id=payload.catalog_version_id,
    )
    if payload.provider.strip().lower() != ADMIN_MANUAL_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrative payment records must use the manual provider",
        )
    if payload.status not in {
        SubscriptionPaymentStatus.PENDING,
        SubscriptionPaymentStatus.SUCCEEDED,
        SubscriptionPaymentStatus.FAILED,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid initial manual payment status",
        )
    try:
        normalized_reason = require_reason(payload.reason)
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _validate_catalog_payment(
        catalog_version,
        payload.amount,
        payload.currency,
        payload.billing_interval,
    )

    existing = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == ADMIN_MANUAL_PROVIDER,
            SubscriptionPayment.provider_payment_id == payload.provider_payment_id,
        )
        .first()
    )
    if existing:
        if not _same_payment_request(existing, payload, catalog_version.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Payment identifier is already used for different commercial data",
            )
        return existing

    now = _utcnow()
    payment = SubscriptionPayment(
        shop_id=payload.shop_id,
        plan_id=payload.plan_id,
        catalog_version_id=catalog_version.id,
        provider=ADMIN_MANUAL_PROVIDER,
        provider_payment_id=payload.provider_payment_id.strip(),
        provider_order_id=payload.provider_order_id,
        provider_event_id=payload.provider_event_id,
        status=SubscriptionPaymentStatus.PENDING,
        amount=payload.amount,
        currency=payload.currency.upper(),
        billing_interval=payload.billing_interval,
        reviewed_at=now,
        reviewed_by_user_id=actor.id,
    )
    db.add(payment)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        concurrent = (
            db.query(SubscriptionPayment)
            .filter(
                SubscriptionPayment.provider == ADMIN_MANUAL_PROVIDER,
                SubscriptionPayment.provider_payment_id == payload.provider_payment_id.strip(),
            )
            .first()
        )
        if concurrent and _same_payment_request(concurrent, payload, catalog_version.id):
            return concurrent
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment identifier is already in use",
        ) from exc

    reconciliation_required = False
    try:
        if payload.status == SubscriptionPaymentStatus.SUCCEEDED:
            transition_payment(payment, SubscriptionPaymentStatus.SUCCEEDED, effective_at=now)
            _subscription, reconciliation_required = _activate_paid_subscription(
                db=db,
                payment=payment,
                reason=normalized_reason,
            )
        elif payload.status == SubscriptionPaymentStatus.FAILED:
            transition_payment(payment, SubscriptionPaymentStatus.FAILED, effective_at=now)
            payment.failure_reason = normalized_reason

        _audit(
            db,
            actor=actor,
            action=AuditAction.PAYMENT_CHANGED,
            entity_type="subscription_payment",
            entity_id=payment.id,
            new={
                "shop_id": payment.shop_id,
                "status": payment.status,
                "amount": str(payment.amount),
                "currency": payment.currency,
                "provider": payment.provider,
                "reconciliation_required": reconciliation_required,
            },
            reason=normalized_reason,
            ip_address=ip_address,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payment)
    return payment


def _gateway_settings(config: PaymentGatewayConfig) -> dict[str, Any]:
    if not config.settings_encrypted:
        return {}
    try:
        value = json.loads(decrypt_secret(config.settings_encrypted))
    except (ValueError, TypeError):
        return {}
    return value if isinstance(value, dict) else {}


def _gateway_response(config: PaymentGatewayConfig) -> PaymentGatewayConfigResponse:
    return PaymentGatewayConfigResponse(
        id=config.id,
        provider=config.provider,
        display_name=config.display_name,
        key_id=config.key_id,
        key_secret_masked=mask_secret(decrypt_secret(config.key_secret_encrypted))
        if config.key_secret_encrypted
        else None,
        webhook_secret_masked=mask_secret(decrypt_secret(config.webhook_secret_encrypted))
        if config.webhook_secret_encrypted
        else None,
        settings=_gateway_settings(config),
        is_active=config.is_active,
        is_test_mode=config.is_test_mode,
        created_by_user_id=config.created_by_user_id,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


def get_payment_gateway_configs(db: Session) -> list[PaymentGatewayConfigResponse]:
    rows = (
        db.query(PaymentGatewayConfig)
        .order_by(PaymentGatewayConfig.provider.asc(), PaymentGatewayConfig.id.asc())
        .all()
    )
    return [_gateway_response(row) for row in rows]


def save_payment_gateway_config(
    db: Session,
    payload: PaymentGatewayConfigRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> PaymentGatewayConfigResponse:
    provider = payload.provider.strip().lower()
    if provider not in SUPPORTED_PAYMENT_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported payment provider.",
        )

    config = (
        db.query(PaymentGatewayConfig)
        .filter(PaymentGatewayConfig.provider == provider)
        .first()
    )
    previous = None
    if not config:
        config = PaymentGatewayConfig(
            provider=provider,
            display_name=payload.display_name.strip(),
        )
        db.add(config)
    else:
        previous = {
            "provider": config.provider,
            "key_id": config.key_id,
            "is_active": config.is_active,
            "is_test_mode": config.is_test_mode,
        }

    config.display_name = payload.display_name.strip()
    if provider == RAZORPAY_PROVIDER:
        key_id = payload.key_id.strip() if payload.key_id else config.key_id
        if not key_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Razorpay Key ID is required.")
        config.key_id = key_id
        if payload.key_secret and payload.key_secret.strip():
            config.key_secret_encrypted = encrypt_secret(payload.key_secret.strip())
        elif not config.key_secret_encrypted:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Razorpay Key Secret is required.")
        if payload.webhook_secret and payload.webhook_secret.strip():
            config.webhook_secret_encrypted = encrypt_secret(payload.webhook_secret.strip())
        config.settings_encrypted = None
    else:
        upi_id = str(payload.settings.get("upi_id") or "").strip().lower()
        payee_name = str(payload.settings.get("payee_name") or "").strip()
        if not UPI_ID_PATTERN.fullmatch(upi_id):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid UPI ID, for example billing@bank.")
        if len(payee_name) < 2 or len(payee_name) > 100:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Payee name must be between 2 and 100 characters.")
        settings = {
            "upi_id": upi_id,
            "payee_name": payee_name,
            "merchant_code": str(payload.settings.get("merchant_code") or "").strip()[:20],
            "note_prefix": str(payload.settings.get("note_prefix") or "Subscription").strip()[:60],
            "instructions": str(payload.settings.get("instructions") or "").strip()[:500],
        }
        config.key_id = None
        config.key_secret_encrypted = None
        config.webhook_secret_encrypted = None
        config.settings_encrypted = encrypt_secret(_json(settings))

    config.is_active = payload.is_active
    config.is_test_mode = payload.is_test_mode
    config.created_by_user_id = actor.id
    db.flush()
    if payload.is_active:
        db.query(PaymentGatewayConfig).filter(
            PaymentGatewayConfig.id != config.id
        ).update({PaymentGatewayConfig.is_active: False}, synchronize_session=False)
    _audit(
        db,
        actor=actor,
        action=AuditAction.PAYMENT_CHANGED,
        entity_type="payment_gateway_config",
        entity_id=config.id,
        previous=previous,
        new={
            "provider": config.provider,
            "is_active": config.is_active,
            "is_test_mode": config.is_test_mode,
        },
        reason="Payment gateway configuration changed",
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(config)
    return _gateway_response(config)


def _active_payment_gateway(db: Session) -> PaymentGatewayConfig:
    config = (
        db.query(PaymentGatewayConfig)
        .filter(PaymentGatewayConfig.is_active == True)  # noqa: E712
        .order_by(PaymentGatewayConfig.updated_at.desc(), PaymentGatewayConfig.id.desc())
        .first()
    )
    if not config:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": DomainErrorCode.PAYMENT_REQUIRED,
                "message": "Online payment is not configured yet.",
                "details": {},
            },
        )
    return config


def _razorpay_config(db: Session) -> PaymentGatewayConfig:
    config = (
        db.query(PaymentGatewayConfig)
        .filter(
            PaymentGatewayConfig.provider == RAZORPAY_PROVIDER,
        )
        .first()
    )
    if not config:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": DomainErrorCode.PAYMENT_REQUIRED,
                "message": "Razorpay is not configured.",
                "details": {"provider": RAZORPAY_PROVIDER},
            },
        )
    return config


def _create_razorpay_order(
    *,
    key_id: str,
    key_secret: str,
    amount: Decimal,
    currency: str,
    receipt: str,
    notes: dict[str, Any],
) -> dict[str, Any]:
    amount_minor_units = int((amount * Decimal("100")).quantize(Decimal("1")))
    body = json.dumps(
        {
            "amount": amount_minor_units,
            "currency": currency,
            "receipt": receipt[:40],
            "notes": notes,
        }
    ).encode("utf-8")
    auth = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        RAZORPAY_ORDERS_URL,
        data=body,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "PAYMENT_GATEWAY_ERROR",
                "message": "Payment gateway rejected the checkout request.",
                "details": {"provider": RAZORPAY_PROVIDER, "response": payload[:500]},
            },
        ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "PAYMENT_GATEWAY_UNAVAILABLE",
                "message": "Payment gateway is unavailable. Please try again.",
                "details": {"provider": RAZORPAY_PROVIDER},
            },
        ) from exc


def list_payments(db: Session, *, shop_id: int | None = None) -> list[SubscriptionPayment]:
    query = db.query(SubscriptionPayment)
    if shop_id:
        query = query.filter(SubscriptionPayment.shop_id == shop_id)
    return query.order_by(SubscriptionPayment.created_at.desc(), SubscriptionPayment.id.desc()).limit(200).all()


def _usage_limit_response(
    db: Session,
    shop_id: int,
    entitlement: EffectiveEntitlement,
) -> UsageLimitResponse:
    usage_supported = False
    used = None
    remaining = None
    code = None
    message = None
    over_limit = False

    if entitlement.resource_key:
        usage = get_usage(shop_id, entitlement.resource_key, db)
        usage_supported = usage.supported
        used = usage.used
        code = usage.code
        message = usage.message
        if usage.supported and used is not None and entitlement.configured and not entitlement.is_unlimited:
            if entitlement.limit_value is not None:
                remaining = entitlement.limit_value - Decimal(used)
                over_limit = remaining < 0
                if remaining < 0:
                    code = DomainErrorCode.SHOP_OVER_LIMIT
                    message = "This shop is over its plan limit."

    return UsageLimitResponse(
        key=entitlement.key,
        resource_key=entitlement.resource_key,
        configured=entitlement.configured,
        source=entitlement.source,
        is_unlimited=entitlement.is_unlimited,
        limit_value=entitlement.limit_value,
        used=used,
        remaining=remaining,
        usage_supported=usage_supported,
        over_limit=over_limit,
        code=code,
        message=message,
    )


def build_shop_subscription_overview(db: Session, shop_id: int) -> ShopSubscriptionOverviewResponse:
    _require_shop(db, shop_id)
    access: CommercialAccess = evaluate_shop_access(shop_id, db)
    subscription = access.subscription or _latest_subscription(db, shop_id)
    license_row = access.license or (_latest_license(db, subscription.id) if subscription else None)
    effective = get_effective_entitlements(shop_id, db) if subscription else {}

    limits: list[UsageLimitResponse] = []
    features: list[FeatureEntitlementResponse] = []
    for entitlement in effective.values():
        if entitlement.kind == EntitlementKind.LIMIT:
            limits.append(_usage_limit_response(db, shop_id, entitlement))
        elif entitlement.kind == EntitlementKind.FEATURE:
            features.append(
                FeatureEntitlementResponse(
                    key=entitlement.key,
                    enabled=bool(entitlement.configured and entitlement.feature_enabled),
                    configured=entitlement.configured,
                    source=entitlement.source,
                )
            )

    return ShopSubscriptionOverviewResponse(
        shop_id=shop_id,
        plan=subscription.plan if subscription else None,
        subscription=subscription,
        license=license_row,
        limits=sorted(limits, key=lambda item: item.key),
        features=sorted(features, key=lambda item: item.key),
        access_allowed=access.allowed,
        access_code=access.code,
        access_message=access.message,
    )


def _create_upi_checkout_session(
    db: Session,
    *,
    shop_id: int,
    plan: Plan,
    catalog_version: PlanCatalogVersion,
    billing_interval: str,
    amount: Decimal,
    config: PaymentGatewayConfig,
) -> CheckoutSessionResponse:
    if catalog_version.currency.upper() != "INR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct UPI collection is available only for INR plans.",
        )
    settings = _gateway_settings(config)
    upi_id = str(settings.get("upi_id") or "")
    payee_name = str(settings.get("payee_name") or "")
    if not UPI_ID_PATTERN.fullmatch(upi_id) or not payee_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The active UPI account is incomplete. Please contact support.",
        )

    payment_id = f"upi_{secrets.token_urlsafe(24)}"
    note_prefix = str(settings.get("note_prefix") or "Subscription")
    note = f"{note_prefix} - {plan.name}"[:80]
    params = {
        "pa": upi_id,
        "pn": payee_name,
        "am": format(amount, ".2f"),
        "cu": "INR",
        "tn": note,
        "tr": payment_id,
    }
    merchant_code = str(settings.get("merchant_code") or "")
    if merchant_code:
        params["mc"] = merchant_code
    upi_uri = f"upi://pay?{urllib.parse.urlencode(params)}"

    payment = SubscriptionPayment(
        shop_id=shop_id,
        plan_id=plan.id,
        catalog_version_id=catalog_version.id,
        provider=UPI_MANUAL_PROVIDER,
        provider_payment_id=payment_id,
        provider_order_id=payment_id,
        status=SubscriptionPaymentStatus.PENDING,
        amount=amount,
        currency="INR",
        billing_interval=billing_interval,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return CheckoutSessionResponse(
        provider=UPI_MANUAL_PROVIDER,
        status="payment_intent_created",
        message="UPI payment details are ready.",
        checkout_url=upi_uri,
        metadata={
            "payment_id": payment_id,
            "amount": format(amount, ".2f"),
            "currency": "INR",
            "plan_id": plan.id,
            "catalog_version_id": catalog_version.id,
            "catalog_version_number": catalog_version.version_number,
            "plan_name": plan.name,
            "billing_interval": billing_interval,
            "upi_id": upi_id,
            "payee_name": payee_name,
            "upi_uri": upi_uri,
            "instructions": settings.get("instructions") or "Pay the exact amount, then submit the UTR shown by your UPI app.",
            "is_test_mode": config.is_test_mode,
        },
    )


def create_checkout_session(
    db: Session,
    shop_id: int,
    payload: CheckoutSessionRequest,
) -> CheckoutSessionResponse:
    _require_shop(db, shop_id)
    plan = _require_assignable_plan(db, payload.plan_id)
    if payload.billing_interval not in (BillingInterval.MONTHLY, BillingInterval.ANNUAL):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval")
    _reject_unsupported_plan_change(_latest_subscription(db, shop_id), plan.id)
    catalog_version = _resolve_checkout_catalog_version(
        db,
        shop_id=shop_id,
        plan=plan,
        requested_version_id=payload.catalog_version_id,
    )
    config = _active_payment_gateway(db)
    amount = _catalog_amount(catalog_version, payload.billing_interval)
    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online checkout requires a paid plan amount.",
        )

    if config.provider == UPI_MANUAL_PROVIDER:
        return _create_upi_checkout_session(
            db,
            shop_id=shop_id,
            plan=plan,
            catalog_version=catalog_version,
            billing_interval=payload.billing_interval,
            amount=amount,
            config=config,
        )
    if config.provider != RAZORPAY_PROVIDER:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The active payment provider is unsupported.")
    if not config.key_id or not config.key_secret_encrypted:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Razorpay configuration is incomplete.")

    key_secret = decrypt_secret(config.key_secret_encrypted)
    now = _utcnow()
    receipt = f"sub_{shop_id}_{plan.id}_{int(now.timestamp())}"
    order = _create_razorpay_order(
        key_id=config.key_id,
        key_secret=key_secret,
        amount=amount,
        currency=catalog_version.currency,
        receipt=receipt,
        notes={
            "shop_id": str(shop_id),
            "plan_id": str(plan.id),
            "catalog_version_id": str(catalog_version.id),
            "billing_interval": payload.billing_interval,
        },
    )
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway did not return an order id.",
        )

    existing = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == RAZORPAY_PROVIDER,
            SubscriptionPayment.provider_order_id == order_id,
        )
        .first()
    )
    if not existing:
        db.add(
            SubscriptionPayment(
                shop_id=shop_id,
                plan_id=plan.id,
                catalog_version_id=catalog_version.id,
                provider=RAZORPAY_PROVIDER,
                provider_payment_id=order_id,
                provider_order_id=order_id,
                status=SubscriptionPaymentStatus.PENDING,
                amount=amount,
                currency=catalog_version.currency,
                billing_interval=payload.billing_interval,
            )
        )
        db.commit()

    return CheckoutSessionResponse(
        provider=RAZORPAY_PROVIDER,
        status="order_created",
        message="Checkout order created.",
        checkout_url=None,
        metadata={
            "key_id": config.key_id,
            "order_id": order_id,
            "amount": order.get("amount"),
            "currency": order.get("currency", catalog_version.currency),
            "plan_id": plan.id,
            "catalog_version_id": catalog_version.id,
            "catalog_version_number": catalog_version.version_number,
            "plan_name": plan.name,
            "billing_interval": payload.billing_interval,
            "is_test_mode": config.is_test_mode,
        },
    )


def submit_upi_payment_reference(
    db: Session,
    shop_id: int,
    payload: UpiPaymentReferenceRequest,
) -> PaymentVerificationResponse:
    payment = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == UPI_MANUAL_PROVIDER,
            SubscriptionPayment.provider_payment_id == payload.payment_id,
            SubscriptionPayment.shop_id == shop_id,
        )
        .with_for_update()
        .first()
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI payment request not found.")
    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        reconciliation_required = _payment_requires_reconciliation(payment)
        return PaymentVerificationResponse(
            status="reconciliation_required" if reconciliation_required else "already_verified",
            message=(
                "Payment is confirmed and requires commercial reconciliation."
                if reconciliation_required
                else "This payment was already approved."
            ),
            subscription=None if reconciliation_required else payment.subscription,
            payment=payment,
        )
    if payment.status == SubscriptionPaymentStatus.FAILED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This payment request was rejected. Please start a new payment.")
    if payment.status == SubscriptionPaymentStatus.SUBMITTED:
        if payment.customer_reference == payload.customer_reference:
            return PaymentVerificationResponse(
                status="already_submitted",
                message="This payment reference is already awaiting review.",
                payment=payment,
            )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A payment reference has already been submitted for this request.")

    duplicate = (
        db.query(SubscriptionPayment.id)
        .filter(
            SubscriptionPayment.provider == UPI_MANUAL_PROVIDER,
            SubscriptionPayment.customer_reference == payload.customer_reference,
            SubscriptionPayment.id != payment.id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This UPI reference has already been submitted.")

    payment.customer_reference = payload.customer_reference
    payment.submitted_at = _utcnow()
    try:
        transition_payment(payment, SubscriptionPaymentStatus.SUBMITTED)
    except CommercialTransitionError as exc:
        raise _transition_conflict(exc) from exc
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This UPI reference has already been submitted.") from exc
    db.refresh(payment)
    return PaymentVerificationResponse(
        status="submitted",
        message="Payment reference submitted for administrator verification.",
        payment=payment,
    )


def _verify_razorpay_signature(order_id: str, payment_id: str, signature: str, key_secret: str) -> bool:
    expected = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _activate_paid_subscription(
    *,
    db: Session,
    payment: SubscriptionPayment,
    provider_event_id: str | None = None,
    reason: str = "Verified payment",
) -> tuple[ShopSubscription, bool]:
    if not payment.plan_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment has no plan")
    if payment.status != SubscriptionPaymentStatus.SUCCEEDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is not confirmed")
    plan = _require_plan(db, payment.plan_id)
    catalog_version = _payment_catalog_version(db, payment)
    legacy_catalog_version = (
        _baseline_catalog_version(db, plan) if catalog_version is None else None
    )
    now = as_utc(payment.paid_at) or _utcnow()
    try:
        term = purchased_term(payment.billing_interval or "")
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    # Serializes both renewal of an existing subscription and first activation,
    # where no subscription row exists yet.
    _lock_shop(db, payment.shop_id)

    subscription = _latest_subscription_for_update(db, payment.shop_id)
    if _requires_cross_plan_reconciliation(subscription, plan.id):
        payment.failure_reason = (
            f"{RECONCILIATION_REQUIRED_PREFIX} verified payment for plan {plan.id} "
            f"cannot replace unexpired paid plan {subscription.plan_id}"
        )
        db.add(
            SubscriptionEvent(
                subscription_id=subscription.id,
                shop_id=payment.shop_id,
                event_type="payment_reconciliation_required",
                previous_value=_json(
                    {
                        "plan_id": subscription.plan_id,
                        "current_period_end": subscription.current_period_end,
                    }
                ),
                new_value=_json(
                    {
                        "payment_id": payment.id,
                        "requested_plan_id": plan.id,
                        "entitlement_applied": False,
                    }
                ),
                provider=payment.provider,
                provider_event_id=provider_event_id or payment.provider_event_id,
                reason="Verified cross-plan payment requires manual reconciliation",
            )
        )
        return subscription, True

    previous = None
    event_type = "payment_activated"
    renewal_start = now
    if subscription:
        previous = {
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_interval": subscription.billing_interval,
            "current_period_end": subscription.current_period_end,
        }
        existing_expiry = as_utc(subscription.current_period_end)
        is_same_paid_plan = (
            subscription.plan_id == plan.id
            and subscription.billing_interval != BillingInterval.LEGACY
            and subscription.status
            in {
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.GRACE_PERIOD,
                SubscriptionStatus.SUSPENDED,
            }
        )
        if is_same_paid_plan and existing_expiry and existing_expiry > now:
            renewal_start = existing_expiry
            event_type = "payment_renewed"
        elif subscription.plan_id != plan.id:
            event_type = "payment_plan_changed"
        elif subscription.status in {SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED}:
            event_type = "payment_recovered"
    else:
        subscription = ShopSubscription(
            shop_id=payment.shop_id,
            plan_id=plan.id,
            catalog_version_id=(
                catalog_version.id if catalog_version else legacy_catalog_version.id
            ),
            status=SubscriptionStatus.PENDING,
            billing_interval=payment.billing_interval or BillingInterval.MONTHLY,
        )
        db.add(subscription)

    current_period_end = renewal_start + term
    if subscription.status != SubscriptionStatus.ACTIVE:
        try:
            transition_subscription(
                subscription,
                SubscriptionStatus.ACTIVE,
                reason=reason,
                operation="payment",
                effective_at=now,
            )
        except CommercialTransitionError as exc:
            raise _transition_conflict(exc) from exc
    subscription.plan_id = plan.id
    if catalog_version:
        subscription.catalog_version_id = catalog_version.id
    elif subscription.catalog_version_id is None:
        subscription.catalog_version_id = legacy_catalog_version.id
    subscription.billing_interval = payment.billing_interval or BillingInterval.MONTHLY
    subscription.provider = payment.provider
    if event_type != "payment_renewed":
        subscription.current_period_start = now
    subscription.current_period_end = current_period_end
    db.flush()

    payment.subscription_id = subscription.id
    license_row = _latest_license_for_update(db, subscription.id)
    if not license_row:
        license_row, _raw_key = create_license_for_subscription(
            db=db,
            subscription=subscription,
            status=LicenseStatus.ACTIVE,
        )
        license_row.expires_at = current_period_end
        db.flush()
        db.add(
            LicenseEvent(
                license_id=license_row.id,
                shop_id=payment.shop_id,
                event_type="created",
                new_value="license created after verified payment",
                reason=reason,
            )
        )
    else:
        previous_license_status = license_row.status
        if previous_license_status == LicenseStatus.REVOKED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The current license is revoked. A super administrator must "
                    "issue an explicit replacement before this payment can be applied."
                ),
            )
        license_row.status = LicenseStatus.ACTIVE
        license_row.activated_at = now
        license_row.expires_at = current_period_end
        license_row.revoked_at = None
        if previous_license_status != LicenseStatus.ACTIVE:
            db.add(
                LicenseEvent(
                    license_id=license_row.id,
                    shop_id=payment.shop_id,
                    event_type="reactivated",
                    previous_value=previous_license_status,
                    new_value=LicenseStatus.ACTIVE,
                    reason=reason,
                )
            )

    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=payment.shop_id,
            event_type=event_type,
            previous_value=_json(previous) if previous is not None else None,
            new_value=_json(
                {
                    "plan_id": plan.id,
                    "catalog_version_id": subscription.catalog_version_id,
                    "status": SubscriptionStatus.ACTIVE,
                    "billing_interval": payment.billing_interval,
                    "renewal_start": renewal_start,
                    "current_period_end": current_period_end,
                }
            ),
            provider=payment.provider,
            provider_event_id=provider_event_id or payment.provider_event_id,
            reason=reason,
        )
    )
    payment.failure_reason = None
    return subscription, False


def review_upi_payment(
    db: Session,
    payment_id: int,
    payload: UpiPaymentReviewRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> PaymentVerificationResponse:
    payment = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.id == payment_id,
            SubscriptionPayment.provider == UPI_MANUAL_PROVIDER,
        )
        .with_for_update()
        .first()
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI payment not found.")
    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        reconciliation_required = _payment_requires_reconciliation(payment)
        return PaymentVerificationResponse(
            status="reconciliation_required" if reconciliation_required else "already_verified",
            message=(
                "Payment is confirmed and requires commercial reconciliation."
                if reconciliation_required
                else "This payment was already approved."
            ),
            subscription=None if reconciliation_required else payment.subscription,
            payment=payment,
        )
    if payment.status != SubscriptionPaymentStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only submitted UPI payments can be reviewed.")

    try:
        normalized_reason = require_reason(payload.reason)
    except CommercialTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not payment.plan_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment has no plan")
    _require_plan(db, payment.plan_id)
    _payment_catalog_version(db, payment)

    previous_status = payment.status
    payment.reviewed_at = _utcnow()
    payment.reviewed_by_user_id = actor.id
    subscription = None
    reconciliation_required = False
    try:
        if payload.status == SubscriptionPaymentStatus.SUCCEEDED:
            transition_payment(
                payment,
                SubscriptionPaymentStatus.SUCCEEDED,
                effective_at=payment.reviewed_at,
            )
            payment.failure_reason = None
            subscription, reconciliation_required = _activate_paid_subscription(
                db=db,
                payment=payment,
                reason=normalized_reason,
            )
        else:
            transition_payment(
                payment,
                SubscriptionPaymentStatus.FAILED,
                effective_at=payment.reviewed_at,
            )
            payment.failure_reason = normalized_reason

        db.flush()
        _audit(
            db,
            actor=actor,
            action=AuditAction.PAYMENT_CHANGED,
            entity_type="subscription_payment",
            entity_id=payment.id,
            previous={"status": previous_status},
            new={
                "status": payment.status,
                "provider": payment.provider,
                "shop_id": payment.shop_id,
                "reconciliation_required": reconciliation_required,
            },
            reason=normalized_reason,
            ip_address=ip_address,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payment)
    if subscription:
        db.refresh(subscription)
    return PaymentVerificationResponse(
        status=(
            "reconciliation_required"
            if reconciliation_required
            else "verified"
            if payment.status == SubscriptionPaymentStatus.SUCCEEDED
            else "rejected"
        ),
        message=(
            "Payment is confirmed and requires commercial reconciliation."
            if reconciliation_required
            else "Payment approved and subscription activated."
            if subscription
            else "Payment was rejected."
        ),
        subscription=None if reconciliation_required else subscription,
        payment=payment,
    )


def verify_razorpay_payment(
    db: Session,
    shop_id: int,
    payload: RazorpayVerifyPaymentRequest,
) -> PaymentVerificationResponse:
    config = _razorpay_config(db)
    key_secret = decrypt_secret(config.key_secret_encrypted)
    if not _verify_razorpay_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
        key_secret,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "PAYMENT_VERIFICATION_FAILED",
                "message": "Payment could not be verified.",
                "details": {},
            },
        )

    payment = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == RAZORPAY_PROVIDER,
            SubscriptionPayment.provider_order_id == payload.razorpay_order_id,
            SubscriptionPayment.shop_id == shop_id,
        )
        .with_for_update()
        .first()
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        reconciliation_required = _payment_requires_reconciliation(payment)
        subscription = (
            db.query(ShopSubscription)
            .filter(ShopSubscription.id == payment.subscription_id)
            .first()
        )
        return PaymentVerificationResponse(
            status="reconciliation_required" if reconciliation_required else "already_verified",
            message=(
                "Payment is confirmed and requires commercial reconciliation."
                if reconciliation_required
                else "Payment was already verified."
            ),
            subscription=None if reconciliation_required else subscription,
            payment=payment,
        )

    if payment.status != SubscriptionPaymentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment cannot be verified from status {payment.status}",
        )
    if not payment.plan_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment has no plan")
    _require_plan(db, payment.plan_id)
    _payment_catalog_version(db, payment)

    try:
        payment.provider_payment_id = payload.razorpay_payment_id
        transition_payment(payment, SubscriptionPaymentStatus.SUCCEEDED)
        subscription, reconciliation_required = _activate_paid_subscription(
            db=db,
            payment=payment,
            reason="Razorpay checkout signature verified",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payment)
    db.refresh(subscription)
    return PaymentVerificationResponse(
        status="reconciliation_required" if reconciliation_required else "verified",
        message=(
            "Payment is confirmed and requires commercial reconciliation."
            if reconciliation_required
            else "Payment verified and subscription activated."
        ),
        subscription=None if reconciliation_required else subscription,
        payment=payment,
    )


def handle_razorpay_webhook(
    db: Session,
    *,
    raw_body: bytes,
    signature: str | None,
) -> dict[str, str]:
    config = _razorpay_config(db)
    if not config.webhook_secret_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook secret is not configured")
    webhook_secret = decrypt_secret(config.webhook_secret_encrypted)
    expected = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload") from exc
    event_id = payload.get("id")
    event_type = payload.get("event")
    if event_type != "payment.captured":
        return {"status": "ignored", "message": "Webhook event ignored"}
    if not event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook event id is required")

    existing_event = (
        db.query(PaymentWebhookEvent)
        .filter(
            PaymentWebhookEvent.provider == RAZORPAY_PROVIDER,
            PaymentWebhookEvent.provider_event_id == event_id,
        )
        .first()
    )
    if existing_event:
        if existing_event.payment and _payment_requires_reconciliation(existing_event.payment):
            return {
                "status": "reconciliation_required",
                "message": "Payment is confirmed and requires commercial reconciliation",
            }
        return {"status": "duplicate", "message": "Webhook already processed"}

    webhook_event = PaymentWebhookEvent(
        provider=RAZORPAY_PROVIDER,
        provider_event_id=event_id,
        event_type=event_type,
        status="processing",
        payload_sha256=hashlib.sha256(raw_body).hexdigest(),
    )
    db.add(webhook_event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook already processed"}

    payment_entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")
    if not order_id or not payment_id:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captured payment webhook has no payment/order id",
        )

    payment = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == RAZORPAY_PROVIDER,
            SubscriptionPayment.provider_order_id == order_id,
        )
        .with_for_update()
        .first()
    )
    if not payment:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No matching subscription checkout order",
        )

    if not payment.plan_id:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment has no plan")
    _require_plan(db, payment.plan_id)
    _payment_catalog_version(db, payment)
    gateway_amount = payment_entity.get("amount")
    gateway_currency = payment_entity.get("currency")
    expected_minor = int((Decimal(payment.amount) * Decimal("100")).quantize(Decimal("1")))
    if gateway_amount is None or int(gateway_amount) != expected_minor:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Webhook amount mismatch")
    if not gateway_currency or str(gateway_currency).upper() != payment.currency.upper():
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Webhook currency mismatch")

    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        payment.provider_event_id = payment.provider_event_id or event_id
        webhook_event.payment_id = payment.id
        webhook_event.status = "applied"
        db.commit()
        if _payment_requires_reconciliation(payment):
            return {
                "status": "reconciliation_required",
                "message": "Payment is confirmed and requires commercial reconciliation",
            }
        return {"status": "duplicate", "message": "Payment already processed"}

    if payment.status != SubscriptionPaymentStatus.PENDING:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment cannot be confirmed from status {payment.status}",
        )

    try:
        payment.provider_payment_id = payment_id
        payment.provider_event_id = event_id
        transition_payment(payment, SubscriptionPaymentStatus.SUCCEEDED)
        _subscription, reconciliation_required = _activate_paid_subscription(
            db=db,
            payment=payment,
            provider_event_id=event_id,
            reason="Razorpay payment.captured webhook verified",
        )
        webhook_event.payment_id = payment.id
        webhook_event.status = "applied"
        db.commit()
    except Exception:
        db.rollback()
        raise
    if reconciliation_required:
        return {
            "status": "reconciliation_required",
            "message": "Payment is confirmed and requires commercial reconciliation",
        }
    return {"status": "processed", "message": "Payment webhook processed"}
