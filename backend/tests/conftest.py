"""Test fixtures.

The suite runs against a throwaway in-memory SQLite database via a dependency
override, so it never touches the real Postgres instance. Nothing here reads
DATABASE_URL.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Settings are required before app import; supply throwaway values so the suite
# does not depend on a populated .env.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-anywhere-real")

from app.api.deps import get_db  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.core.security import hash_password, pwd_context  # noqa: E402
from app.core.user_status import UserRole, UserStatus  # noqa: E402
from app.main import app  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.models.shop import Shop  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.subscription_service import ensure_legacy_subscription_for_shop  # noqa: E402


# Production bcrypt cost is deliberately expensive. The suite hashes a password
# for nearly every fixture, so the cost is dialled down here -- and ONLY here --
# to keep the run fast. app/core/security.py is untouched.
pwd_context.update(bcrypt__rounds=4)


@pytest.fixture()
def db_session():
    # StaticPool + a single shared connection keeps one in-memory database
    # visible to both the test body and the request handlers.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignores foreign keys unless asked; the audit table's ON DELETE
    # SET NULL behaviour should be exercised as it would be in Postgres.
    @event.listens_for(engine, "connect")
    def _fk_pragma(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """TestClient wired to the test database.

    Schema here comes from Base.metadata.create_all so the suite stays isolated
    from the real database configured by DATABASE_URL.
    """

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    # Constructed WITHOUT the context manager on purpose: schema for the suite
    # comes from Base.metadata.create_all in db_session instead.
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def make_shop(db_session):
    counter = {"n": 0}

    def _make(name: str | None = None) -> Shop:
        counter["n"] += 1
        index = counter["n"]
        organization = Organization(
            name=name or f"Test Shop {index}",
            status="active",
        )
        db_session.add(organization)
        db_session.flush()
        shop = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            name=name or f"Test Shop {index}",
            category="Grocery",
            email=f"shop{index}@example.com",
            phone=f"90000000{index:02d}",
        )
        db_session.add(shop)
        db_session.commit()
        db_session.refresh(shop)
        return shop

    return _make


@pytest.fixture()
def make_user(db_session, make_shop):
    """Create a user directly, bypassing registration.

    Used to set up accounts in states that registration cannot produce
    (already ACTIVE, already SUSPENDED, super admin, and so on).
    """
    counter = {"n": 0}

    def _make(
        email: str | None = None,
        *,
        password: str = "CorrectHorse123!",
        status: str = UserStatus.ACTIVE,
        role: str = UserRole.OWNER,
        full_name: str = "Test User",
        shop: Shop | None = None,
    ) -> User:
        counter["n"] += 1
        user = User(
            shop_id=(shop or make_shop()).id,
            full_name=full_name,
            email=email or f"user{counter['n']}@example.com",
            password_hash=hash_password(password),
            role=role,
            status=status,
            is_active=status == UserStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.flush()
        if user.shop_id is not None:
            ensure_legacy_subscription_for_shop(db=db_session, shop_id=user.shop_id)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture()
def login(client):
    def _login(email: str, password: str = "CorrectHorse123!"):
        return client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )

    return _login


@pytest.fixture()
def auth_headers(login):
    """Real bearer headers obtained through the login endpoint."""

    def _headers(email: str, password: str = "CorrectHorse123!") -> dict[str, str]:
        response = login(email, password)
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _headers


@pytest.fixture()
def super_admin(make_user):
    return make_user(
        email="admin@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        full_name="Platform Admin",
    )


@pytest.fixture()
def admin_headers(super_admin, auth_headers):
    return auth_headers(super_admin.email)
