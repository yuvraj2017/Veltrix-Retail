from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.core.user_status import UserRole, UserStatus
from app.models.organization import Organization
from app.models.entitlement import EntitlementDefinition, EntitlementKind
from app.models.plan import Plan
from app.models.plan_catalog import PlanCatalogEntitlementSnapshot, PlanCatalogVersion
from app.models.user import User
from app.schemas.subscription import (
    CatalogEntitlementSnapshotRequest,
    PlanCatalogPublishRequest,
    PlanCreateRequest,
)
from app.services import commercial_service


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for Phase 5C.2 PostgreSQL verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database()")) .scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Phase 5C.2 tests refuse to run against ims_db")
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def _setup(Session):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Phase5C2 {unique}", status="active")
        db.add(organization)
        actor = User(
            shop_id=None,
            full_name="Catalog Administrator",
            email=f"catalog-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(actor)
        db.flush()
        entitlements = _complete_entitlements(db)
        plan = commercial_service.create_plan(
            db,
            PlanCreateRequest(
                code=f"phase5c2-{unique}",
                name="Phase 5C.2",
                monthly_price=Decimal("100.00"),
                annual_price=Decimal("1000.00"),
                currency="INR",
                entitlements=entitlements,
            ),
            actor,
        )
        return plan.id, actor.id


def _complete_entitlements(db):
    definitions = (
        db.query(EntitlementDefinition)
        .filter(EntitlementDefinition.is_active == True)  # noqa: E712
        .order_by(EntitlementDefinition.id.asc())
        .all()
    )
    return [
        CatalogEntitlementSnapshotRequest(
            entitlement_id=definition.id,
            limit_value=Decimal("0") if definition.kind == EntitlementKind.LIMIT else None,
            is_unlimited=False,
            feature_enabled=False if definition.kind == EntitlementKind.FEATURE else None,
        )
        for definition in definitions
    ]


def _publish(Session, plan_id, actor_id, amount):
    with Session() as db:
        actor = db.get(User, actor_id)
        result = commercial_service.publish_plan_catalog_version(
            db,
            plan_id,
            PlanCatalogPublishRequest(
                monthly_price=Decimal(amount),
                annual_price=Decimal(amount) * 10,
                currency="INR",
                entitlements=_complete_entitlements(db),
            ),
            actor,
        )
        return result.version_number


def test_concurrent_catalog_publications_are_monotonic(pg):
    _engine, Session = pg
    plan_id, actor_id = _setup(Session)

    with ThreadPoolExecutor(max_workers=2) as executor:
        versions = sorted(
            future.result(timeout=20)
            for future in (
                executor.submit(_publish, Session, plan_id, actor_id, "200.00"),
                executor.submit(_publish, Session, plan_id, actor_id, "300.00"),
            )
        )

    assert versions == [2, 3]
    with Session() as db:
        rows = (
            db.query(PlanCatalogVersion)
            .filter_by(plan_id=plan_id)
            .order_by(PlanCatalogVersion.version_number)
            .all()
        )
        assert [row.version_number for row in rows] == [1, 2, 3]


def test_concurrent_publication_from_same_stale_version_is_rejected(pg):
    _engine, Session = pg
    plan_id, actor_id = _setup(Session)

    def publish(amount):
        with Session() as db:
            actor = db.get(User, actor_id)
            try:
                result = commercial_service.publish_plan_catalog_version(
                    db,
                    plan_id,
                    PlanCatalogPublishRequest(
                        expected_latest_version_number=1,
                        monthly_price=Decimal(amount),
                        annual_price=Decimal(amount) * 10,
                        currency="INR",
                        entitlements=_complete_entitlements(db),
                    ),
                    actor,
                )
                return result.version_number
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = sorted(
            future.result(timeout=20)
            for future in (
                executor.submit(publish, "200.00"),
                executor.submit(publish, "300.00"),
            )
        )

    assert results == [2, 409]
    with Session() as db:
        versions = (
            db.query(PlanCatalogVersion)
            .filter_by(plan_id=plan_id)
            .order_by(PlanCatalogVersion.version_number)
            .all()
        )
        assert [version.version_number for version in versions] == [1, 2]


def test_postgresql_rejects_published_catalog_mutation(pg):
    _engine, Session = pg
    plan_id, _actor_id = _setup(Session)
    with Session() as db:
        version = db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).one()
        version.monthly_price = Decimal("999.00")
        with pytest.raises(DBAPIError):
            db.commit()
        db.rollback()

    with Session() as db:
        version = db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).one()
        assert version.monthly_price == Decimal("100.00")


def test_failed_publication_leaves_no_partial_version(pg):
    _engine, Session = pg
    plan_id, actor_id = _setup(Session)
    with Session() as db:
        actor = db.get(User, actor_id)
        before = db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).count()
        with pytest.raises(Exception):
            commercial_service.publish_plan_catalog_version(
                db,
                plan_id,
                PlanCatalogPublishRequest(
                    monthly_price=Decimal("200.00"),
                    annual_price=Decimal("2000.00"),
                    currency="INR",
                    entitlements=[
                        *_complete_entitlements(db),
                        {"entitlement_id": 999999, "limit_value": 1},
                    ],
                ),
                actor,
            )
        db.rollback()
        assert db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).count() == before


def test_incomplete_snapshot_is_rejected_without_partial_postgresql_rows(pg):
    _engine, Session = pg
    plan_id, actor_id = _setup(Session)
    with Session() as db:
        actor = db.get(User, actor_id)
        complete = _complete_entitlements(db)
        before_versions = db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).count()
        before_snapshots = (
            db.query(PlanCatalogEntitlementSnapshot)
            .join(PlanCatalogVersion)
            .filter(PlanCatalogVersion.plan_id == plan_id)
            .count()
        )
        before_price = db.get(Plan, plan_id).monthly_price

        with pytest.raises(HTTPException) as exc:
            commercial_service.publish_plan_catalog_version(
                db,
                plan_id,
                PlanCatalogPublishRequest(
                    monthly_price=Decimal("999.00"),
                    annual_price=Decimal("9990.00"),
                    currency="INR",
                    entitlements=complete[:-1],
                ),
                actor,
            )

        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "CATALOG_SNAPSHOT_INVALID"
        assert db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).count() == before_versions
        assert (
            db.query(PlanCatalogEntitlementSnapshot)
            .join(PlanCatalogVersion)
            .filter(PlanCatalogVersion.plan_id == plan_id)
            .count()
            == before_snapshots
        )
        assert db.get(Plan, plan_id).monthly_price == before_price
