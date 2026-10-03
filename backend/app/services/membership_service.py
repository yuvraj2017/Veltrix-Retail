from sqlalchemy.orm import Session

from app.core.membership import MembershipRole, MembershipStatus
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.shop import Shop
from app.models.user import User


def create_registration_memberships(
    db: Session,
    *,
    user: User,
    shop: Shop,
) -> tuple[OrganizationMembership, BranchMembership]:
    """Stage the initial owner and branch memberships in registration's transaction."""
    organization_membership = OrganizationMembership(
        organization_id=shop.organization_id,
        user_id=user.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
        created_by_user_id=None,
    )
    db.add(organization_membership)
    db.flush()

    branch_membership = BranchMembership(
        organization_membership_id=organization_membership.id,
        organization_id=shop.organization_id,
        shop_id=shop.id,
        status=MembershipStatus.ACTIVE,
        created_by_user_id=None,
    )
    db.add(branch_membership)
    db.flush()
    return organization_membership, branch_membership
