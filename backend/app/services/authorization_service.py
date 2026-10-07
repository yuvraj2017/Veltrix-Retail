"""Database-resolved tenant authorization context."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.membership import MembershipStatus, normalize_membership_role
from app.core.permissions import permissions_for_role
from app.core.user_status import UserRole, normalize_role
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


def _deny(detail: str = "Tenant membership is inactive or unavailable") -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def resolve_tenant_authorization_context(
    db: Session,
    user: User,
) -> TenantAuthorizationContext:
    """Resolve the current compatibility shop into an effective tenant role.

    User.shop_id remains the active-branch selector in Phase 4C. The membership
    rows, not that scalar alone, are the authorization source.
    """
    try:
        legacy_role = normalize_role(user.role)
    except ValueError:
        _deny("Account role is invalid and requires administrator review")

    if legacy_role == UserRole.SUPER_ADMIN:
        _deny("Platform administrators do not have access to shop tenant routes")
    if user.shop_id is None:
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
            Shop.id == user.shop_id,
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

