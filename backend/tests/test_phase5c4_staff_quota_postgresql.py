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
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.branch import BranchCreateRequest
from app.schemas.staff import StaffCreate, StaffUpdate
from app.services import branch_service, organization_entitlement_service
from app.services.authorization_service import TenantAuthorizationContext
from app.services.branch_service import create_branch
from app.services.organization_entitlement_service import (
    count_organization_locations,
    count_organization_staff,
    reassign_commercial_source_as_owner,
)
from app.services.staff_service import create_staff, transfer_ownership, update_staff
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for staff quota concurrency verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database() ")).scalar_one()
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Staff quota concurrency tests refuse to run against ims_db")
    if revision != "20261010_0023":
        engine.dispose()
        pytest.fail("Staff quota PostgreSQL database must be migrated to 0023")
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def _add_staff_limit(db, shop_id: int, limit: int) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key="staff.max").one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(limit),
            starts_at=datetime.now(timezone.utc),
            reason="Staff quota PostgreSQL test",
        )
    )


def _add_location_limit(db, shop_id: int, limit: int) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key="locations.max").one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(limit),
            starts_at=datetime.now(timezone.utc),
            reason="Release hardening location quota test",
        )
    )


def _setup(
    Session,
    *,
    limit: int,
    active_staff: int = 0,
    inactive_staff: int = 0,
    target_source_limit: int | None = None,
):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Staff quota {unique}", status="active")
        db.add(organization)
        db.flush()
        source = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            status=ShopStatus.ACTIVE,
            name=f"Staff source {unique}",
            category="Test",
            email=f"staff-source-{unique}@example.com",
            phone="9000000071",
        )
        db.add(source)
        db.flush()
        organization.commercial_source_shop_id = source.id

        owner = User(
            shop_id=source.id,
            full_name="Staff Quota Owner",
            email=f"staff-owner-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.OWNER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(owner)
        db.flush()
        owner_membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=owner.id,
            role=MembershipRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        db.add(owner_membership)
        db.flush()
        db.add(
            BranchMembership(
                organization_membership_id=owner_membership.id,
                organization_id=organization.id,
                shop_id=source.id,
                status=MembershipStatus.ACTIVE,
            )
        )
        ensure_legacy_subscription_for_shop(db=db, shop_id=source.id)
        _add_staff_limit(db, source.id, limit)

        staff_membership_ids = []
        for index in range(active_staff + inactive_staff):
            user = User(
                shop_id=source.id,
                full_name=f"Quota Staff {index}",
                email=f"staff-{index}-{unique}@example.com",
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
                role=MembershipRole.MANAGER,
                status=(
                    MembershipStatus.ACTIVE
                    if index < active_staff
                    else MembershipStatus.INACTIVE
                ),
            )
            db.add(membership)
            db.flush()
            db.add(
                BranchMembership(
                    organization_membership_id=membership.id,
                    organization_id=organization.id,
                    shop_id=source.id,
                    status=MembershipStatus.ACTIVE,
                )
            )
            staff_membership_ids.append(membership.id)

        target_source_id = None
        if target_source_limit is not None:
            target = Shop(
                organization_id=organization.id,
                is_default_branch=False,
                status=ShopStatus.ACTIVE,
                name=f"Staff target {unique}",
                category="Test",
                email=f"staff-target-{unique}@example.com",
                phone="9000000072",
            )
            db.add(target)
            db.flush()
            db.add(
                BranchMembership(
                    organization_membership_id=owner_membership.id,
                    organization_id=organization.id,
                    shop_id=target.id,
                    status=MembershipStatus.ACTIVE,
                )
            )
            ensure_legacy_subscription_for_shop(db=db, shop_id=target.id)
            _add_staff_limit(db, target.id, target_source_limit)
            target_source_id = target.id

        db.commit()
        return {
            "organization_id": organization.id,
            "source_id": source.id,
            "target_source_id": target_source_id,
            "owner_id": owner.id,
            "owner_membership_id": owner_membership.id,
            "staff_membership_ids": staff_membership_ids,
        }


def _context(Session, setup):
    db = Session()
    return db, TenantAuthorizationContext(
        user=db.get(User, setup["owner_id"]),
        organization=db.get(Organization, setup["organization_id"]),
        shop=db.get(Shop, setup["source_id"]),
        organization_membership=db.get(
            OrganizationMembership, setup["owner_membership_id"]
        ),
        branch_membership=(
            db.query(BranchMembership)
            .filter_by(
                organization_membership_id=setup["owner_membership_id"],
                shop_id=setup["source_id"],
            )
            .one()
        ),
        role=MembershipRole.OWNER,
        permissions=permissions_for_role(MembershipRole.OWNER),
    )


def _payload(setup, index: int, *, role: str = MembershipRole.MANAGER) -> StaffCreate:
    unique = uuid4().hex
    return StaffCreate(
        full_name=f"Concurrent Staff {index}",
        email=f"concurrent-staff-{index}-{unique}@example.com",
        initial_password="StrongPassword123!",
        role=role,
        branch_ids=[setup["source_id"]],
        default_shop_id=setup["source_id"],
    )


def _branch_payload(index: int) -> BranchCreateRequest:
    unique = uuid4().hex
    return BranchCreateRequest(
        name=f"Concurrent branch {index} {unique}",
        category="Test",
        email=f"concurrent-branch-{index}-{unique}@example.com",
        phone=f"91111112{index:02d}",
    )


def test_concurrent_staff_creations_cannot_consume_one_slot_twice(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1)
    barrier = threading.Barrier(2)

    def create(index: int) -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, index))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, range(2)))

    with Session() as db:
        usage = count_organization_staff(db, setup["organization_id"])
    assert sorted(results) == [201, 409]
    assert usage == 1


