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
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.subscription import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    EntitlementDefinitionCreateRequest,
    EntitlementDefinitionUpdateRequest,
    EntitlementValuePayload,
    FeatureEntitlementResponse,
    PaymentCreateRequest,
    PaymentGatewayConfigRequest,
    PaymentGatewayConfigResponse,
    PaymentVerificationResponse,
    PlanCreateRequest,
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

RAZORPAY_PROVIDER = "razorpay"
UPI_MANUAL_PROVIDER = "upi_manual"
SUPPORTED_PAYMENT_PROVIDERS = (RAZORPAY_PROVIDER, UPI_MANUAL_PROVIDER)
RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
UPI_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json(value: Any) -> str:
    return json.dumps(value, default=str, sort_keys=True)


def _normalize_code(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def _require_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
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
        .options(joinedload(ShopSubscription.plan))
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


def list_plans(db: Session, *, include_archived: bool = False) -> list[Plan]:
    query = db.query(Plan)
    if not include_archived:
        query = query.filter(Plan.is_archived == False)  # noqa: E712
    return query.order_by(Plan.display_order.asc(), Plan.id.asc()).all()


def list_public_plan_catalog(db: Session) -> list[PublicPlanResponse]:
    plans = (
        db.query(Plan)
        .options(
            joinedload(Plan.entitlements).joinedload(PlanEntitlement.entitlement),
        )
        .filter(
            Plan.is_archived == False,  # noqa: E712
            Plan.is_active == True,  # noqa: E712
        )
        .order_by(Plan.display_order.asc(), Plan.id.asc())
        .all()
    )
    return [
        PublicPlanResponse(
            id=plan.id,
            code=plan.code,
            name=plan.name,
            description=plan.description,
            monthly_price=plan.monthly_price,
            annual_price=plan.annual_price,
            currency=plan.currency,
            trial_days=plan.trial_days,
            grace_period_days=plan.grace_period_days,
            is_active=plan.is_active,
            is_archived=plan.is_archived,
            display_order=plan.display_order,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            entitlements=[
                _plan_entitlement_response(row)
                for row in sorted(plan.entitlements, key=lambda item: item.id)
                if row.entitlement and row.entitlement.is_active
            ],
        )
        for plan in plans
    ]


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
    _require_plan(db, plan_id)
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
    _require_shop(db, shop_id)
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
    _require_shop(db, shop_id)
    plan = _require_assignable_plan(db, payload.plan_id)
    if payload.status not in SubscriptionStatus.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid subscription status")
    if payload.billing_interval not in BillingInterval.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval")

    subscription = _latest_subscription(db, shop_id)
    previous = None
    if subscription:
        previous = {
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_interval": subscription.billing_interval,
        }
    else:
        subscription = ShopSubscription(shop_id=shop_id)
        db.add(subscription)

    now = _utcnow()
    subscription.plan_id = plan.id
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
                reason=payload.reason,
            )
        )

    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=shop_id,
            event_type="assigned",
            previous_value=_json(previous) if previous is not None else None,
            new_value=_json({"plan_id": plan.id, "status": payload.status}),
            reason=payload.reason,
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
        reason=payload.reason,
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
    subscription = db.query(ShopSubscription).filter(ShopSubscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    previous = subscription.status
    subscription.status = new_status
    if new_status == SubscriptionStatus.CANCELLED:
        subscription.cancelled_at = _utcnow()
    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=subscription.shop_id,
            event_type="status_changed",
            previous_value=previous,
            new_value=new_status,
            reason=reason,
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
        reason=reason,
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
    license_row = db.query(ShopLicense).filter(ShopLicense.id == license_id).first()
    if not license_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

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


def record_payment(
    db: Session,
    payload: PaymentCreateRequest,
    actor: User,
    *,
    ip_address: str | None = None,
) -> SubscriptionPayment:
    _require_shop(db, payload.shop_id)
    plan = _require_assignable_plan(db, payload.plan_id)
    existing = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == payload.provider,
            SubscriptionPayment.provider_payment_id == payload.provider_payment_id,
        )
        .first()
    )
    if existing:
        return existing

    if payload.status not in SubscriptionPaymentStatus.ALL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment status")

    subscription = _latest_subscription(db, payload.shop_id)
    now = _utcnow()
    if payload.status == SubscriptionPaymentStatus.SUCCEEDED:
        current_period_end = (
            now + timedelta(days=365)
            if payload.billing_interval == BillingInterval.ANNUAL
            else now + timedelta(days=30)
        )
        previous_subscription = None
        if subscription:
            previous_subscription = {
                "plan_id": subscription.plan_id,
                "status": subscription.status,
                "billing_interval": subscription.billing_interval,
            }
        else:
            subscription = ShopSubscription(shop_id=payload.shop_id)
            db.add(subscription)

        subscription.plan_id = plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.billing_interval = payload.billing_interval
        subscription.current_period_start = now
        subscription.current_period_end = current_period_end
        db.flush()

        if not _latest_license(db, subscription.id):
            license_row, _raw_key = create_license_for_subscription(
                db=db,
                subscription=subscription,
                status=LicenseStatus.ACTIVE,
            )
            db.flush()
            db.add(
                LicenseEvent(
                    license_id=license_row.id,
                    shop_id=payload.shop_id,
                    event_type="created",
                    new_value="license created for paid subscription",
                    reason=payload.reason,
                )
            )
            _audit(
                db,
                actor=actor,
                action=AuditAction.LICENSE_CHANGED,
                entity_type="shop_license",
                entity_id=license_row.id,
                new={"status": license_row.status, "masked_key": license_row.masked_key},
                reason=payload.reason,
                ip_address=ip_address,
            )

        db.add(
            SubscriptionEvent(
                subscription_id=subscription.id,
                shop_id=payload.shop_id,
                event_type="payment_activated",
                previous_value=_json(previous_subscription) if previous_subscription is not None else None,
                new_value=_json(
                    {
                        "plan_id": plan.id,
                        "status": SubscriptionStatus.ACTIVE,
                        "billing_interval": payload.billing_interval,
                    }
                ),
                provider=payload.provider,
                provider_event_id=payload.provider_event_id,
                reason=payload.reason,
            )
        )
        _audit(
            db,
            actor=actor,
            action=AuditAction.SUBSCRIPTION_CHANGED,
            entity_type="shop_subscription",
            entity_id=subscription.id,
            previous=previous_subscription,
            new={
                "shop_id": payload.shop_id,
                "plan_id": plan.id,
                "status": SubscriptionStatus.ACTIVE,
                "billing_interval": payload.billing_interval,
            },
            reason=payload.reason,
            ip_address=ip_address,
        )

    payment = SubscriptionPayment(
        shop_id=payload.shop_id,
        plan_id=payload.plan_id,
        subscription_id=subscription.id if subscription else None,
        provider=payload.provider,
        provider_payment_id=payload.provider_payment_id,
        provider_order_id=payload.provider_order_id,
        provider_event_id=payload.provider_event_id,
        status=payload.status,
        amount=payload.amount,
        currency=payload.currency.upper(),
        billing_interval=payload.billing_interval,
        paid_at=now if payload.status == SubscriptionPaymentStatus.SUCCEEDED else None,
        failure_reason=payload.reason if payload.status == SubscriptionPaymentStatus.FAILED else None,
    )
    db.add(payment)
    db.flush()
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
        },
        reason=payload.reason,
        ip_address=ip_address,
    )
    db.commit()
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


