from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import hash_password
from app.core.user_status import UserRole, UserStatus, can_login
from app.core.shop_status import ShopStatus
from app.models.business_audit_log import BusinessAuditAction
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User
from app.schemas.staff import StaffCreate, StaffUpdate
from app.services.authorization_service import TenantAuthorizationContext
from app.services.business_audit_service import record_business_audit
from app.services.organization_entitlement_service import (
    ensure_organization_staff_capacity,
)


ORDINARY_STAFF_ROLES = frozenset(
    {
        MembershipRole.ADMIN,
        MembershipRole.MANAGER,
        MembershipRole.CASHIER,
        MembershipRole.INVENTORY_MANAGER,
        MembershipRole.PURCHASING_MANAGER,
        MembershipRole.REPORT_VIEWER,
    }
)
ADMIN_MANAGEABLE_ROLES = ORDINARY_STAFF_ROLES - {MembershipRole.ADMIN}


def _not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")


def _conflict(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


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


def _membership_query(db: Session, organization_id: int):
    return (
        db.query(OrganizationMembership)
        .options(
            joinedload(OrganizationMembership.user),
            joinedload(OrganizationMembership.branch_memberships).joinedload(
                BranchMembership.shop
            ),
        )
        .filter(OrganizationMembership.organization_id == organization_id)
    )


def _get_membership(
    db: Session,
    organization_id: int,
    membership_id: int,
    *,
    lock: bool = False,
) -> OrganizationMembership:
    if lock:
        locked = (
            db.query(OrganizationMembership)
            .filter(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.id == membership_id,
            )
            .with_for_update()
            .one_or_none()
        )
        if locked is None:
            _not_found()
    query = _membership_query(db, organization_id).filter(
        OrganizationMembership.id == membership_id
    )
    membership = query.one_or_none()
    if membership is None:
        _not_found()
    return membership


def _staff_snapshot(membership: OrganizationMembership) -> dict:
    user = membership.user
    return {
        "membership_id": membership.id,
        "user_id": user.id,
        "role": membership.role,
        "membership_status": membership.status,
        "account_status": user.status,
        "active_shop_id": user.shop_id,
        "branch_ids": sorted(
            branch.shop_id
            for branch in membership.branch_memberships
            if branch.status == MembershipStatus.ACTIVE
        ),
    }


def _serialize_staff(membership: OrganizationMembership) -> dict:
    user = membership.user
    branches = sorted(membership.branch_memberships, key=lambda item: item.shop_id)
    return {
        "membership_id": membership.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": membership.role,
        "membership_status": membership.status,
        "account_status": user.status,
        "active_shop_id": user.shop_id,
        "branches": [
            {
                "shop_id": branch.shop_id,
                "shop_name": branch.shop.name,
                "status": branch.status,
                "is_current": branch.shop_id == user.shop_id,
            }
            for branch in branches
        ],
        "created_at": membership.created_at,
        "updated_at": membership.updated_at,
    }


def _assert_actor_can_manage(
    context: TenantAuthorizationContext,
    *,
    target: OrganizationMembership | None = None,
    requested_role: str | None = None,
    actor_role: str | None = None,
) -> None:
    actor_role = actor_role or context.role
    if actor_role not in (MembershipRole.OWNER, MembershipRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage staff",
        )
    if requested_role not in ORDINARY_STAFF_ROLES and requested_role is not None:
        raise HTTPException(status_code=422, detail="Invalid staff role")
    if target is not None:
        if target.id == context.organization_membership.id:
            _conflict("Staff administration cannot modify your own access")
        if target.role == MembershipRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="OWNER access can only change through ownership transfer",
            )
    if actor_role == MembershipRole.ADMIN:
        if target is not None and target.role == MembershipRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ADMIN cannot modify ADMIN or OWNER memberships",
            )
        if requested_role == MembershipRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only OWNER can assign the ADMIN role",
            )


def _current_actor_role(db: Session, context: TenantAuthorizationContext) -> str:
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.id == context.organization_membership.id,
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == context.user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
        )
        .populate_existing()
        .one_or_none()
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active organization membership is required",
        )
    return membership.role


def _membership_consumes_staff_slot(*, role: str, membership_status: str) -> bool:
    return (
        membership_status == MembershipStatus.ACTIVE
        and role != MembershipRole.OWNER
    )


def _load_valid_branches(
    db: Session,
    organization_id: int,
    branch_ids: list[int],
) -> list[Shop]:
    unique_ids = set(branch_ids)
    if not unique_ids or len(unique_ids) != len(branch_ids):
        raise HTTPException(status_code=422, detail="Branch assignments must be unique")
    branches = (
        db.query(Shop)
        .filter(
            Shop.organization_id == organization_id,
            Shop.id.in_(unique_ids),
            Shop.status == ShopStatus.ACTIVE,
        )
        .order_by(Shop.id)
        .all()
    )
    if len(branches) != len(unique_ids):
        raise HTTPException(status_code=422, detail="One or more branches are invalid")
    return branches


