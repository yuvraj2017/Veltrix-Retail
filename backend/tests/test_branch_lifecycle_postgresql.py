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
from app.core.shop_status import ShopStatus
from app.core.user_status import UserRole, UserStatus
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.user import User
from app.schemas.branch import BranchCreateRequest
from app.services.authorization_service import TenantAuthorizationContext
from app.services.branch_service import (
    create_branch,
    deactivate_branch,
    make_default_branch,
)
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for PostgreSQL lifecycle verification",
)


def _setup_organization(Session, *, branch_count: int = 3):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Branch concurrency {unique}", status="active")
        db.add(organization)
        db.flush()
        shops = []
        for index in range(branch_count):
            shop = Shop(
                organization_id=organization.id,
                is_default_branch=index == 0,
                status=ShopStatus.ACTIVE,
                name=f"Concurrency Branch {index} {unique}",
                category="Test",
                email=f"branch-{index}-{unique}@example.com",
                phone=f"90000000{index:02d}",
            )
            db.add(shop)
            shops.append(shop)
        db.flush()

        user = User(
            shop_id=shops[0].id,
            full_name="Branch Concurrency Owner",
            email=f"branch-owner-{unique}@example.com",
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
            role=MembershipRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        db.add(membership)
        db.flush()
        for shop in shops:
            db.add(
                BranchMembership(
                    organization_membership_id=membership.id,
                    organization_id=organization.id,
                    shop_id=shop.id,
                    status=MembershipStatus.ACTIVE,
                )
            )
        ensure_legacy_subscription_for_shop(db=db, shop_id=shops[0].id)
        db.commit()
        return organization.id, user.id, membership.id, [shop.id for shop in shops]


def _context(Session, organization_id, user_id, membership_id, active_shop_id):
    db = Session()
    context = TenantAuthorizationContext(
        user=db.get(User, user_id),
        organization=db.get(Organization, organization_id),
        shop=db.get(Shop, active_shop_id),
        organization_membership=db.get(OrganizationMembership, membership_id),
        branch_membership=(
            db.query(BranchMembership)
            .filter_by(
                organization_membership_id=membership_id,
                shop_id=active_shop_id,
            )
            .one()
        ),
        role=MembershipRole.OWNER,
        permissions=permissions_for_role(MembershipRole.OWNER),
    )
    return db, context


def test_concurrent_default_changes_preserve_exactly_one_default():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    organization_id, user_id, membership_id, shop_ids = _setup_organization(Session)
    barrier = threading.Barrier(2)

    def change_default(target_id):
        db, context = _context(
            Session, organization_id, user_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            make_default_branch(db, context, target_id)
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(change_default, shop_ids[1:3]))

    with Session() as db:
        defaults = (
            db.query(Shop)
            .filter_by(organization_id=organization_id, is_default_branch=True)
            .all()
        )
        audits = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action
                == BusinessAuditAction.BRANCH_DEFAULT_CHANGED,
                BusinessAuditLog.entity_id.in_(shop_ids[1:3]),
            )
            .count()
        )

    assert results == [200, 200]
    assert len(defaults) == 1
    assert defaults[0].id in shop_ids[1:3]
    assert audits == 2
    engine.dispose()


def test_concurrent_branch_creations_assign_owner_once_per_branch():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    organization_id, user_id, membership_id, shop_ids = _setup_organization(
        Session, branch_count=1
    )
    barrier = threading.Barrier(2)
    unique = uuid4().hex

    def create(index):
        db, context = _context(
            Session, organization_id, user_id, membership_id, shop_ids[0]
        )
        try:
            payload = BranchCreateRequest(
                name=f"Concurrent New {index} {unique}",
                category="Test",
                email=f"concurrent-new-{index}-{unique}@example.com",
                phone=f"91111111{index:02d}",
            )
            barrier.wait(timeout=10)
            return create_branch(db, context, payload).id
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        created_ids = list(executor.map(create, range(2)))

    with Session() as db:
        assignments = (
            db.query(BranchMembership)
            .filter(
                BranchMembership.organization_membership_id == membership_id,
                BranchMembership.shop_id.in_(created_ids),
            )
            .all()
        )
        created = db.query(Shop).filter(Shop.id.in_(created_ids)).all()

    assert len(set(created_ids)) == 2
    assert len(assignments) == 2
    assert {row.shop_id for row in assignments} == set(created_ids)
    assert {row.status for row in created} == {ShopStatus.PENDING}
    engine.dispose()


def test_concurrent_default_change_and_deactivation_have_one_safe_winner():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    organization_id, user_id, membership_id, shop_ids = _setup_organization(Session)
    target_id = shop_ids[1]
    barrier = threading.Barrier(2)

    def attempt(operation):
        db, context = _context(
            Session, organization_id, user_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            operation(db, context, target_id)
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(attempt, make_default_branch)
        second = executor.submit(attempt, deactivate_branch)
        results = [first.result(), second.result()]

    with Session() as db:
        defaults = (
            db.query(Shop)
            .filter_by(organization_id=organization_id, is_default_branch=True)
            .all()
        )
        target = db.get(Shop, target_id)

    assert sorted(results) == [200, 409]
    assert len(defaults) == 1
    assert defaults[0].status == ShopStatus.ACTIVE
    if target.status == ShopStatus.INACTIVE:
        assert defaults[0].id != target_id
    engine.dispose()
