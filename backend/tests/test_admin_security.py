"""Authorisation and privilege-escalation tests.

These assert the security boundary is the backend. Every admin route is
exercised with a regular user's real token, with no token at all, and with a
garbage token.
"""

import pytest

from app.core.user_status import UserRole, UserStatus

# Every admin route, as (method, path template).
ADMIN_ROUTES = [
    ("get", "/api/v1/admin/stats"),
    ("get", "/api/v1/admin/users"),
    ("get", "/api/v1/admin/users/{uid}"),
    ("post", "/api/v1/admin/users/{uid}/approve"),
    ("post", "/api/v1/admin/users/{uid}/reject"),
    ("post", "/api/v1/admin/users/{uid}/suspend"),
    ("post", "/api/v1/admin/users/{uid}/reactivate"),
    ("post", "/api/v1/admin/users/{uid}/disable"),
    ("get", "/api/v1/admin/audit-logs"),
]


def _call(client, method: str, path: str, **kwargs):
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_regular_user_is_refused_on_every_admin_route(
    client, make_user, auth_headers, method, path
):
    """A regular user with a perfectly valid token gets 403 everywhere."""
    target = make_user(email="target@example.com", status=UserStatus.PENDING)
    make_user(email="regular@example.com", status=UserStatus.ACTIVE)
    headers = auth_headers("regular@example.com")

    response = _call(client, method, path.format(uid=target.id), headers=headers)

    assert response.status_code == 403, f"{method.upper()} {path} -> {response.status_code}"


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_unauthenticated_requests_are_refused(client, method, path):
    response = _call(client, method, path.format(uid=1))

    assert response.status_code in (401, 403)


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_garbage_token_is_refused(client, method, path):
    response = _call(
        client,
        method,
        path.format(uid=1),
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )

    assert response.status_code == 401


def test_role_change_route_is_refused_for_regular_user(
    client, make_user, auth_headers
):
    target = make_user(email="victim@example.com", status=UserStatus.ACTIVE)
    make_user(email="attacker@example.com", status=UserStatus.ACTIVE)

    response = client.patch(
        f"/api/v1/admin/users/{target.id}/role",
        headers=auth_headers("attacker@example.com"),
        json={"role": UserRole.SUPER_ADMIN},
    )

    assert response.status_code == 403


def test_user_cannot_promote_themselves(client, make_user, auth_headers, db_session):
    """The headline escalation case: a regular user targeting their own id."""
    attacker = make_user(email="selfpromote@example.com", status=UserStatus.ACTIVE)

    response = client.patch(
        f"/api/v1/admin/users/{attacker.id}/role",
        headers=auth_headers("selfpromote@example.com"),
        json={"role": UserRole.SUPER_ADMIN},
    )

    assert response.status_code == 403
    db_session.refresh(attacker)
    assert attacker.role == UserRole.OWNER


def test_super_admin_cannot_change_their_own_role(
    client, super_admin, admin_headers, db_session
):
    response = client.patch(
        f"/api/v1/admin/users/{super_admin.id}/role",
        headers=admin_headers,
        json={"role": UserRole.OWNER},
    )

    assert response.status_code == 403
    db_session.refresh(super_admin)
    assert super_admin.role == UserRole.SUPER_ADMIN


def test_super_admin_cannot_suspend_themselves(
    client, super_admin, admin_headers, db_session
):
    """Lock-out protection."""
    response = client.post(
        f"/api/v1/admin/users/{super_admin.id}/suspend", headers=admin_headers
    )

    assert response.status_code == 403
    db_session.refresh(super_admin)
    assert super_admin.status == UserStatus.ACTIVE


def test_last_super_admin_cannot_be_disabled(
    client, make_user, auth_headers, super_admin, db_session
):
    """Two admins: one may act on the other, but not down to zero."""
    second = make_user(
        email="admin2@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
    )
    second_headers = auth_headers("admin2@example.com")

    # Two exist, so removing one is fine.
    assert client.post(
        f"/api/v1/admin/users/{super_admin.id}/disable", headers=second_headers
    ).status_code == 200

    # Now only `second` remains. It cannot remove itself (self-guard), and the
    # disabled one cannot act at all.
    assert client.post(
        f"/api/v1/admin/users/{second.id}/disable", headers=second_headers
    ).status_code == 403

    db_session.refresh(second)
    assert second.status == UserStatus.ACTIVE


def test_last_super_admin_cannot_be_demoted(client, make_user, auth_headers):
    second = make_user(
        email="admin3@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
    )
    # `second` demoting the original leaves `second` as the only admin, which is
    # allowed; demoting itself afterwards is blocked by the self-guard.
    headers = auth_headers("admin3@example.com")
    assert client.patch(
        f"/api/v1/admin/users/{second.id}/role",
        headers=headers,
        json={"role": UserRole.OWNER},
    ).status_code == 403