def list_staff(db: Session, context: TenantAuthorizationContext) -> list[dict]:
    memberships = _membership_query(db, context.organization.id).order_by(
        OrganizationMembership.created_at, OrganizationMembership.id
    ).all()
    return [_serialize_staff(membership) for membership in memberships]


def get_staff(
    db: Session,
    context: TenantAuthorizationContext,
    membership_id: int,
) -> dict:
    return _serialize_staff(_get_membership(db, context.organization.id, membership_id))


def create_staff(
    db: Session,
    context: TenantAuthorizationContext,
    payload: StaffCreate,
) -> dict:
    try:
        _assert_actor_can_manage(context, requested_role=payload.role)
        ensure_organization_staff_capacity(
            db,
            organization_id=context.organization.id,
        )
        _assert_actor_can_manage(
            context,
            requested_role=payload.role,
            actor_role=_current_actor_role(db, context),
        )
        branches = _load_valid_branches(db, context.organization.id, payload.branch_ids)
        if payload.default_shop_id not in {branch.id for branch in branches}:
            raise HTTPException(
                status_code=422,
                detail="Default shop must be one of the assigned branches",
            )

        email = str(payload.email).strip().lower()
        if db.query(User.id).filter(User.email == email).first() is not None:
            _conflict(
                "An account with this email already exists; existing-account attachment is not supported"
            )

        user = User(
            shop_id=payload.default_shop_id,
            full_name=payload.full_name.strip(),
            email=email,
            password_hash=hash_password(payload.initial_password),
            role=UserRole.OWNER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(user)
        db.flush()

        membership = OrganizationMembership(
            organization_id=context.organization.id,
            user_id=user.id,
            role=payload.role,
            status=MembershipStatus.ACTIVE,
            created_by_user_id=context.user.id,
        )
        db.add(membership)
        db.flush()
        for branch in branches:
            branch_membership = BranchMembership(
                organization_membership_id=membership.id,
                organization_id=context.organization.id,
                shop_id=branch.id,
                status=MembershipStatus.ACTIVE,
                created_by_user_id=context.user.id,
            )
            db.add(branch_membership)
        db.flush()
        db.expire(membership, ["branch_memberships"])

        record_business_audit(
            db,
            shop_id=context.shop.id,
            actor=context.user,
            action=BusinessAuditAction.STAFF_CREATED,
            entity_type="organization_membership",
            entity_id=membership.id,
            summary=f"Staff account {email} created",
            after_data=_staff_snapshot(membership),
            metadata={"organization_id": context.organization.id},
        )
        db.commit()
        return _serialize_staff(
            _get_membership(db, context.organization.id, membership.id)
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The staff account or membership already exists",
        ) from exc
    except Exception:
        db.rollback()
        raise


def update_staff(
    db: Session,
    context: TenantAuthorizationContext,
    membership_id: int,
    payload: StaffUpdate,
) -> dict:
    try:
        _lock_organization(db, context.organization.id)
        membership = _get_membership(db, context.organization.id, membership_id)
        _assert_actor_can_manage(
            context,
            target=membership,
            requested_role=payload.role,
            actor_role=_current_actor_role(db, context),
        )

        role_changed = payload.role is not None and payload.role != membership.role
        status_changed = payload.status is not None and payload.status != membership.status
        if not role_changed and not status_changed:
            _conflict("The requested staff state is already current")

        next_role = payload.role if payload.role is not None else membership.role
        next_status = payload.status if payload.status is not None else membership.status
        requested_increase = int(
            _membership_consumes_staff_slot(
                role=next_role,
                membership_status=next_status,
            )
            and not _membership_consumes_staff_slot(
                role=membership.role,
                membership_status=membership.status,
            )
        )
        if requested_increase:
            ensure_organization_staff_capacity(
                db,
                organization_id=context.organization.id,
                requested_increase=requested_increase,
                organization_locked=True,
            )

        membership = _get_membership(
            db, context.organization.id, membership_id, lock=True
        )
        _assert_actor_can_manage(
            context,
            target=membership,
            requested_role=payload.role,
        )
        before = _staff_snapshot(membership)

        if payload.status == MembershipStatus.ACTIVE:
            user = membership.user
            if not can_login(user.status) or not user.is_active:
                _conflict("The user account must be active before membership reactivation")
            current_branch = next(
                (
                    branch
                    for branch in membership.branch_memberships
                    if branch.shop_id == user.shop_id
                    and branch.status == MembershipStatus.ACTIVE
                ),
                None,
            )
            if current_branch is None:
                _conflict("The current shop must have active branch access before reactivation")

        if role_changed:
            membership.role = payload.role
        if status_changed:
            membership.status = payload.status
        db.flush()
        after = _staff_snapshot(membership)

        if role_changed:
            record_business_audit(
                db,
                shop_id=context.shop.id,
                actor=context.user,
                action=BusinessAuditAction.STAFF_ROLE_CHANGED,
                entity_type="organization_membership",
                entity_id=membership.id,
                summary=f"Staff role changed for user {membership.user_id}",
                before_data=before,
                after_data=after,
                metadata={"organization_id": context.organization.id},
            )
        if status_changed:
            action = (
                BusinessAuditAction.STAFF_ACTIVATED
                if membership.status == MembershipStatus.ACTIVE
                else BusinessAuditAction.STAFF_DEACTIVATED
            )
            record_business_audit(
                db,
                shop_id=context.shop.id,
                actor=context.user,
                action=action,
                entity_type="organization_membership",
                entity_id=membership.id,
                summary=f"Staff membership {membership.status} for user {membership.user_id}",
                before_data=before,
                after_data=after,
                metadata={"organization_id": context.organization.id},
            )
        db.commit()
        return _serialize_staff(
            _get_membership(db, context.organization.id, membership.id)
        )
    except Exception:
        db.rollback()
        raise


def grant_branch_access(
    db: Session,
    context: TenantAuthorizationContext,
    membership_id: int,
    shop_id: int,
) -> dict:
    try:
        _lock_organization(db, context.organization.id)
        membership = _get_membership(
            db, context.organization.id, membership_id, lock=True
        )
        _assert_actor_can_manage(context, target=membership)
        branch = (
            db.query(Shop)
            .filter(
                Shop.id == shop_id,
                Shop.organization_id == context.organization.id,
            )
            .one_or_none()
        )
        if branch is None:
            raise HTTPException(status_code=422, detail="Branch is invalid")

        before = _staff_snapshot(membership)
        assignment = next(
            (
                item
                for item in membership.branch_memberships
                if item.shop_id == branch.id
            ),
            None,
        )
        if assignment is not None and assignment.status == MembershipStatus.ACTIVE:
            _conflict("Branch access is already active")
        if assignment is None:
            assignment = BranchMembership(
                organization_membership_id=membership.id,
                organization_id=context.organization.id,
                shop_id=branch.id,
                status=MembershipStatus.ACTIVE,
                created_by_user_id=context.user.id,
            )
            db.add(assignment)
        else:
            assignment.status = MembershipStatus.ACTIVE
        db.flush()
        db.expire(membership, ["branch_memberships"])
        record_business_audit(
            db,
            shop_id=context.shop.id,
            actor=context.user,
            action=BusinessAuditAction.STAFF_BRANCH_GRANTED,
            entity_type="organization_membership",
            entity_id=membership.id,
            summary=f"Branch {branch.id} granted to user {membership.user_id}",
            before_data=before,
            after_data=_staff_snapshot(membership),
            metadata={
                "organization_id": context.organization.id,
                "target_shop_id": branch.id,
            },
        )
        db.commit()
        return _serialize_staff(
            _get_membership(db, context.organization.id, membership.id)
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Branch access already exists",
        ) from exc
    except Exception:
        db.rollback()
        raise


def revoke_branch_access(
    db: Session,
    context: TenantAuthorizationContext,
    membership_id: int,
    shop_id: int,
) -> dict:
    try:
        _lock_organization(db, context.organization.id)
        membership = _get_membership(
            db, context.organization.id, membership_id, lock=True
        )
        _assert_actor_can_manage(context, target=membership)
        if membership.user.shop_id == shop_id:
            _conflict("Current/default branch access cannot be revoked without a replacement")
        before = _staff_snapshot(membership)
        assignment = next(
            (
                item
                for item in membership.branch_memberships
                if item.shop_id == shop_id
                and item.status == MembershipStatus.ACTIVE
            ),
            None,
        )
        if assignment is None:
            _not_found()
        assignment.status = MembershipStatus.INACTIVE
        db.flush()
        record_business_audit(
            db,
            shop_id=context.shop.id,
            actor=context.user,
            action=BusinessAuditAction.STAFF_BRANCH_REVOKED,
            entity_type="organization_membership",
            entity_id=membership.id,
            summary=f"Branch {shop_id} revoked from user {membership.user_id}",
            before_data=before,
            after_data=_staff_snapshot(membership),
            metadata={
                "organization_id": context.organization.id,
                "target_shop_id": shop_id,
            },
        )
        db.commit()
        return _serialize_staff(
            _get_membership(db, context.organization.id, membership.id)
        )
    except Exception:
        db.rollback()
        raise


def _usable_owner_ids(db: Session, organization_id: int) -> list[int]:
    return [
        row[0]
        for row in (
            db.query(OrganizationMembership.id)
            .join(User, User.id == OrganizationMembership.user_id)
            .join(
                BranchMembership,
                (BranchMembership.organization_membership_id == OrganizationMembership.id)
                & (BranchMembership.organization_id == organization_id)
                & (BranchMembership.shop_id == User.shop_id),
            )
            .filter(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.role == MembershipRole.OWNER,
                OrganizationMembership.status == MembershipStatus.ACTIVE,
                User.status == UserStatus.ACTIVE,
                User.is_active.is_(True),
                BranchMembership.status == MembershipStatus.ACTIVE,
            )
            .distinct()
            .all()
        )
    ]


def transfer_ownership(
    db: Session,
    context: TenantAuthorizationContext,
    target_membership_id: int,
) -> dict:
    try:
        _lock_organization(db, context.organization.id)
        actor_membership = _get_membership(
            db,
            context.organization.id,
            context.organization_membership.id,
            lock=True,
        )
        if actor_membership.role != MembershipRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the current OWNER may transfer ownership",
            )
        if target_membership_id == actor_membership.id:
            _conflict("Ownership must be transferred to another staff member")

        target = _get_membership(
            db, context.organization.id, target_membership_id, lock=True
        )
        if target.role == MembershipRole.OWNER:
            _conflict("Target membership is already OWNER")
        if target.status != MembershipStatus.ACTIVE:
            _conflict("Target membership must be active")
        if not can_login(target.user.status) or not target.user.is_active:
            _conflict("Target user account must be active")
        target_current_branch = next(
            (
                branch
                for branch in target.branch_memberships
                if branch.shop_id == target.user.shop_id
                and branch.status == MembershipStatus.ACTIVE
            ),
            None,
        )
        if target_current_branch is None:
            _conflict("Target must have active access to its current branch")

        usable_owners = _usable_owner_ids(db, context.organization.id)
        if usable_owners != [actor_membership.id]:
            _conflict("Organization ownership state requires administrator review")

        before = {
            "previous_owner": _staff_snapshot(actor_membership),
            "target": _staff_snapshot(target),
        }

        # Branch creation and ownership transfer share the organization lock.
        # Synchronizing every explicit assignment here closes both serialized
        # race orders: a branch committed just before transfer is inherited by
        # the incoming OWNER, while a transfer committed first is observed by
        # branch creation's owner auto-assignment.
        organization_branch_ids = [
            row[0]
            for row in (
                db.query(Shop.id)
                .filter(Shop.organization_id == context.organization.id)
                .order_by(Shop.id)
                .with_for_update()
                .all()
            )
        ]
        target_assignments = {
            assignment.shop_id: assignment
            for assignment in (
                db.query(BranchMembership)
                .filter(
                    BranchMembership.organization_membership_id == target.id,
                    BranchMembership.organization_id == context.organization.id,
                )
                .with_for_update()
                .all()
            )
        }
        for shop_id in organization_branch_ids:
            assignment = target_assignments.get(shop_id)
            if assignment is None:
                db.add(
                    BranchMembership(
                        organization_membership_id=target.id,
                        organization_id=context.organization.id,
                        shop_id=shop_id,
                        status=MembershipStatus.ACTIVE,
                        created_by_user_id=context.user.id,
                    )
                )
            else:
                assignment.status = MembershipStatus.ACTIVE

        target.role = MembershipRole.OWNER
        actor_membership.role = MembershipRole.ADMIN
        db.flush()
        db.expire(target, ["branch_memberships"])
        after = {
            "previous_owner": _staff_snapshot(actor_membership),
            "new_owner": _staff_snapshot(target),
        }
        record_business_audit(
            db,
            shop_id=context.shop.id,
            actor=context.user,
            action=BusinessAuditAction.OWNERSHIP_TRANSFERRED,
            entity_type="organization_membership",
            entity_id=target.id,
            summary=f"Ownership transferred to user {target.user_id}",
            before_data=before,
            after_data=after,
            metadata={
                "organization_id": context.organization.id,
                "previous_owner_membership_id": actor_membership.id,
                "new_owner_membership_id": target.id,
            },
        )
        db.commit()
        previous_owner = _get_membership(
            db, context.organization.id, actor_membership.id
        )
        new_owner = _get_membership(db, context.organization.id, target.id)
        return {
            "previous_owner": _serialize_staff(previous_owner),
            "new_owner": _serialize_staff(new_owner),
        }
    except Exception:
        db.rollback()
        raise