def test_staff_creation_and_reactivation_compete_for_one_slot(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1, inactive_staff=1)
    barrier = threading.Barrier(2)

    def create() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def reactivate() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            update_staff(
                db,
                context,
                setup["staff_membership_ids"][0],
                StaffUpdate(status=MembershipStatus.ACTIVE),
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(create), executor.submit(reactivate)]
        results = [future.result(timeout=20) for future in futures]

    with Session() as db:
        usage = count_organization_staff(db, setup["organization_id"])
    assert 409 in results
    assert len([result for result in results if result in {200, 201}]) == 1
    assert usage == 1


def test_ownership_transfer_and_staff_creation_revalidate_actor_role(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=2, active_staff=1)
    barrier = threading.Barrier(2)

    def create_admin() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(
                db,
                context,
                _payload(setup, 1, role=MembershipRole.ADMIN),
            )
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def transfer() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            transfer_ownership(db, context, setup["staff_membership_ids"][0])
            return 200
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(create_admin), executor.submit(transfer)]
        create_result, transfer_result = [future.result(timeout=20) for future in futures]

    with Session() as db:
        usage = count_organization_staff(db, setup["organization_id"])
    assert transfer_result == 200
    assert create_result in {201, 403}
    assert usage <= 2


def test_source_reassignment_and_staff_creation_serialize(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1, target_source_limit=0)
    barrier = threading.Barrier(2)

    def create() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, 1))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def reassign() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            reassign_commercial_source_as_owner(
                db,
                context,
                target_shop_id=setup["target_source_id"],
                reason="Staff quota allocation race",
            )
            return 200
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(create), executor.submit(reassign)]
        create_result, reassign_result = [future.result(timeout=20) for future in futures]

    with Session() as db:
        organization = db.get(Organization, setup["organization_id"])
        usage = count_organization_staff(db, setup["organization_id"])
    assert reassign_result == 200
    assert create_result in {201, 409}
    assert organization.commercial_source_shop_id == setup["target_source_id"]
    assert usage in {0, 1}


