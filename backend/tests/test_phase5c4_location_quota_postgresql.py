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
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.branch import BranchCreateRequest
from app.services.authorization_service import TenantAuthorizationContext
from app.services.branch_service import activate_branch, create_branch, deactivate_branch
from app.services.organization_entitlement_service import (
    count_organization_locations,
    reassign_commercial_source_as_owner,
)
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for location quota concurrency verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database() ")).scalar_one()
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Location quota concurrency tests refuse to run against ims_db")
    if revision != "20261010_0023":
        engine.dispose()
        pytest.fail("Location quota PostgreSQL database must be migrated to 0023")
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def _add_limit_override(db, shop_id: int, limit: int) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key="locations.max").one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(limit),
            starts_at=datetime.now(timezone.utc),
            reason="Location quota PostgreSQL test",
        )
    )


def _setup(Session, *, limit: int, branch_statuses: tuple[str, ...] = ()):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Location quota {unique}", status="active")
        db.add(organization)
        db.flush()
        source = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            status=ShopStatus.ACTIVE,
            name=f"Quota source {unique}",
            category="Test",
            email=f"quota-source-{unique}@example.com",
            phone="9000000051",
        )
        db.add(source)
        db.flush()
        organization.commercial_source_shop_id = source.id

        owner = User(
            shop_id=source.id,
            full_name="Location Quota Owner",
            email=f"quota-owner-{unique}@example.com",
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

        shops = [source]
        for index, branch_status in enumerate(branch_statuses, start=1):
            branch = Shop(
                organization_id=organization.id,
                is_default_branch=False,
                status=branch_status,
                name=f"Quota branch {index} {unique}",
                category="Test",
                email=f"quota-{index}-{unique}@example.com",
                phone=f"90000000{50 + index}",
            )
            db.add(branch)
            db.flush()
            shops.append(branch)

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
        _add_limit_override(db, source.id, limit)
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


def _payload(name: str, index: int) -> BranchCreateRequest:
    unique = uuid4().hex
    return BranchCreateRequest(
        name=f"{name} {index} {unique}",
        category="Test",
        email=f"quota-create-{index}-{unique}@example.com",
        phone=f"91111111{index:02d}",
    )


def test_concurrent_creations_cannot_consume_one_slot_twice(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session, limit=2)
    barrier = threading.Barrier(2)

    def create(index: int) -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _payload("Concurrent create", index))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, range(2)))

    with Session() as db:
        usage = count_organization_locations(db, organization_id)
    assert sorted(results) == [201, 409]
    assert usage == 2


def test_creation_and_reactivation_compete_for_one_slot(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(
        Session,
        limit=2,
        branch_statuses=(ShopStatus.INACTIVE,),
    )
    barrier = threading.Barrier(2)

    def create() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _payload("Create versus reactivate", 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def reactivate() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            activate_branch(db, context, shop_ids[1])
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(create), executor.submit(reactivate)]
        results = [future.result(timeout=20) for future in results]

    with Session() as db:
        usage = count_organization_locations(db, organization_id)
    assert 409 in results
    assert len([result for result in results if result in {200, 201}]) == 1
    assert usage == 2


def test_source_reassignment_and_creation_serialize(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(
        Session,
        limit=3,
        branch_statuses=(ShopStatus.ACTIVE,),
    )
    with Session() as db:
        _add_limit_override(db, shop_ids[1], 2)
        db.commit()
    barrier = threading.Barrier(2)

    def create() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _payload("Reassignment race", 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def reassign() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            reassign_commercial_source_as_owner(
                db,
                context,
                target_shop_id=shop_ids[1],
                reason="Quota allocation race",
            )
            return 200
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(create), executor.submit(reassign)]
        create_result, reassign_result = [future.result(timeout=20) for future in results]

    with Session() as db:
        organization = db.get(Organization, organization_id)
        usage = count_organization_locations(db, organization_id)
    assert reassign_result == 200
    assert create_result in {201, 409}
    assert organization.commercial_source_shop_id == shop_ids[1]
    assert usage in {2, 3}


def test_subscription_change_blocks_and_revalidates_creation(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session, limit=2)
    lock_held = threading.Event()
    release = threading.Event()

    def suspend_source() -> None:
        with Session() as db:
            db.query(Shop).filter(Shop.id == shop_ids[0]).with_for_update().one()
            subscription = (
                db.query(ShopSubscription)
                .filter_by(shop_id=shop_ids[0])
                .order_by(ShopSubscription.id.desc())
                .with_for_update()
                .first()
            )
            subscription.status = "suspended"
            db.flush()
            lock_held.set()
            assert release.wait(timeout=10)
            db.commit()

    def create() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            create_branch(db, context, _payload("Subscription race", 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        mutation = executor.submit(suspend_source)
        assert lock_held.wait(timeout=10)
        creation = executor.submit(create)
        time.sleep(0.2)
        assert not creation.done()
        release.set()
        mutation.result(timeout=20)
        assert creation.result(timeout=20) == 403


def test_override_reduction_blocks_and_revalidates_creation(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(Session, limit=2)
    lock_held = threading.Event()
    release = threading.Event()

    def reduce_limit() -> None:
        with Session() as db:
            db.query(Shop).filter(Shop.id == shop_ids[0]).with_for_update().one()
            _add_limit_override(db, shop_ids[0], 1)
            db.flush()
            lock_held.set()
            assert release.wait(timeout=10)
            db.commit()

    def create() -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            create_branch(db, context, _payload("Override race", 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        mutation = executor.submit(reduce_limit)
        assert lock_held.wait(timeout=10)
        creation = executor.submit(create)
        time.sleep(0.2)
        assert not creation.done()
        release.set()
        mutation.result(timeout=20)
        assert creation.result(timeout=20) == 409


def test_deactivation_and_reactivation_preserve_quota(pg):
    _engine, Session = pg
    organization_id, owner_id, membership_id, shop_ids = _setup(
        Session,
        limit=2,
        branch_statuses=(ShopStatus.ACTIVE, ShopStatus.INACTIVE),
    )
    barrier = threading.Barrier(2)

    def transition(operation, branch_id: int) -> int:
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            operation(db, context, branch_id)
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [
            executor.submit(transition, deactivate_branch, shop_ids[1]),
            executor.submit(transition, activate_branch, shop_ids[2]),
        ]
        results = [future.result(timeout=20) for future in results]

    with Session() as db:
        usage = count_organization_locations(db, organization_id)
    assert results[0] == 200
    assert results[1] in {200, 409}
    assert usage <= 2


def test_cross_organization_creations_do_not_block_or_share_quota(pg):
    _engine, Session = pg
    first = _setup(Session, limit=2)
    second = _setup(Session, limit=2)
    barrier = threading.Barrier(2)

    def create(setup, index: int) -> int:
        organization_id, owner_id, membership_id, shop_ids = setup
        db, context = _context(
            Session, organization_id, owner_id, membership_id, shop_ids[0]
        )
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _payload("Tenant isolated", index))
            return 201
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda item: create(*item), [(first, 1), (second, 2)]))

    assert results == [201, 201]
    with Session() as db:
        assert count_organization_locations(db, first[0]) == 2
        assert count_organization_locations(db, second[0]) == 2
