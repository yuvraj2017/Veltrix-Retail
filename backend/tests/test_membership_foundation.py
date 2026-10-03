import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError

from app.core.membership import (
    MembershipRole,
    MembershipStatus,
    normalize_membership_role,
    normalize_membership_status,
)
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.stock_movement import StockMovement
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.services.auth_service import register_shop_owner


def _load_migration(connection):
    path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "20261003_0019_membership_foundation.py"
    )
    spec = importlib.util.spec_from_file_location("phase4c_membership_migration", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(connection))
    return module


def _migration_engine():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def _create_0018_membership_source(connection, *, user_role="owner", shop_id=7):
    connection.execute(
        text(
            """
            CREATE TABLE organizations (
                id INTEGER PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                status VARCHAR(20) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE TABLE shops (
                id INTEGER PRIMARY KEY,
                organization_id INTEGER NOT NULL,
                is_default_branch BOOLEAN NOT NULL,
                name VARCHAR(150) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                shop_id INTEGER,
                role VARCHAR(50) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (shop_id) REFERENCES shops(id)
            )
            """
        )
    )
    connection.execute(
        text(
            "INSERT INTO organizations VALUES "
            "(7, 'Legacy Retail', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
    )
    connection.execute(
        text(
            "INSERT INTO shops VALUES "
            "(7, 7, 1, 'Legacy Retail', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
    )
    connection.execute(
        text(
            "INSERT INTO users VALUES "
            "(3, :shop_id, :role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), "
            "(4, NULL, 'super_admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {"shop_id": shop_id, "role": user_role},
    )


def _add_membership(db_session, *, user, shop, role=MembershipRole.OWNER):
    membership = OrganizationMembership(
        organization_id=shop.organization_id,
        user_id=user.id,
        role=role,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)
    db_session.flush()
    return membership


def test_membership_vocabulary_fails_closed():
    assert normalize_membership_role(" OWNER ") == MembershipRole.OWNER
    assert normalize_membership_status(" ACTIVE ") == MembershipStatus.ACTIVE
    with pytest.raises(ValueError, match="Unsupported organization membership role"):
        normalize_membership_role("super_admin")
    with pytest.raises(ValueError, match="Unsupported organization membership role"):
        normalize_membership_role("unexpected")
    with pytest.raises(ValueError, match="Unsupported membership status"):
        normalize_membership_status("pending")


def test_organization_membership_is_unique_per_user_and_organization(
    db_session, make_user
):
    user = make_user(email="membership-unique@example.com")
    _add_membership(db_session, user=user, shop=user.shop)
    db_session.add(
        OrganizationMembership(
            organization_id=user.shop.organization_id,
            user_id=user.id,
            role=MembershipRole.ADMIN,
            status=MembershipStatus.ACTIVE,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_branch_membership_is_unique(db_session, make_user):
    user = make_user(email="branch-unique@example.com")
    membership = _add_membership(db_session, user=user, shop=user.shop)
    for _ in range(2):
        db_session.add(
            BranchMembership(
                organization_membership_id=membership.id,
                organization_id=user.shop.organization_id,
                shop_id=user.shop_id,
                status=MembershipStatus.ACTIVE,
            )
        )
    with pytest.raises(IntegrityError):
        db_session.commit()


@pytest.mark.parametrize(
    ("role", "status"),
    [("super_admin", MembershipStatus.ACTIVE), (MembershipRole.OWNER, "pending")],
)
def test_membership_database_checks_reject_invalid_values(
    db_session, make_user, role, status
):
    user = make_user(email=f"invalid-{role}-{status}@example.com")
    db_session.add(
        OrganizationMembership(
            organization_id=user.shop.organization_id,
            user_id=user.id,
            role=role,
            status=status,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_cross_organization_branch_membership_is_rejected(
    db_session, make_user, make_shop
):
    user = make_user(email="cross-organization@example.com")
    other_shop = make_shop("Other Organization")
    membership = _add_membership(db_session, user=user, shop=user.shop)
    db_session.add(
        BranchMembership(
            organization_membership_id=membership.id,
            organization_id=user.shop.organization_id,
            shop_id=other_shop.id,
            status=MembershipStatus.ACTIVE,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_migration_backfills_owner_and_excludes_super_admin():
    engine = _migration_engine()
    with engine.begin() as connection:
        _create_0018_membership_source(connection)
        migration = _load_migration(connection)
        migration.upgrade()

        organization_memberships = connection.execute(
            text(
                "SELECT organization_id, user_id, role, status, created_by_user_id "
                "FROM organization_memberships"
            )
        ).all()
        branch_memberships = connection.execute(
            text(
                "SELECT organization_id, shop_id, status, created_by_user_id "
                "FROM branch_memberships"
            )
        ).all()
        users = connection.execute(
            text("SELECT id, shop_id, role FROM users ORDER BY id")
        ).all()

        assert organization_memberships == [(7, 3, "owner", "active", None)]
        assert branch_memberships == [(7, 7, "active", None)]
        assert users == [(3, 7, "owner"), (4, None, "super_admin")]
    engine.dispose()


def test_migration_rejects_unsupported_legacy_role():
    engine = _migration_engine()
    with pytest.raises(RuntimeError, match="Unsupported user membership backfill mapping"):
        with engine.begin() as connection:
            _create_0018_membership_source(connection, user_role="cashier")
            migration = _load_migration(connection)
            migration.upgrade()
    engine.dispose()


def test_registration_creates_owner_and_default_branch_memberships(
    client, db_session
):
    response = client.post(
        "/api/v1/auth/register",
        data={
            "shop_name": "Membership Retail",
            "owner_name": "Membership Owner",
            "email": "membership-registration@example.com",
            "category": "Retail",
            "phone": "9876500101",
            "password": "CorrectHorse123!",
        },
    )
    assert response.status_code == 201, response.text
    user = db_session.query(User).filter_by(id=response.json()["user_id"]).one()
    membership = db_session.query(OrganizationMembership).filter_by(user_id=user.id).one()
    branch = db_session.query(BranchMembership).filter_by(
        organization_membership_id=membership.id
    ).one()

    assert membership.organization_id == response.json()["organization_id"]
    assert membership.role == MembershipRole.OWNER
    assert membership.status == MembershipStatus.ACTIVE
    assert membership.created_by_user_id is None
    assert branch.organization_id == membership.organization_id
    assert branch.shop_id == user.shop_id == response.json()["shop_id"]
    assert branch.status == MembershipStatus.ACTIVE
    assert branch.created_by_user_id is None
    assert db_session.query(ShopSubscription).filter_by(shop_id=user.shop_id).count() == 1
    assert (
        db_session.query(ShopLicense)
        .join(ShopSubscription)
        .filter(ShopSubscription.shop_id == user.shop_id)
        .count()
        == 1
    )


def test_registration_membership_failure_rolls_back_everything(
    monkeypatch, db_session
):
    def fail_memberships(*args, **kwargs):
        raise RuntimeError("simulated membership failure")

    monkeypatch.setattr(
        "app.services.auth_service.create_registration_memberships",
        fail_memberships,
    )

    with pytest.raises(RuntimeError, match="simulated membership failure"):
        register_shop_owner(
            shop_name="Rollback Membership Retail",
            owner_name="Rollback Owner",
            email="membership-rollback@example.com",
            category="Retail",
            phone="9876500102",
            whatsapp_number=None,
            shop_address=None,
            password="CorrectHorse123!",
            logo_url=None,
            db=db_session,
        )

    assert db_session.query(Organization).count() == 0
    assert db_session.query(Shop).count() == 0
    assert db_session.query(User).count() == 0
    assert db_session.query(OrganizationMembership).count() == 0
    assert db_session.query(BranchMembership).count() == 0
    assert db_session.query(ShopSubscription).count() == 0
    assert db_session.query(ShopLicense).count() == 0


def test_existing_shop_authorization_remains_compatible_without_membership(
    client, make_user, auth_headers, db_session
):
    user = make_user(email="legacy-auth-compatible@example.com")
    assert db_session.query(OrganizationMembership).filter_by(user_id=user.id).count() == 0
    response = client.get("/api/v1/inventory/summary", headers=auth_headers(user.email))
    assert response.status_code == 200


def test_registration_memberships_do_not_change_stock(db_session):
    before_movements = db_session.query(StockMovement).count()
    register_shop_owner(
        shop_name="No Stock Membership Retail",
        owner_name="No Stock Owner",
        email="membership-no-stock@example.com",
        category="Retail",
        phone="9876500103",
        whatsapp_number=None,
        shop_address=None,
        password="CorrectHorse123!",
        logo_url=None,
        db=db_session,
    )
    assert db_session.query(StockMovement).count() == before_movements