def test_subscription_change_blocks_and_revalidates_staff_creation(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1)
    lock_held = threading.Event()
    release = threading.Event()

    def suspend_source() -> None:
        with Session() as db:
            db.query(Shop).filter(Shop.id == setup["source_id"]).with_for_update().one()
            subscription = (
                db.query(ShopSubscription)
                .filter_by(shop_id=setup["source_id"])
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
        db, context = _context(Session, setup)
        try:
            create_staff(db, context, _payload(setup, 1))
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


def test_override_reduction_blocks_and_revalidates_staff_creation(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1)
    lock_held = threading.Event()
    release = threading.Event()

    def reduce_limit() -> None:
        with Session() as db:
            db.query(Shop).filter(Shop.id == setup["source_id"]).with_for_update().one()
            _add_staff_limit(db, setup["source_id"], 0)
            db.flush()
            lock_held.set()
            assert release.wait(timeout=10)
            db.commit()

    def create() -> int:
        db, context = _context(Session, setup)
        try:
            create_staff(db, context, _payload(setup, 1))
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


def test_cross_organization_staff_creations_do_not_share_quota(pg):
    _engine, Session = pg
    first = _setup(Session, limit=1)
    second = _setup(Session, limit=1)
    barrier = threading.Barrier(2)

    def create(setup, index: int) -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, index))
            return 201
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda item: create(*item), [(first, 1), (second, 2)]))

    assert results == [201, 201]
    with Session() as db:
        assert count_organization_staff(db, first["organization_id"]) == 1
        assert count_organization_staff(db, second["organization_id"]) == 1


def test_ownership_transfer_and_branch_creation_revalidate_current_owner(
    pg, monkeypatch
):
    _engine, Session = pg
    setup = _setup(Session, limit=2, active_staff=1)
    payload = _branch_payload(1)
    operation_reached_lock = threading.Event()
    release_operation = threading.Event()
    original_lock_organization = branch_service._lock_organization

    def pause_before_organization_lock(db, organization_id):
        operation_reached_lock.set()
        if not release_operation.wait(timeout=10):
            raise RuntimeError("Timed out waiting to release stale branch creation")
        return original_lock_organization(db, organization_id)

    monkeypatch.setattr(
        branch_service,
        "_lock_organization",
        pause_before_organization_lock,
    )

    with Session() as db:
        organization = db.get(Organization, setup["organization_id"])
        original_source_id = organization.commercial_source_shop_id
        original_shop_count = db.query(Shop).filter_by(
            organization_id=setup["organization_id"]
        ).count()
        original_assignment_count = db.query(BranchMembership).filter_by(
            organization_id=setup["organization_id"]
        ).count()
        original_audit_count = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action == BusinessAuditAction.BRANCH_CREATED,
                BusinessAuditLog.audit_metadata["organization_id"].as_integer()
                == setup["organization_id"],
            )
            .count()
        )

    def create() -> int:
        db, context = _context(Session, setup)
        try:
            create_branch(db, context, payload)
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        create_future = executor.submit(create)
        try:
            assert operation_reached_lock.wait(timeout=10)

            db, context = _context(Session, setup)
            try:
                transfer_ownership(db, context, setup["staff_membership_ids"][0])
            finally:
                db.close()

            with Session() as db:
                previous_owner = db.get(
                    OrganizationMembership, setup["owner_membership_id"]
                )
                current_owner = db.get(
                    OrganizationMembership, setup["staff_membership_ids"][0]
                )
                assert previous_owner.role != MembershipRole.OWNER
                assert current_owner.role == MembershipRole.OWNER
        finally:
            release_operation.set()

        assert create_future.result(timeout=10) == 403

    with Session() as db:
        organization = db.get(Organization, setup["organization_id"])
        owner_count = (
            db.query(OrganizationMembership)
            .filter_by(
                organization_id=setup["organization_id"],
                role=MembershipRole.OWNER,
                status=MembershipStatus.ACTIVE,
            )
            .count()
        )
        branch_audit_count = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action == BusinessAuditAction.BRANCH_CREATED,
                BusinessAuditLog.audit_metadata["organization_id"].as_integer()
                == setup["organization_id"],
            )
            .count()
        )
        assert organization.commercial_source_shop_id == original_source_id
        assert db.query(Shop).filter_by(name=payload.name).count() == 0
        assert db.query(Shop).filter_by(
            organization_id=setup["organization_id"]
        ).count() == original_shop_count
        assert db.query(BranchMembership).filter_by(
            organization_id=setup["organization_id"]
        ).count() == original_assignment_count
        assert branch_audit_count == original_audit_count
        assert owner_count == 1


