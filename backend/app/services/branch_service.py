from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.membership import MembershipRole, MembershipStatus
from app.core.permissions import Permission
from app.core.shop_status import ShopStatus
from app.core.user_status import UserStatus
from app.models.business_audit_log import BusinessAuditAction
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User
from app.schemas.branch import BranchCreateRequest, BranchUpdateRequest
from app.services.authorization_service import TenantAuthorizationContext
from app.services.business_audit_service import record_business_audit
from app.services.entitlement_service import evaluate_shop_access
from app.services.organization_entitlement_service import (
    get_scoped_feature,
    get_scoped_limit,
)


def _not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")


def _conflict(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _assert_owner_manager(context: TenantAuthorizationContext) -> None:
    if (
        context.role != MembershipRole.OWNER
        or Permission.BRANCHES_MANAGE not in context.permissions
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an organization OWNER may manage branches",
        )


def _lock_organization(db: Session, organization_id: int) -> Organization:
    organization = (
        db.query(Organization)
        .filter(Organization.id == organization_id)
        .with_for_update()
        .one_or_none()
    )
    if organization is None:
        _not_found()
    return organization


def _get_branch(
    db: Session,
    organization_id: int,
    branch_id: int,
    *,
    lock: bool = False,
) -> Shop:
    query = db.query(Shop).filter(
        Shop.id == branch_id,
        Shop.organization_id == organization_id,
    )
    if lock:
        query = query.populate_existing().with_for_update()
    branch = query.one_or_none()
    if branch is None:
        _not_found()
    return branch


def _lock_organization_branches(db: Session, organization_id: int) -> list[Shop]:
    return (
        db.query(Shop)
        .filter(Shop.organization_id == organization_id)
        .order_by(Shop.id)
        .populate_existing()
        .with_for_update()
        .all()
    )


def _branch_snapshot(branch: Shop) -> dict:
    return {
        "id": branch.id,
        "organization_id": branch.organization_id,
        "name": branch.name,
        "status": branch.status,
        "is_default_branch": branch.is_default_branch,
        "category": branch.category,
        "email": branch.email,
        "phone": branch.phone,
        "whatsapp_number": branch.whatsapp_number,
        "address": branch.address,
        "gst_enabled": branch.gst_enabled,
        "gstin": branch.gstin,
        "state": branch.state,
        "gst_state_code": branch.gst_state_code,
    }


def _check_location_entitlement(
    db: Session,
    context: TenantAuthorizationContext,
) -> None:
    feature = get_scoped_feature(
        db,
        organization_id=context.organization.id,
        operational_shop_id=context.active_shop_id,
        feature_key="multi_location.enabled",
    )
    if not feature.configured or not feature.feature_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The current subscription does not enable multiple branches",
        )

    limit = get_scoped_limit(
        db,
        organization_id=context.organization.id,
        operational_shop_id=context.active_shop_id,
        resource_key="locations",
    )
    if not limit.configured:
        _conflict("The current subscription has no branch limit configured")
    if limit.is_unlimited:
        return
    if limit.limit_value is None:
        _conflict("The current subscription has no valid branch limit configured")

    current_count = (
        db.query(Shop.id)
        .filter(Shop.organization_id == context.organization.id)
        .count()
    )
    if Decimal(current_count) >= limit.limit_value:
        _conflict("The organization has reached its branch limit")


def list_organization_branches(
    db: Session,
    context: TenantAuthorizationContext,
) -> list[Shop]:
    return (
        db.query(Shop)
        .filter(Shop.organization_id == context.organization.id)
        .order_by(Shop.is_default_branch.desc(), Shop.name.asc(), Shop.id.asc())
        .all()
    )


def get_organization_branch(
    db: Session,
    context: TenantAuthorizationContext,
    branch_id: int,
) -> Shop:
    return _get_branch(db, context.organization.id, branch_id)


