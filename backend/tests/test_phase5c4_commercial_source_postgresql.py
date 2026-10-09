from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.membership import MembershipRole, MembershipStatus
from app.core.permissions import permissions_for_role
from app.core.security import hash_password
from app.core.shop_status import ShopStatus
from app.core.user_status import UserRole, UserStatus
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.services.authorization_service import TenantAuthorizationContext
from app.services.branch_service import deactivate_branch
from app.services.organization_entitlement_service import (
    reassign_commercial_source_as_owner,
)
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for Phase 5C.4.2 concurrency verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database()")).scalar_one()
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Phase 5C.4.2 tests refuse to run against ims_db")
    if revision != "20261010_0023":
        engine.dispose()
        pytest.fail("Phase 5C.4.2 PostgreSQL database must be migrated to 0023")
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def _setup(Session):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Commercial source {unique}", status="active")
        db.add(organization)
        db.flush()
        shops = []
        for index in range(3):
            shop = Shop(
                organization_id=organization.id,
                is_default_branch=index == 0,
                status=ShopStatus.ACTIVE,
                name=f"Source branch {index} {unique}",
                category="Test",
                email=f"source-{index}-{unique}@example.com",
                phone=f"90000000{index:02d}",
            )
            db.add(shop)
            shops.append(shop)
        db.flush()
        organization.commercial_source_shop_id = shops[0].id
        owner = User(
            shop_id=shops[0].id,
            full_name="Commercial Source Owner",
            email=f"source-owner-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.OWNER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(owner)
        db.flush()
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=owner.id,
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
            ensure_legacy_subscription_for_shop(db=db, shop_id=shop.id)
        db.commit()
        return organization.id, owner.id, membership.id, [shop.id for shop in shops]


def _context(Session, organization_id, owner_id, membership_id, active_shop_id):
    db = Session()
    return db, TenantAuthorizationContext(
        user=db.get(User, owner_id),
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


def test_concurrent_source_reassignments_serialize(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session)
    barrier = threading.Barrier(2)

    def change(target_id):
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            reassign_commercial_source_as_owner(
                db,
                context,
                target_shop_id=target_id,
                reason=f"Concurrent source {target_id}",
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(change, shop_ids[1:]))

    with Session() as db:
        organization = db.get(Organization, organization_id)
        audits = (
            db.query(BusinessAuditLog)
            .filter_by(
                action=BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_CHANGED,
                entity_id=organization_id,
            )
            .count()
        )
    assert results == [200, 200]
    assert organization.commercial_source_shop_id in shop_ids[1:]
    assert audits == 2


def test_reassignment_and_target_deactivation_have_one_safe_winner(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session)
    target_id = shop_ids[1]
    barrier = threading.Barrier(2)

    def reassign():
        db, context = _context(Session, organization_id, owner_id, membership_id, shop_ids[0])
        try:
            barrier.wait(timeout=10)
            reassign_commercial_source_as_owner(
                db, context, target_shop_id=target_id, reason="Lifecycle race"
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def deactivate():
        db, context = _context(Session, organization_id, owner_id, membership_id, shop_ids[0])
        try:
            barrier.wait(timeout=10)
            deactivate_branch(db, context, target_id)
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(reassign), executor.submit(deactivate)]
        results = [future.result(timeout=20) for future in results]

    with Session() as db:
        organization = db.get(Organization, organization_id)
        target = db.get(Shop, target_id)
    assert sorted(results) == [200, 409]
    assert not (
        organization.commercial_source_shop_id == target_id
        and target.status != ShopStatus.ACTIVE
    )


def test_reassignment_waits_for_subscription_change_and_revalidates(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session)
    target_id = shop_ids[1]
    lock_held = threading.Event()
    release = threading.Event()

    def suspend_subscription():
        with Session() as db:
            db.query(Shop).filter(Shop.id == target_id).with_for_update().one()
            subscription = (
                db.query(ShopSubscription)
                .filter_by(shop_id=target_id)
                .order_by(ShopSubscription.id.desc())
                .with_for_update()
                .first()
            )
            subscription.status = "suspended"
            db.flush()
            lock_held.set()
            assert release.wait(timeout=10)
            db.commit()

    def reassign():
        db, context = _context(Session, organization_id, owner_id, membership_id, shop_ids[0])
        try:
            reassign_commercial_source_as_owner(
                db, context, target_shop_id=target_id, reason="Subscription race"
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        suspension = executor.submit(suspend_subscription)
        assert lock_held.wait(timeout=10)
        reassignment = executor.submit(reassign)
        time.sleep(0.2)
        assert not reassignment.done()
        release.set()
        suspension.result(timeout=20)
        assert reassignment.result(timeout=20) == 409


def test_reassignment_serializes_with_override_change_without_deadlock(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session)
    target_id = shop_ids[1]
    lock_held = threading.Event()
    release = threading.Event()

    def change_override():
        with Session() as db:
            db.query(Shop).filter(Shop.id == target_id).with_for_update().one()
            definition = (
                db.query(EntitlementDefinition)
                .filter_by(key="products.max")
                .one()
            )
            db.add(
                ShopEntitlementOverride(
                    shop_id=target_id,
                    entitlement_id=definition.id,
                    limit_value=Decimal("25"),
                    starts_at=datetime.now(timezone.utc),
                    reason="Concurrent override",
                )
            )
            db.flush()
            lock_held.set()
            assert release.wait(timeout=10)
            db.commit()

    def reassign():
        db, context = _context(Session, organization_id, owner_id, membership_id, shop_ids[0])
        try:
            reassign_commercial_source_as_owner(
                db, context, target_shop_id=target_id, reason="Override race"
            )
            return 200
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        override = executor.submit(change_override)
        assert lock_held.wait(timeout=10)
        reassignment = executor.submit(reassign)
        time.sleep(0.2)
        assert not reassignment.done()
        release.set()
        override.result(timeout=20)
        assert reassignment.result(timeout=20) == 200
