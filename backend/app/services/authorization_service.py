"""Database-resolved tenant authorization context."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.membership import MembershipStatus, normalize_membership_role
from app.core.permissions import permissions_for_role
from app.core.user_status import UserRole, normalize_role
from app.core.shop_status import ShopStatus
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User


@dataclass(frozen=True, slots=True)
class TenantAuthorizationContext:
    user: User
    organization: Organization
    shop: Shop
    organization_membership: OrganizationMembership
    branch_membership: BranchMembership
    role: str
    permissions: frozenset[str]

    @property
    def active_shop(self) -> Shop:
        return self.shop

    @property
    def active_shop_id(self) -> int:
        return self.shop.id

    @property
    def effective_role(self) -> str:
        return self.role

    def scoped_user(self) -> "TenantRequestUser":
        return TenantRequestUser(user=self.user, active_shop_id=self.shop.id)


@dataclass(frozen=True, slots=True)
class TenantRequestUser:
    """Compatibility principal whose shop_id is the validated request branch.

    Existing domain services accept a User-shaped actor and scope their work by
    ``shop_id``. This adapter keeps that API stable while ensuring the value is
    supplied by TenantAuthorizationContext rather than the persisted preferred
    branch. It never mutates the SQLAlchemy User object.
    """

    user: User
    active_shop_id: int

    @property
    def shop_id(self) -> int:
        return self.active_shop_id

    @property
    def preferred_shop_id(self) -> int | None:
        return self.user.shop_id

    def __getattr__(self, name: str):
        return getattr(self.user, name)


def _deny(detail: str = "Tenant membership is inactive or unavailable") -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def resolve_tenant_authorization_context(
    db: Session,
    user: User,
    *,
    requested_shop_id: int | None = None,
) -> TenantAuthorizationContext:
    """Resolve an explicit or preferred branch through the same fail-closed path."""
    try:
        legacy_role = normalize_role(user.role)
    except ValueError:
        _deny("Account role is invalid and requires administrator review")

    if legacy_role == UserRole.SUPER_ADMIN:
        _deny("Platform administrators do not have access to shop tenant routes")
    active_shop_id = requested_shop_id if requested_shop_id is not None else user.shop_id
    if active_shop_id is None:
        _deny()

    row = (
        db.query(Shop, Organization, OrganizationMembership, BranchMembership)
        .join(Organization, Organization.id == Shop.organization_id)
        .join(
            OrganizationMembership,
            (OrganizationMembership.organization_id == Shop.organization_id)
            & (OrganizationMembership.user_id == user.id),
        )
        .join(
            BranchMembership,
            (BranchMembership.organization_membership_id == OrganizationMembership.id)
            & (BranchMembership.organization_id == Shop.organization_id)
            & (BranchMembership.shop_id == Shop.id),
        )
        .filter(
            Shop.id == active_shop_id,
            Shop.status == ShopStatus.ACTIVE,
            Organization.status == "active",
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            BranchMembership.status == MembershipStatus.ACTIVE,
        )
        .one_or_none()
    )
    if row is None:
        _deny()

    shop, organization, organization_membership, branch_membership = row
    try:
        membership_role = normalize_membership_role(organization_membership.role)
        permissions = permissions_for_role(membership_role)
    except ValueError:
        _deny("Membership role is invalid and requires administrator review")

    return TenantAuthorizationContext(
        user=user,
        organization=organization,
        shop=shop,
        organization_membership=organization_membership,
        branch_membership=branch_membership,
        role=membership_role,
        permissions=permissions,
    )