def create_branch(
    db: Session,
    context: TenantAuthorizationContext,
    payload: BranchCreateRequest,
) -> Shop:
    try:
        _lock_organization(db, context.organization.id)
        _assert_owner_manager(context)
        _check_location_entitlement(db, context)

        branch = Shop(
            organization_id=context.organization.id,
            is_default_branch=False,
            status=ShopStatus.PENDING,
            **payload.model_dump(),
        )
        db.add(branch)
        db.flush()

        owners = (
            db.query(OrganizationMembership)
            .join(User, User.id == OrganizationMembership.user_id)
            .filter(
                OrganizationMembership.organization_id == context.organization.id,
                OrganizationMembership.role == MembershipRole.OWNER,
                OrganizationMembership.status == MembershipStatus.ACTIVE,
                User.status == UserStatus.ACTIVE,
                User.is_active.is_(True),
            )
            .order_by(OrganizationMembership.id)
            .with_for_update()
            .all()
        )
        if not owners:
            _conflict("The organization has no active owner to assign to the branch")

        for owner in owners:
            db.add(
                BranchMembership(
                    organization_membership_id=owner.id,
                    organization_id=context.organization.id,
                    shop_id=branch.id,
                    status=MembershipStatus.ACTIVE,
                    created_by_user_id=context.user.id,
                )
            )
        db.flush()

        record_business_audit(
            db,
            shop_id=branch.id,
            actor=context.user,
            action=BusinessAuditAction.BRANCH_CREATED,
            entity_type="shop",
            entity_id=branch.id,
            summary=f"Branch {branch.name} created pending commercial provisioning",
            after_data=_branch_snapshot(branch),
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        db.refresh(branch)
        return branch
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The branch or owner assignment already exists",
        ) from exc
    except Exception:
        db.rollback()
        raise


