import importlib.util
from decimal import Decimal
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.models.license import ShopLicense
from app.models.organization import Organization
from app.models.product import Product
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.schemas.product import ProductCreate
from app.services.auth_service import register_shop_owner
from app.services.product_service import create_product
from app.services.stock_service import reconcile_stock_balances


def _load_migration(connection):
    path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "20261003_0018_organization_branch_foundation.py"
    )
    spec = importlib.util.spec_from_file_location("phase4b_migration", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(connection))
    return module


def test_migration_backfills_one_organization_and_default_branch_per_shop():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE shops (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                "INSERT INTO shops (id, name, created_at, updated_at) VALUES "
                "(7, 'Legacy North', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), "
                "(11, 'Legacy South', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE products (id INTEGER PRIMARY KEY, shop_id INTEGER, stock_quantity INTEGER)"
            )
        )
        connection.execute(
            text("INSERT INTO products (id, shop_id, stock_quantity) VALUES (3, 7, 19)")
        )

        migration = _load_migration(connection)
        migration.upgrade()

        shops = connection.execute(
            text(
                "SELECT id, organization_id, is_default_branch FROM shops ORDER BY id"
            )
        ).all()
        organizations = connection.execute(
            text("SELECT id, name FROM organizations ORDER BY id")
        ).all()

        assert shops == [(7, 7, 1), (11, 11, 1)]
        assert organizations == [(7, "Legacy North"), (11, "Legacy South")]
        assert connection.execute(text("SELECT stock_quantity FROM products WHERE id = 3")).scalar_one() == 19

        migration.upgrade()
        assert connection.execute(text("SELECT COUNT(*) FROM organizations")).scalar_one() == 2
        assert connection.execute(text("SELECT COUNT(*) FROM shops")).scalar_one() == 2

    engine.dispose()


def test_shop_fixture_has_one_default_organization(make_shop, db_session):
    shop = make_shop("Mapped Shop")

    assert shop.organization_id is not None
    assert shop.is_default_branch is True
    assert shop.organization.name == "Mapped Shop"
    assert db_session.query(Organization).count() == 1
    assert db_session.query(Shop).filter_by(organization_id=shop.organization_id).count() == 1


def test_organization_cannot_have_two_default_branches(make_shop, db_session):
    default_shop = make_shop("Default Shop")
    db_session.add(
        Shop(
            organization_id=default_shop.organization_id,
            is_default_branch=True,
            name="Second Default",
            category="Grocery",
            email="second-default@example.com",
            phone="9876500099",
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_registration_creates_organization_default_shop_and_commercial_records(
    client, db_session
):
    response = client.post(
        "/api/v1/auth/register",
        data={
            "shop_name": "Foundation Retail",
            "owner_name": "Foundation Owner",
            "email": "foundation@example.com",
            "category": "Retail",
            "phone": "9876500001",
            "password": "CorrectHorse123!",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    shop = db_session.query(Shop).filter_by(id=body["shop_id"]).one()
    organization = db_session.query(Organization).filter_by(id=body["organization_id"]).one()
    assert shop.organization_id == organization.id
    assert shop.is_default_branch is True
    assert organization.name == shop.name == "Foundation Retail"
    assert body["organization_name"] == organization.name
    assert db_session.query(ShopSubscription).filter_by(shop_id=shop.id).count() == 1
    assert db_session.query(ShopLicense).join(ShopSubscription).filter(ShopSubscription.shop_id == shop.id).count() == 1


def test_registration_rolls_back_organization_shop_and_user(monkeypatch, db_session):
    def fail_subscription(*, db, shop_id):
        raise RuntimeError("simulated entitlement failure")

    monkeypatch.setattr(
        "app.services.auth_service.ensure_legacy_subscription_for_shop",
        fail_subscription,
    )

    with pytest.raises(RuntimeError, match="simulated entitlement failure"):
        register_shop_owner(
            shop_name="Rollback Retail",
            owner_name="Rollback Owner",
            email="rollback@example.com",
            category="Retail",
            phone="9876500002",
            whatsapp_number=None,
            shop_address=None,
            password="CorrectHorse123!",
            logo_url=None,
            db=db_session,
        )

    assert db_session.query(Organization).count() == 0
    assert db_session.query(Shop).count() == 0
    assert db_session.query(User).count() == 0


def test_existing_user_resolves_organization_without_changing_shop_context(
    client, make_user, auth_headers
):
    user = make_user(email="organization-context@example.com")
    response = client.get("/api/v1/auth/me", headers=auth_headers(user.email))

    assert response.status_code == 200
    body = response.json()
    assert body["shop_id"] == user.shop_id
    assert body["organization_id"] == user.shop.organization_id
    assert body["organization_name"] == user.shop.organization.name


def test_existing_shop_isolation_and_operational_routes_remain_shop_scoped(
    client, make_user, auth_headers
):
    owner = make_user(email="foundation-owner@example.com")
    other = make_user(email="foundation-other@example.com")
    headers = auth_headers(owner.email)

    assert client.get(f"/api/v1/shops/{owner.shop_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/shops/{other.shop_id}", headers=headers).status_code == 403
    assert client.get("/api/v1/invoices", headers=headers).status_code == 200
    assert client.get("/api/v1/inventory/summary", headers=headers).status_code == 200
    assert client.get("/api/v1/purchase-orders", headers=headers).status_code == 200


def test_super_admin_auth_context_remains_shopless(client, make_user, auth_headers, db_session):
    admin = make_user(email="foundation-admin@example.com", role="super_admin")
    admin.shop_id = None
    db_session.commit()

    response = client.get("/api/v1/auth/me", headers=auth_headers(admin.email))

    assert response.status_code == 200
    assert response.json()["shop_id"] is None
    assert response.json()["organization_id"] is None


def test_stock_reconciliation_is_unchanged_by_organization_foundation(
    db_session, make_user
):
    user = make_user(email="foundation-stock@example.com")
    create_product(
        ProductCreate(
            name="Foundation Stock",
            sku="ORG-STOCK",
            category="General",
            buying_price=Decimal("10.00"),
            mrp=Decimal("20.00"),
            selling_price=Decimal("20.00"),
            stock_quantity=9,
            low_stock_threshold=1,
            unit="pcs",
        ),
        user,
        db_session,
    )

    result = reconcile_stock_balances(db_session, shop_id=user.shop_id)
    assert result["mismatch_count"] == 0
    assert db_session.query(Product).filter_by(shop_id=user.shop_id).one().stock_quantity == 9