def test_ownership_transfer_and_source_reassignment_revalidate_current_owner(
    pg, monkeypatch
):
    _engine, Session = pg
    setup = _setup(Session, limit=2, active_staff=1, target_source_limit=2)
    operation_reached_lock = threading.Event()
    release_operation = threading.Event()
    original_reassign = organization_entitlement_service._reassign_commercial_source

    def pause_before_organization_lock(*args, **kwargs):
        operation_reached_lock.set()
        if not release_operation.wait(timeout=10):
            raise RuntimeError("Timed out waiting to release stale source reassignment")
        return original_reassign(*args, **kwargs)

    monkeypatch.setattr(
        organization_entitlement_service,
        "_reassign_commercial_source",
        pause_before_organization_lock,
    )

    shop_ids = [setup["source_id"], setup["target_source_id"]]
    with Session() as db:
        original_source_id = db.get(
            Organization, setup["organization_id"]
        ).commercial_source_shop_id
        original_audit_count = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action
                == BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_CHANGED,
                BusinessAuditLog.entity_id == setup["organization_id"],
            )
            .count()
        )
        original_subscriptions = db.query(
            ShopSubscription.id,
            ShopSubscription.shop_id,
            ShopSubscription.plan_id,
            ShopSubscription.catalog_version_id,
            ShopSubscription.status,
            ShopSubscription.current_period_end,
        ).filter(ShopSubscription.shop_id.in_(shop_ids)).order_by(
            ShopSubscription.id
        ).all()
        original_licenses = db.query(
            ShopLicense.id,
            ShopLicense.shop_id,
            ShopLicense.subscription_id,
            ShopLicense.status,
            ShopLicense.expires_at,
            ShopLicense.revoked_at,
        ).filter(ShopLicense.shop_id.in_(shop_ids)).order_by(ShopLicense.id).all()

    def reassign() -> int:
        db, context = _context(Session, setup)
        try:
            reassign_commercial_source_as_owner(
                db,
                context,
                target_shop_id=setup["target_source_id"],
                reason="Ownership transfer authorization race",
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        reassign_future = executor.submit(reassign)
        try:
            assert operation_reached_lock.wait(timeout=10)

            db, context = _context(Session, setup)
            try:
                transfer_ownership(db, context, setup["staff_membership_ids"][0])
            finally:
                db.close()

            with Session() as db:
                previous_owner = db.get(
                    OrganizationMembership, setup["owner_membership_id"]
                )
                current_owner = db.get(
                    OrganizationMembership, setup["staff_membership_ids"][0]
                )
                assert previous_owner.role != MembershipRole.OWNER
                assert current_owner.role == MembershipRole.OWNER
        finally:
            release_operation.set()

        assert reassign_future.result(timeout=10) == 403

    with Session() as db:
        organization = db.get(Organization, setup["organization_id"])
        owner_count = (
            db.query(OrganizationMembership)
            .filter_by(
                organization_id=setup["organization_id"],
                role=MembershipRole.OWNER,
                status=MembershipStatus.ACTIVE,
            )
            .count()
        )
        audit_count = (
            db.query(BusinessAuditLog)
            .filter(
                BusinessAuditLog.action
                == BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_CHANGED,
                BusinessAuditLog.entity_id == setup["organization_id"],
            )
            .count()
        )
        subscriptions = db.query(
            ShopSubscription.id,
            ShopSubscription.shop_id,
            ShopSubscription.plan_id,
            ShopSubscription.catalog_version_id,
            ShopSubscription.status,
            ShopSubscription.current_period_end,
        ).filter(ShopSubscription.shop_id.in_(shop_ids)).order_by(
            ShopSubscription.id
        ).all()
        licenses = db.query(
            ShopLicense.id,
            ShopLicense.shop_id,
            ShopLicense.subscription_id,
            ShopLicense.status,
            ShopLicense.expires_at,
            ShopLicense.revoked_at,
        ).filter(ShopLicense.shop_id.in_(shop_ids)).order_by(ShopLicense.id).all()
        assert organization.commercial_source_shop_id == original_source_id
        assert audit_count == original_audit_count
        assert subscriptions == original_subscriptions
        assert licenses == original_licenses
        assert owner_count == 1


def test_staff_deactivation_and_reactivation_serialize(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1, active_staff=1)
    barrier = threading.Barrier(2)

    def change(status_value: str) -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            update_staff(
                db,
                context,
                setup["staff_membership_ids"][0],
                StaffUpdate(status=status_value),
            )
            return 200
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(change, MembershipStatus.INACTIVE),
            executor.submit(change, MembershipStatus.ACTIVE),
        ]
        results = [future.result(timeout=20) for future in futures]

    assert results[0] == 200
    assert results[1] in {200, 409}
    with Session() as db:
        assert count_organization_staff(db, setup["organization_id"]) <= 1