def update_branch(
    db: Session,
    context: TenantAuthorizationContext,
    branch_id: int,
    payload: BranchUpdateRequest,
) -> Shop:
    try:
        _lock_organization(db, context.organization.id)
        _assert_owner_manager(context)
        branch = _get_branch(db, context.organization.id, branch_id, lock=True)
        before = _branch_snapshot(branch)
        updates = payload.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(branch, field, value)
        db.flush()
        after = _branch_snapshot(branch)
        if before == after:
            _conflict("The requested branch state is already current")

        record_business_audit(
            db,
            shop_id=branch.id,
            actor=context.user,
            action=BusinessAuditAction.BRANCH_UPDATED,
            entity_type="shop",
            entity_id=branch.id,
            summary=f"Branch {branch.name} updated",
            before_data=before,
            after_data=after,
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        db.refresh(branch)
        return branch
    except Exception:
        db.rollback()
        raise


def activate_branch(
    db: Session,
    context: TenantAuthorizationContext,
    branch_id: int,
) -> Shop:
    try:
        _lock_organization(db, context.organization.id)
        _assert_owner_manager(context)
        branch = _get_branch(db, context.organization.id, branch_id, lock=True)
        if branch.status == ShopStatus.ACTIVE:
            _conflict("The branch is already active")

        access = evaluate_shop_access(branch.id, db)
        if not access.allowed:
            _conflict(
                "The branch cannot be activated until its subscription and license are active"
            )

        before = _branch_snapshot(branch)
        branch.status = ShopStatus.ACTIVE
        db.flush()
        after = _branch_snapshot(branch)
        record_business_audit(
            db,
            shop_id=branch.id,
            actor=context.user,
            action=BusinessAuditAction.BRANCH_ACTIVATED,
            entity_type="shop",
            entity_id=branch.id,
            summary=f"Branch {branch.name} activated",
            before_data=before,
            after_data=after,
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        db.refresh(branch)
        return branch
    except Exception:
        db.rollback()
        raise


def _assert_deactivation_safe(
    db: Session,
    branch: Shop,
    organization_branches: list[Shop],
) -> None:
    if branch.is_default_branch:
        _conflict("The default branch cannot be deactivated")

    active_siblings = [
        item
        for item in organization_branches
        if item.status == ShopStatus.ACTIVE and item.id != branch.id
    ]
    if not active_siblings:
        _conflict("The organization's final active branch cannot be deactivated")

    dependent_user = (
        db.query(User.id)
        .filter(
            User.shop_id == branch.id,
            User.status == UserStatus.ACTIVE,
            User.is_active.is_(True),
        )
        .first()
    )
    if dependent_user is not None:
        _conflict(
            "Active users still use this branch as their preferred branch; assign a replacement first"
        )

    active_owners = (
        db.query(OrganizationMembership)
        .join(User, User.id == OrganizationMembership.user_id)
        .filter(
            OrganizationMembership.organization_id == branch.organization_id,
            OrganizationMembership.role == MembershipRole.OWNER,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            User.status == UserStatus.ACTIVE,
            User.is_active.is_(True),
        )
        .order_by(OrganizationMembership.id)
        .with_for_update()
        .all()
    )
    if not active_owners:
        _conflict("The organization has no usable owner")

    active_sibling_ids = {item.id for item in active_siblings}
    for owner in active_owners:
        alternative = (
            db.query(BranchMembership.id)
            .filter(
                BranchMembership.organization_membership_id == owner.id,
                BranchMembership.shop_id.in_(active_sibling_ids),
                BranchMembership.status == MembershipStatus.ACTIVE,
            )
            .first()
        )
        if alternative is None:
            _conflict("Deactivation would leave an active OWNER without a usable branch")


def deactivate_branch(
    db: Session,
    context: TenantAuthorizationContext,
    branch_id: int,
) -> Shop:
    try:
        organization = _lock_organization(db, context.organization.id)
        db.refresh(organization)
        _assert_owner_manager(context)
        branches = _lock_organization_branches(db, context.organization.id)
        branch = next((item for item in branches if item.id == branch_id), None)
        if branch is None:
            _not_found()
        if branch.status != ShopStatus.ACTIVE:
            _conflict("Only an active branch can be deactivated")
        if organization.commercial_source_shop_id == branch.id:
            _conflict(
                "The commercial-source branch cannot be deactivated until a replacement is assigned"
            )
        _assert_deactivation_safe(db, branch, branches)

        before = _branch_snapshot(branch)
        branch.status = ShopStatus.INACTIVE
        db.flush()
        after = _branch_snapshot(branch)
        record_business_audit(
            db,
            shop_id=branch.id,
            actor=context.user,
            action=BusinessAuditAction.BRANCH_DEACTIVATED,
            entity_type="shop",
            entity_id=branch.id,
            summary=f"Branch {branch.name} deactivated",
            before_data=before,
            after_data=after,
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        db.refresh(branch)
        return branch
    except Exception:
        db.rollback()
        raise


def make_default_branch(
    db: Session,
    context: TenantAuthorizationContext,
    branch_id: int,
) -> Shop:
    try:
        _lock_organization(db, context.organization.id)
        _assert_owner_manager(context)
        branches = _lock_organization_branches(db, context.organization.id)
        branch = next((item for item in branches if item.id == branch_id), None)
        if branch is None:
            _not_found()
        if branch.status != ShopStatus.ACTIVE:
            _conflict("Only an active branch can become the default")

        defaults = [item for item in branches if item.is_default_branch]
        if len(defaults) != 1:
            _conflict("The organization default-branch state requires administrator review")
        previous = defaults[0]
        if previous.id == branch.id:
            _conflict("The branch is already the organization default")

        previous.is_default_branch = False
        db.flush()
        branch.is_default_branch = True
        db.flush()
        record_business_audit(
            db,
            shop_id=branch.id,
            actor=context.user,
            action=BusinessAuditAction.BRANCH_DEFAULT_CHANGED,
            entity_type="shop",
            entity_id=branch.id,
            summary=f"Organization default branch changed to {branch.name}",
            before_data={"default_branch_id": previous.id},
            after_data={"default_branch_id": branch.id},
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        db.refresh(branch)
        return branch
    except Exception:
        db.rollback()
        raise
