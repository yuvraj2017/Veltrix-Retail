"""Organization-scoped commercial source and entitlement resolution."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.domain_errors import DomainError, DomainErrorCode
from app.core.membership import MembershipRole, MembershipStatus
from app.core.permissions import Permission
from app.core.shop_status import ShopStatus
from app.core.user_status import UserRole
from app.models.admin_audit_log import AuditAction
from app.models.business_audit_log import BusinessAuditAction
from app.models.membership import OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User
from app.services import audit_service
from app.services.authorization_service import TenantAuthorizationContext
from app.services.business_audit_service import record_business_audit
from app.services.entitlement_service import (
    CommercialAccess,
    EffectiveEntitlement,
    evaluate_shop_access,
    get_feature,
    get_limit,
)


ORGANIZATION_LIMIT_RESOURCE_KEYS = frozenset({"staff", "locations"})
ORGANIZATION_FEATURE_KEYS = frozenset({"multi_location.enabled"})
ORGANIZATION_ENTITLEMENT_KEYS = frozenset(
    {"staff.max", "locations.max", *ORGANIZATION_FEATURE_KEYS}
)
COUNTED_LOCATION_STATUSES = (ShopStatus.ACTIVE, ShopStatus.PENDING)


@dataclass(frozen=True, slots=True)
class OrganizationCommercialSource:
    organization: Organization
    shop: Shop
    access: CommercialAccess | None = None


@dataclass(frozen=True, slots=True)
class OrganizationLocationCapacity:
    organization_id: int
    commercial_source_shop_id: int
    current_usage: int
    effective_limit: Decimal | None
    remaining_allowance: Decimal | None
    is_unlimited: bool
    multi_location_enabled: bool


@dataclass(frozen=True, slots=True)
class OrganizationStaffCapacity:
    organization_id: int
    commercial_source_shop_id: int
    current_usage: int
    effective_limit: Decimal | None
    remaining_allowance: Decimal | None
    is_unlimited: bool


def _source_error(code: str, message: str, organization_id: int) -> HTTPException:
    return DomainError(
        code=code,
        message=message,
        details={"organization_id": organization_id},
    ).to_http_exception()


def resolve_organization_commercial_source(
    db: Session,
    organization_id: int,
    *,
    lock_organization: bool = False,
    lock_source: bool = False,
    require_access: bool = False,
) -> OrganizationCommercialSource:
    organization_query = db.query(Organization).filter(
        Organization.id == organization_id
    )
    if lock_organization:
        organization_query = organization_query.populate_existing().with_for_update()
    organization = organization_query.one_or_none()
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if organization.commercial_source_shop_id is None:
        raise _source_error(
            DomainErrorCode.COMMERCIAL_SOURCE_REQUIRED,
            "The organization has no configured commercial source.",
            organization_id,
        )

    source_query = db.query(Shop).filter(
        Shop.id == organization.commercial_source_shop_id,
        Shop.organization_id == organization.id,
    )
    if lock_source:
        source_query = source_query.with_for_update()
    source = source_query.one_or_none()
    if source is None:
        raise _source_error(
            DomainErrorCode.COMMERCIAL_SOURCE_INVALID,
            "The organization's commercial source is invalid.",
            organization_id,
        )

    if require_access and source.status != ShopStatus.ACTIVE:
        raise _source_error(
            DomainErrorCode.COMMERCIAL_SOURCE_INELIGIBLE,
            "The organization's commercial source is not active.",
            organization_id,
        )

    access = evaluate_shop_access(source.id, db) if require_access else None
    if access is not None and not access.allowed:
        raise DomainError(
            code=access.code or DomainErrorCode.COMMERCIAL_SOURCE_INELIGIBLE,
            message=access.message or "The commercial source is not eligible.",
            details={
                "organization_id": organization.id,
                "commercial_source_shop_id": source.id,
            },
        ).to_http_exception()
    return OrganizationCommercialSource(organization=organization, shop=source, access=access)


def entitlement_scope(entitlement_key: str) -> str:
    return "organization" if entitlement_key in ORGANIZATION_ENTITLEMENT_KEYS else "shop"


def resolve_entitlement_shop(
    db: Session,
    *,
    organization_id: int,
    operational_shop_id: int,
    entitlement_key: str,
    require_access: bool = True,
) -> Shop:
    if entitlement_scope(entitlement_key) == "organization":
        return resolve_organization_commercial_source(
            db,
            organization_id,
            require_access=require_access,
        ).shop

    operational_shop = (
        db.query(Shop)
        .filter(
            Shop.id == operational_shop_id,
            Shop.organization_id == organization_id,
        )
        .one_or_none()
    )
    if operational_shop is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop access denied")
    return operational_shop


def get_scoped_limit(
    db: Session,
    *,
    organization_id: int,
    operational_shop_id: int,
    resource_key: str,
) -> EffectiveEntitlement:
    source = resolve_entitlement_shop(
        db,
        organization_id=organization_id,
        operational_shop_id=operational_shop_id,
        entitlement_key=f"{resource_key}.max",
    )
    return get_limit(source.id, resource_key, db)


def get_scoped_feature(
    db: Session,
    *,
    organization_id: int,
    operational_shop_id: int,
    feature_key: str,
) -> EffectiveEntitlement:
    source = resolve_entitlement_shop(
        db,
        organization_id=organization_id,
        operational_shop_id=operational_shop_id,
        entitlement_key=feature_key,
    )
    return get_feature(source.id, feature_key, db)


def count_organization_locations(db: Session, organization_id: int) -> int:
    """Count locations that consume organization allowance."""
    return int(
        db.query(func.count(Shop.id))
        .filter(
            Shop.organization_id == organization_id,
            Shop.status.in_(COUNTED_LOCATION_STATUSES),
        )
        .scalar()
        or 0
    )


def count_organization_staff(db: Session, organization_id: int) -> int:
    """Count distinct active non-OWNER organization members."""
    return int(
        db.query(func.count(func.distinct(OrganizationMembership.user_id)))
        .filter(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            OrganizationMembership.role != MembershipRole.OWNER,
        )
        .scalar()
        or 0
    )


def _quota_error(
    *,
    code: str,
    message: str,
    entitlement_key: str,
    current_usage: int,
    effective_limit: Decimal | None,
    remaining_allowance: Decimal | None,
    requested_increase: int,
) -> HTTPException:
    return DomainError(
        code=code,
        message=message,
        details={
            "entitlement_key": entitlement_key,
            "current_usage": current_usage,
            "effective_limit": (
                str(effective_limit) if effective_limit is not None else None
            ),
            "remaining_allowance": (
                str(remaining_allowance)
                if remaining_allowance is not None
                else None
            ),
            "requested_increase": requested_increase,
        },
    ).to_http_exception()


def ensure_organization_location_capacity(
    db: Session,
    *,
    organization_id: int,
    requested_increase: int = 1,
    organization_locked: bool = False,
) -> OrganizationLocationCapacity:
    """Serialize and validate one organization location-usage increase."""
    if requested_increase < 1:
        raise ValueError("requested_increase must be positive")

    source = resolve_organization_commercial_source(
        db,
        organization_id,
        lock_organization=not organization_locked,
        lock_source=True,
        require_access=True,
    )
    current_usage = count_organization_locations(db, organization_id)
    projected_usage = current_usage + requested_increase

    multi_location = get_feature(source.shop.id, "multi_location.enabled", db)
    if projected_usage > 1 and (
        not multi_location.configured or not multi_location.feature_enabled
    ):
        remaining = Decimal(max(1 - current_usage, 0))
        raise _quota_error(
            code=DomainErrorCode.FEATURE_NOT_AVAILABLE,
            message="The current subscription does not enable multiple branches.",
            entitlement_key="multi_location.enabled",
            current_usage=current_usage,
            effective_limit=Decimal("1"),
            remaining_allowance=remaining,
            requested_increase=requested_increase,
        )

    location_limit = get_limit(source.shop.id, "locations", db)
    if not location_limit.configured or (
        not location_limit.is_unlimited and location_limit.limit_value is None
    ):
        raise _quota_error(
            code=DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED,
            message="The current subscription has no valid branch limit configured.",
            entitlement_key="locations.max",
            current_usage=current_usage,
            effective_limit=None,
            remaining_allowance=None,
            requested_increase=requested_increase,
        )

    if location_limit.is_unlimited:
        return OrganizationLocationCapacity(
            organization_id=organization_id,
            commercial_source_shop_id=source.shop.id,
            current_usage=current_usage,
            effective_limit=None,
            remaining_allowance=None,
            is_unlimited=True,
            multi_location_enabled=bool(multi_location.feature_enabled),
        )

    effective_limit = location_limit.limit_value
    assert effective_limit is not None
    remaining = max(effective_limit - Decimal(current_usage), Decimal("0"))
    if Decimal(projected_usage) > effective_limit:
        raise _quota_error(
            code=DomainErrorCode.PLAN_LIMIT_REACHED,
            message="The organization has reached its branch limit.",
            entitlement_key="locations.max",
            current_usage=current_usage,
            effective_limit=effective_limit,
            remaining_allowance=remaining,
            requested_increase=requested_increase,
        )

    return OrganizationLocationCapacity(
        organization_id=organization_id,
        commercial_source_shop_id=source.shop.id,
        current_usage=current_usage,
        effective_limit=effective_limit,
        remaining_allowance=effective_limit - Decimal(projected_usage),
        is_unlimited=False,
        multi_location_enabled=bool(multi_location.feature_enabled),
    )


def ensure_organization_staff_capacity(
    db: Session,
    *,
    organization_id: int,
    requested_increase: int = 1,
    organization_locked: bool = False,
) -> OrganizationStaffCapacity:
    """Serialize and validate an organization staff-usage increase."""
    if requested_increase < 1:
        raise ValueError("requested_increase must be positive")

    source = resolve_organization_commercial_source(
        db,
        organization_id,
        lock_organization=not organization_locked,
        lock_source=True,
        require_access=True,
    )
    current_usage = count_organization_staff(db, organization_id)
    staff_limit = get_limit(source.shop.id, "staff", db)
    if not staff_limit.configured or (
        not staff_limit.is_unlimited and staff_limit.limit_value is None
    ):
        raise _quota_error(
            code=DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED,
            message="The current subscription has no valid staff limit configured.",
            entitlement_key="staff.max",
            current_usage=current_usage,
            effective_limit=None,
            remaining_allowance=None,
            requested_increase=requested_increase,
        )

    if staff_limit.is_unlimited:
        return OrganizationStaffCapacity(
            organization_id=organization_id,
            commercial_source_shop_id=source.shop.id,
            current_usage=current_usage,
            effective_limit=None,
            remaining_allowance=None,
            is_unlimited=True,
        )

    effective_limit = staff_limit.limit_value
    assert effective_limit is not None
    remaining = max(effective_limit - Decimal(current_usage), Decimal("0"))
    projected_usage = current_usage + requested_increase
    if Decimal(projected_usage) > effective_limit:
        raise _quota_error(
            code=DomainErrorCode.PLAN_LIMIT_REACHED,
            message="The organization has reached its staff limit.",
            entitlement_key="staff.max",
            current_usage=current_usage,
            effective_limit=effective_limit,
            remaining_allowance=remaining,
            requested_increase=requested_increase,
        )

    return OrganizationStaffCapacity(
        organization_id=organization_id,
        commercial_source_shop_id=source.shop.id,
        current_usage=current_usage,
        effective_limit=effective_limit,
        remaining_allowance=effective_limit - Decimal(projected_usage),
        is_unlimited=False,
    )


def _lock_candidate_shops(
    db: Session,
    organization_id: int,
    shop_ids: set[int],
) -> dict[int, Shop]:
    if not shop_ids:
        return {}
    rows = (
        db.query(Shop)
        .filter(
            Shop.organization_id == organization_id,
            Shop.id.in_(sorted(shop_ids)),
        )
        .order_by(Shop.id)
        .with_for_update()
        .all()
    )
    return {row.id: row for row in rows}


def _validate_reassignment_target(db: Session, target: Shop) -> CommercialAccess:
    if target.status != ShopStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The commercial source must be an active branch",
        )
    access = evaluate_shop_access(target.id, db)
    if not access.allowed:
        raise DomainError(
            code=DomainErrorCode.COMMERCIAL_SOURCE_INELIGIBLE,
            message="The target branch does not have valid commercial access.",
            details={
                "shop_id": target.id,
                "access_code": access.code,
            },
        ).to_http_exception()
    return access


def _reassign_commercial_source(
    db: Session,
    *,
    organization_id: int,
    target_shop_id: int,
    actor: User,
    reason: str,
    actor_scope: str,
    ip_address: str | None = None,
) -> OrganizationCommercialSource:
    normalized_reason = reason.strip()
    if not normalized_reason:
        raise HTTPException(status_code=422, detail="A reassignment reason is required")

    organization = (
        db.query(Organization)
        .filter(Organization.id == organization_id)
        .populate_existing()
        .with_for_update()
        .one_or_none()
    )
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if actor_scope == "organization_owner":
        current_owner = (
            db.query(OrganizationMembership.id)
            .filter(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.user_id == actor.id,
                OrganizationMembership.role == MembershipRole.OWNER,
                OrganizationMembership.status == MembershipStatus.ACTIVE,
            )
            .one_or_none()
        )
        if current_owner is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the organization OWNER may change the commercial source",
            )
    previous_source_id = organization.commercial_source_shop_id
    if previous_source_id == target_shop_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The target branch is already the commercial source",
        )

    locked = _lock_candidate_shops(
        db,
        organization.id,
        {shop_id for shop_id in (previous_source_id, target_shop_id) if shop_id is not None},
    )
    target = locked.get(target_shop_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    if previous_source_id is not None and previous_source_id not in locked:
        raise _source_error(
            DomainErrorCode.COMMERCIAL_SOURCE_INVALID,
            "The organization's current commercial source is invalid.",
            organization.id,
        )
    _validate_reassignment_target(db, target)

    organization.commercial_source_shop_id = target.id
    db.flush()
    record_business_audit(
        db,
        shop_id=target.id,
        actor=actor,
        action=BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_CHANGED,
        entity_type="organization",
        entity_id=organization.id,
        summary="Organization commercial source changed",
        before_data={"commercial_source_shop_id": previous_source_id},
        after_data={"commercial_source_shop_id": target.id},
        metadata={
            "organization_id": organization.id,
            "actor_scope": actor_scope,
            "reason": normalized_reason,
        },
    )
    if actor_scope == "platform_recovery":
        audit_service.record_admin_action(
            db,
            actor=actor,
            action=AuditAction.COMMERCIAL_SOURCE_CHANGED,
            target_entity_type="organization",
            target_entity_id=organization.id,
            previous_value=str(previous_source_id) if previous_source_id is not None else None,
            new_value=str(target.id),
            reason=normalized_reason,
            ip_address=ip_address,
        )
    db.commit()
    db.refresh(organization)
    return OrganizationCommercialSource(organization=organization, shop=target)


def reassign_commercial_source_as_owner(
    db: Session,
    context: TenantAuthorizationContext,
    *,
    target_shop_id: int,
    reason: str,
) -> OrganizationCommercialSource:
    if (
        context.role != MembershipRole.OWNER
        or Permission.BRANCHES_MANAGE not in context.permissions
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization OWNER may change the commercial source",
        )
    try:
        return _reassign_commercial_source(
            db,
            organization_id=context.organization.id,
            target_shop_id=target_shop_id,
            actor=context.user,
            reason=reason,
            actor_scope="organization_owner",
        )
    except Exception:
        db.rollback()
        raise


def recover_commercial_source_as_super_admin(
    db: Session,
    *,
    organization_id: int,
    target_shop_id: int,
    actor: User,
    reason: str,
    ip_address: str | None = None,
) -> OrganizationCommercialSource:
    if actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    try:
        return _reassign_commercial_source(
            db,
            organization_id=organization_id,
            target_shop_id=target_shop_id,
            actor=actor,
            reason=reason,
            actor_scope="platform_recovery",
            ip_address=ip_address,
        )
    except Exception:
        db.rollback()
        raise


def commercial_source_response(source: OrganizationCommercialSource) -> dict:
    return {
        "organization_id": source.organization.id,
        "commercial_source_shop_id": source.shop.id,
        "shop_name": source.shop.name,
        "shop_status": source.shop.status,
    }