def test_branch_and_staff_allocation_serialize_within_one_organization(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1)
    barrier = threading.Barrier(2)

    def create_branch_row() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _branch_payload(1))
            return 201
        finally:
            db.close()

    def create_staff_row() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, 1))
            return 201
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(create_branch_row), executor.submit(create_staff_row)]
        results = [future.result(timeout=20) for future in futures]

    assert results == [201, 201]
    with Session() as db:
        assert count_organization_locations(db, setup["organization_id"]) == 2
        assert count_organization_staff(db, setup["organization_id"]) == 1


def test_source_reassignment_serializes_branch_and_staff_allocations(pg):
    _engine, Session = pg
    setup = _setup(Session, limit=1, target_source_limit=0)
    with Session() as db:
        _add_location_limit(db, setup["source_id"], 3)
        _add_location_limit(db, setup["target_source_id"], 2)
        db.commit()
    barrier = threading.Barrier(3)

    def reassign() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            reassign_commercial_source_as_owner(
                db,
                context,
                target_shop_id=setup["target_source_id"],
                reason="Combined quota allocation race",
            )
            return 200
        finally:
            db.close()

    def allocate_branch() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_branch(db, context, _branch_payload(2))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    def allocate_staff() -> int:
        db, context = _context(Session, setup)
        try:
            barrier.wait(timeout=10)
            create_staff(db, context, _payload(setup, 2))
            return 201
        except HTTPException as exc:
            return exc.status_code
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(reassign),
            executor.submit(allocate_branch),
            executor.submit(allocate_staff),
        ]
        reassign_result, branch_result, staff_result = [
            future.result(timeout=30) for future in futures
        ]

    assert reassign_result == 200
    assert branch_result in {201, 409}
    assert staff_result in {201, 409}
    with Session() as db:
        organization = db.get(Organization, setup["organization_id"])
        assert organization.commercial_source_shop_id == setup["target_source_id"]
        assert count_organization_locations(db, setup["organization_id"]) in {2, 3}
        assert count_organization_staff(db, setup["organization_id"]) in {0, 1}

    db, context = _context(Session, setup)
    try:
        with pytest.raises(HTTPException) as branch_error:
            create_branch(db, context, _branch_payload(3))
        assert branch_error.value.status_code == 409
    finally:
        db.close()
    db, context = _context(Session, setup)
    try:
        with pytest.raises(HTTPException) as staff_error:
            create_staff(db, context, _payload(setup, 3))
        assert staff_error.value.status_code == 409
    finally:
        db.close()
