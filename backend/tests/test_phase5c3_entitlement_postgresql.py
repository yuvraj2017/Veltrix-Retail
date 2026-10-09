from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.core.user_status import UserRole, UserStatus
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.organization import Organization
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.schemas.product import ProductCreate
from app.schemas.subscription import ShopOverrideCreateRequest
from app.services import commercial_service
from app.services.product_service import create_product
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for Phase 5C.3 concurrency verification",
)


@pytest.fixture(scope="module")
def pg():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT current_database()")).scalar_one()
    if database_name == "ims_db":
        engine.dispose()
        pytest.fail("Phase 5C.3 tests refuse to run against ims_db")
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def _setup(Session, *, product_limit: int):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Phase5C3 {unique}", status="active")
        db.add(organization)
        db.flush()
        shop = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            status="active",
            name=f"Phase5C3 Shop {unique}",
            category="Test",
            email=f"shop-{unique}@example.com",
            phone="9000000000",
        )
        db.add(shop)
        db.flush()
        owner = User(
            shop_id=shop.id,
            full_name="Quota Owner",
            email=f"owner-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.OWNER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        admin = User(
            shop_id=None,
            full_name="Platform Admin",
            email=f"admin-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add_all([owner, admin])
        ensure_legacy_subscription_for_shop(db=db, shop_id=shop.id)
        definition = (
            db.query(EntitlementDefinition)
            .filter(EntitlementDefinition.key == "products.max")
            .one()
        )
        db.add(
            ShopEntitlementOverride(
                shop_id=shop.id,
                entitlement_id=definition.id,
                limit_value=Decimal(product_limit),
                starts_at=datetime.now(timezone.utc) - timedelta(minutes=1),
                reason="Phase 5C.3 concurrency baseline",
            )
        )
        db.commit()
        return shop.id, owner.id, admin.id, definition.id, unique


def _create(Session, owner_id: int, unique: str, index: int):
    with Session() as db:
        owner = db.get(User, owner_id)
        try:
            create_product(
                ProductCreate(
                    name=f"Concurrent product {index}",
                    sku=f"P5C3-{unique}-{index}",
                    category="Test",
                ),
                owner,
                db,
            )
            return 201
        except HTTPException as exc:
            db.rollback()
            return exc.status_code


def test_concurrent_product_creation_cannot_exceed_effective_limit(pg):
    _engine, Session = pg
    shop_id, owner_id, _admin_id, _definition_id, unique = _setup(
        Session, product_limit=1
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = sorted(
            future.result(timeout=20)
            for future in (
                executor.submit(_create, Session, owner_id, unique, 1),
                executor.submit(_create, Session, owner_id, unique, 2),
            )
        )

    assert results == [201, 409]
    with Session() as db:
        assert db.query(Product).filter(Product.shop_id == shop_id).count() == 1


def test_override_reduction_serializes_before_waiting_resource_creation(pg, monkeypatch):
    _engine, Session = pg
    shop_id, owner_id, admin_id, definition_id, unique = _setup(
        Session, product_limit=2
    )
    lock_held = threading.Event()
    release_override = threading.Event()
    create_started = threading.Event()
    original_audit = commercial_service._audit

    def blocking_audit(*args, **kwargs):
        lock_held.set()
        assert release_override.wait(timeout=10)
        return original_audit(*args, **kwargs)

    monkeypatch.setattr(commercial_service, "_audit", blocking_audit)

    def reduce_limit():
        with Session() as db:
            actor = db.get(User, admin_id)
            return commercial_service.create_shop_override(
                db,
                shop_id,
                ShopOverrideCreateRequest(
                    entitlement_id=definition_id,
                    limit_value=Decimal("0"),
                    reason="Concurrent quota reduction",
                ),
                actor,
            ).id

    def create_while_reducing():
        create_started.set()
        return _create(Session, owner_id, unique, 3)

    with ThreadPoolExecutor(max_workers=2) as executor:
        reduction = executor.submit(reduce_limit)
        assert lock_held.wait(timeout=10)
        creation = executor.submit(create_while_reducing)
        assert create_started.wait(timeout=10)
        time.sleep(0.2)
        assert not creation.done()
        release_override.set()
        assert reduction.result(timeout=20) > 0
        assert creation.result(timeout=20) == 409

    with Session() as db:
        assert db.query(Product).filter(Product.shop_id == shop_id).count() == 0