def _plan_amount(plan: Plan, billing_interval: str) -> Decimal:
    if billing_interval == BillingInterval.ANNUAL:
        return Decimal(plan.annual_price or 0)
    if billing_interval == BillingInterval.MONTHLY:
        return Decimal(plan.monthly_price or 0)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval")


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
    billing_interval: str,
    amount: Decimal,
    config: PaymentGatewayConfig,
) -> CheckoutSessionResponse:
    if plan.currency.upper() != "INR":
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
    config = _active_payment_gateway(db)
    amount = _plan_amount(plan, payload.billing_interval)
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
        currency=plan.currency,
        receipt=receipt,
        notes={
            "shop_id": str(shop_id),
            "plan_id": str(plan.id),
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
                provider=RAZORPAY_PROVIDER,
                provider_payment_id=order_id,
                provider_order_id=order_id,
                status=SubscriptionPaymentStatus.PENDING,
                amount=amount,
                currency=plan.currency,
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
            "currency": order.get("currency", plan.currency),
            "plan_id": plan.id,
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
        return PaymentVerificationResponse(
            status="already_verified",
            message="This payment was already approved.",
            subscription=payment.subscription,
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
    payment.status = SubscriptionPaymentStatus.SUBMITTED
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
) -> ShopSubscription:
    if not payment.plan_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment has no plan")
    plan = _require_assignable_plan(db, payment.plan_id)
    now = _utcnow()
    current_period_end = (
        now + timedelta(days=365)
        if payment.billing_interval == BillingInterval.ANNUAL
        else now + timedelta(days=30)
    )
    subscription = _latest_subscription(db, payment.shop_id)
    previous = None
    if subscription:
        previous = {
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_interval": subscription.billing_interval,
        }
    else:
        subscription = ShopSubscription(shop_id=payment.shop_id)
        db.add(subscription)

    subscription.plan_id = plan.id
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.billing_interval = payment.billing_interval or BillingInterval.MONTHLY
    subscription.provider = payment.provider
    subscription.current_period_start = now
    subscription.current_period_end = current_period_end
    db.flush()

    payment.subscription_id = subscription.id
    license_row = _latest_license(db, subscription.id)
    if not license_row:
        license_row, _raw_key = create_license_for_subscription(
            db=db,
            subscription=subscription,
            status=LicenseStatus.ACTIVE,
        )
        db.flush()
        db.add(
            LicenseEvent(
                license_id=license_row.id,
                shop_id=payment.shop_id,
                event_type="created",
                new_value="license created after verified payment",
            )
        )
    else:
        previous_license_status = license_row.status
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
                    reason="License reactivated after verified payment",
                )
            )

    db.add(
        SubscriptionEvent(
            subscription_id=subscription.id,
            shop_id=payment.shop_id,
            event_type="payment_verified",
            previous_value=_json(previous) if previous is not None else None,
            new_value=_json(
                {
                    "plan_id": plan.id,
                    "status": SubscriptionStatus.ACTIVE,
                    "billing_interval": payment.billing_interval,
                }
            ),
            provider=payment.provider,
            provider_event_id=provider_event_id or payment.provider_event_id,
            reason="Verified payment",
        )
    )
    return subscription


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
        return PaymentVerificationResponse(
            status="already_verified",
            message="This payment was already approved.",
            subscription=payment.subscription,
            payment=payment,
        )
    if payment.status != SubscriptionPaymentStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only submitted UPI payments can be reviewed.")

    previous_status = payment.status
    payment.reviewed_at = _utcnow()
    payment.reviewed_by_user_id = actor.id
    subscription = None
    if payload.status == SubscriptionPaymentStatus.SUCCEEDED:
        payment.status = SubscriptionPaymentStatus.SUCCEEDED
        payment.paid_at = payment.reviewed_at
        payment.failure_reason = None
        subscription = _activate_paid_subscription(db=db, payment=payment)
    else:
        payment.status = SubscriptionPaymentStatus.FAILED
        payment.failure_reason = payload.reason or "UPI payment could not be verified."

    db.flush()
    _audit(
        db,
        actor=actor,
        action=AuditAction.PAYMENT_CHANGED,
        entity_type="subscription_payment",
        entity_id=payment.id,
        previous={"status": previous_status},
        new={"status": payment.status, "provider": payment.provider, "shop_id": payment.shop_id},
        reason=payload.reason or "UPI payment reviewed",
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(payment)
    if subscription:
        db.refresh(subscription)
    return PaymentVerificationResponse(
        status="verified" if payment.status == SubscriptionPaymentStatus.SUCCEEDED else "rejected",
        message="Payment approved and subscription activated." if subscription else "Payment was rejected.",
        subscription=subscription,
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
        .first()
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        subscription = (
            db.query(ShopSubscription)
            .filter(ShopSubscription.id == payment.subscription_id)
            .first()
        )
        return PaymentVerificationResponse(
            status="already_verified",
            message="Payment was already verified.",
            subscription=subscription,
            payment=payment,
        )

    payment.provider_payment_id = payload.razorpay_payment_id
    payment.status = SubscriptionPaymentStatus.SUCCEEDED
    payment.paid_at = _utcnow()
    subscription = _activate_paid_subscription(db=db, payment=payment)
    db.commit()
    db.refresh(payment)
    db.refresh(subscription)
    return PaymentVerificationResponse(
        status="verified",
        message="Payment verified and subscription activated.",
        subscription=subscription,
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

    payload = json.loads(raw_body.decode("utf-8"))
    event_id = payload.get("id")
    event_type = payload.get("event")
    if event_id:
        existing = (
            db.query(SubscriptionPayment)
            .filter(
                SubscriptionPayment.provider == RAZORPAY_PROVIDER,
                SubscriptionPayment.provider_event_id == event_id,
                SubscriptionPayment.status == SubscriptionPaymentStatus.SUCCEEDED,
            )
            .first()
        )
        if existing:
            return {"status": "duplicate", "message": "Webhook already processed"}

    if event_type != "payment.captured":
        return {"status": "ignored", "message": "Webhook event ignored"}

    payment_entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")
    if not order_id or not payment_id:
        return {"status": "ignored", "message": "Webhook has no payment/order id"}

    payment = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.provider == RAZORPAY_PROVIDER,
            SubscriptionPayment.provider_order_id == order_id,
        )
        .first()
    )
    if not payment:
        return {"status": "ignored", "message": "No matching subscription checkout order"}

    if payment.status == SubscriptionPaymentStatus.SUCCEEDED:
        payment.provider_event_id = payment.provider_event_id or event_id
        db.commit()
        return {"status": "duplicate", "message": "Payment already processed"}

    payment.provider_payment_id = payment_id
    payment.provider_event_id = event_id
    payment.status = SubscriptionPaymentStatus.SUCCEEDED
    payment.paid_at = _utcnow()
    _activate_paid_subscription(db=db, payment=payment, provider_event_id=event_id)
    db.commit()
    return {"status": "processed", "message": "Payment webhook processed"}
