import os
import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.membership import MembershipRole, MembershipStatus
from app.core.permissions import permissions_for_role
from app.core.security import hash_password
from app.core.user_status import UserRole, UserStatus
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User
from app.services.authorization_service import TenantAuthorizationContext
from app.services.staff_service import transfer_ownership


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for PostgreSQL row-lock verification",
)


def test_concurrent_ownership_transfers_preserve_exactly_one_owner():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    unique = uuid4().hex

    with Session() as db:
        organization = Organization(name=f"Owner concurrency {unique}", status="active")
        db.add(organization)
        db.flush()
        shop = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            name=f"Owner concurrency {unique}",
            category="Test",
            email=f"shop-{unique}@example.com",
            phone="9000000000",
        )
        db.add(shop)
        db.flush()

        users = []
        memberships = []
        for index, role in enumerate(
            (MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.MANAGER)
        ):
            user = User(
                shop_id=shop.id,
                full_name=f"Concurrency User {index}",
                email=f"owner-concurrency-{index}-{unique}@example.com",
                password_hash=hash_password("StrongPassword123!"),
                role=UserRole.OWNER,
                status=UserStatus.ACTIVE,
                is_active=True,
            )
            db.add(user)
            db.flush()
            membership = OrganizationMembership(
                organization_id=organization.id,
                user_id=user.id,
                role=role,
                status=MembershipStatus.ACTIVE,
            )
            db.add(membership)
            db.flush()
            branch_membership = BranchMembership(
                organization_membership_id=membership.id,
                organization_id=organization.id,
                shop_id=shop.id,
                status=MembershipStatus.ACTIVE,
            )
            db.add(branch_membership)
            users.append(user)
            memberships.append(membership)
        db.commit()
        organization_id = organization.id
        shop_id = shop.id
        owner_user_id = users[0].id
        owner_membership_id = memberships[0].id
        target_ids = [memberships[1].id, memberships[2].id]

    barrier = threading.Barrier(2)

    def attempt_transfer(target_id: int) -> int:
        with Session() as db:
            user = db.get(User, owner_user_id)
            organization = db.get(Organization, organization_id)
            shop = db.get(Shop, shop_id)
            owner_membership = db.get(OrganizationMembership, owner_membership_id)
            branch_membership = (
                db.query(BranchMembership)
                .filter_by(
                    organization_membership_id=owner_membership_id,
                    shop_id=shop_id,
                )
                .one()
            )
            context = TenantAuthorizationContext(
                user=user,
                organization=organization,
                shop=shop,
                organization_membership=owner_membership,
                branch_membership=branch_membership,
                role=MembershipRole.OWNER,
                permissions=permissions_for_role(MembershipRole.OWNER),
            )
            barrier.wait(timeout=10)
            try:
                transfer_ownership(db, context, target_id)
                return 200
            except HTTPException as exc:
                return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt_transfer, target_ids))

    with Session() as db:
        owner_memberships = (
            db.query(OrganizationMembership)
            .filter_by(
                organization_id=organization_id,
                role=MembershipRole.OWNER,
                status=MembershipStatus.ACTIVE,
            )
            .all()
        )
        audits = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action == BusinessAuditAction.OWNERSHIP_TRANSFERRED,
                BusinessAuditLog.audit_metadata["organization_id"].as_integer()
                == organization_id,
            )
            .count()
        )

    assert sorted(results) == [200, 409]
    assert len(owner_memberships) == 1
    assert owner_memberships[0].id in target_ids
    assert audits == 1
    engine.dispose()