def test_suspension_invalidates_an_already_issued_token(
    client, admin_headers, make_user, auth_headers
):
    """The session-invalidation requirement.

    The victim holds a valid, unexpired JWT. After suspension that same token
    stops working on the very next request -- because get_current_user re-reads
    the account row every time.
    """
    victim = make_user(email="victim2@example.com", status=UserStatus.ACTIVE)
    victim_headers = auth_headers("victim2@example.com")

    assert client.get("/api/v1/auth/me", headers=victim_headers).status_code == 200

    client.post(f"/api/v1/admin/users/{victim.id}/suspend", headers=admin_headers)

    response = client.get("/api/v1/auth/me", headers=victim_headers)
    assert response.status_code == 403
    # Carries the marker the frontend interceptor uses to clear the session.
    assert "account_inactive" in response.json()["detail"]


def test_suspension_blocks_ordinary_application_routes_too(
    client, admin_headers, make_user, auth_headers
):
    """Not just /me -- the whole authenticated surface closes."""
    victim = make_user(email="victim3@example.com", status=UserStatus.ACTIVE)
    victim_headers = auth_headers("victim3@example.com")

    assert client.get("/api/v1/products", headers=victim_headers).status_code == 200

    client.post(f"/api/v1/admin/users/{victim.id}/suspend", headers=admin_headers)

    for path in (
        "/api/v1/products",
        "/api/v1/dashboard/overview",
        "/api/v1/invoices",
        "/api/v1/expenses",
        "/api/v1/reports/summary",
    ):
        assert client.get(path, headers=victim_headers).status_code == 403, path


def test_audit_log_is_itself_protected(client, make_user, auth_headers):
    make_user(email="nosy@example.com", status=UserStatus.ACTIVE)

    assert client.get(
        "/api/v1/admin/audit-logs", headers=auth_headers("nosy@example.com")
    ).status_code == 403


def test_regular_user_keeps_normal_access(client, make_user, auth_headers):
    """Regression guard: adding RBAC must not break ordinary users."""
    make_user(email="normal@example.com", status=UserStatus.ACTIVE)
    headers = auth_headers("normal@example.com")

    for path in (
        "/api/v1/auth/me",
        "/api/v1/products",
        "/api/v1/products/stats",
        "/api/v1/dashboard/overview",
        "/api/v1/invoices",
        "/api/v1/invoices/stats",
        "/api/v1/customers",
        "/api/v1/expenses",
        "/api/v1/vendors",
        "/api/v1/reports/summary",
        "/api/v1/profile/me",
    ):
        assert client.get(path, headers=headers).status_code == 200, path


def test_tenant_isolation_is_unchanged_for_regular_users(
    client, make_user, auth_headers, db_session
):
    """Admin routes are cross-shop; ordinary routes must still be shop-scoped."""
    from app.models.product import Product

    owner_a = make_user(email="shopa@example.com", status=UserStatus.ACTIVE)
    owner_b = make_user(email="shopb@example.com", status=UserStatus.ACTIVE)

    db_session.add(
        Product(
            shop_id=owner_b.shop_id,
            name="Shop B Only",
            sku="B-001",
            category="Grocery",
        )
    )
    db_session.commit()

    body = client.get(
        "/api/v1/products", headers=auth_headers("shopa@example.com")
    ).json()

    assert body["total"] == 0
    assert owner_a.shop_id != owner_b.shop_id


def test_suspended_super_admin_loses_admin_access(
    client, make_user, auth_headers, super_admin, admin_headers
):
    """Role alone is not enough -- the account must also be ACTIVE.

    require_super_admin depends on get_current_user, so the status check runs
    before the role check and a suspended administrator is refused.
    """
    second = make_user(
        email="admin4@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
    )
    second_headers = auth_headers("admin4@example.com")

    assert client.get("/api/v1/admin/stats", headers=second_headers).status_code == 200

    # The original admin suspends the second one.
    assert client.post(
        f"/api/v1/admin/users/{second.id}/suspend", headers=admin_headers
    ).status_code == 200

    response = client.get("/api/v1/admin/stats", headers=second_headers)
    assert response.status_code == 403
    assert "account_inactive" in response.json()["detail"]


def test_demotion_revokes_admin_access_immediately(
    client, make_user, auth_headers, admin_headers
):
    """A demoted administrator's existing token stops working on the next call."""
    second = make_user(
        email="admin5@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
    )
    second_headers = auth_headers("admin5@example.com")

    assert client.get("/api/v1/admin/stats", headers=second_headers).status_code == 200

    assert client.patch(
        f"/api/v1/admin/users/{second.id}/role",
        headers=admin_headers,
        json={"role": UserRole.OWNER},
    ).status_code == 200

    # Same token, no re-login: the role is re-read from the database.
    assert client.get("/api/v1/admin/stats", headers=second_headers).status_code == 403
