"""Admin API behaviour: reads, state transitions, role changes."""

from app.core.user_status import UserRole, UserStatus


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def test_stats_report_real_counts(client, admin_headers, make_user):
    make_user(email="p1@example.com", status=UserStatus.PENDING)
    make_user(email="p2@example.com", status=UserStatus.PENDING)
    make_user(email="s1@example.com", status=UserStatus.SUSPENDED)
    make_user(email="r1@example.com", status=UserStatus.REJECTED)

    body = client.get("/api/v1/admin/stats", headers=admin_headers).json()

    assert body["total_users"] == 5          # 4 above + the super admin
    assert body["pending_users"] == 2
    assert body["suspended_users"] == 1
    assert body["rejected_users"] == 1
    assert body["active_users"] == 1
    assert body["super_admin_count"] == 1
    # The series always spans the full window, zero-filled.
    assert len(body["recent_registrations"]) == 7


def test_user_list_is_paginated_and_never_leaks_credentials(
    client, admin_headers, make_user
):
    for index in range(5):
        make_user(email=f"bulk{index}@example.com")

    body = client.get(
        "/api/v1/admin/users?page=1&page_size=2", headers=admin_headers
    ).json()

    assert body["total"] == 6
    assert len(body["items"]) == 2
    assert body["page_size"] == 2

    row = body["items"][0]
    for forbidden in ("password", "password_hash", "token", "access_token"):
        assert forbidden not in row


def test_user_list_filters_by_status_and_role(client, admin_headers, make_user):
    make_user(email="pending-a@example.com", status=UserStatus.PENDING)
    make_user(email="pending-b@example.com", status=UserStatus.PENDING)
    make_user(email="active-a@example.com", status=UserStatus.ACTIVE)

    pending = client.get(
        "/api/v1/admin/users?status=pending", headers=admin_headers
    ).json()
    assert pending["total"] == 2
    assert {item["status"] for item in pending["items"]} == {UserStatus.PENDING}

    admins = client.get(
        "/api/v1/admin/users?role=super_admin", headers=admin_headers
    ).json()
    assert admins["total"] == 1


def test_user_list_searches_name_email_and_shop(client, admin_headers, make_user):
    make_user(email="findme@example.com", full_name="Zebra Merchant")

    by_email = client.get(
        "/api/v1/admin/users?search=findme", headers=admin_headers
    ).json()
    assert by_email["total"] == 1

    by_name = client.get(
        "/api/v1/admin/users?search=Zebra", headers=admin_headers
    ).json()
    assert by_name["total"] == 1


def test_invalid_filter_values_are_rejected(client, admin_headers):
    assert client.get(
        "/api/v1/admin/users?status=nonsense", headers=admin_headers
    ).status_code == 400
    assert client.get(
        "/api/v1/admin/users?role=nonsense", headers=admin_headers
    ).status_code == 400


def test_user_detail_exposes_admin_context_but_no_secrets(
    client, admin_headers, make_user
):
    user = make_user(email="detail@example.com", status=UserStatus.PENDING)

    response = client.get(f"/api/v1/admin/users/{user.id}", headers=admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "detail@example.com"
    assert body["shop_name"]
    assert body["allowed_transitions"] == [UserStatus.ACTIVE, UserStatus.REJECTED]
    assert "password_hash" not in body


def test_user_detail_404_for_unknown_id(client, admin_headers):
    assert client.get(
        "/api/v1/admin/users/999999", headers=admin_headers
    ).status_code == 404


# ---------------------------------------------------------------------------
# The core workflow
# ---------------------------------------------------------------------------

def test_approve_then_login_succeeds(client, admin_headers, make_user, login):
    user = make_user(email="approveme@example.com", status=UserStatus.PENDING)

    assert login("approveme@example.com").status_code == 403

    response = client.post(
        f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["status"] == UserStatus.ACTIVE

    assert login("approveme@example.com").status_code == 200


def test_reject_stores_reason_and_blocks_login(
    client, admin_headers, make_user, login, db_session
):
    user = make_user(email="rejectme@example.com", status=UserStatus.PENDING)

    response = client.post(
        f"/api/v1/admin/users/{user.id}/reject",
        headers=admin_headers,
        json={"reason": "Duplicate shop registration"},
    )

    assert response.status_code == 200
    db_session.refresh(user)
    assert user.status == UserStatus.REJECTED
    assert user.status_reason == "Duplicate shop registration"
    assert login("rejectme@example.com").status_code == 403


def test_suspend_then_reactivate_round_trip(
    client, admin_headers, make_user, login, db_session
):
    user = make_user(email="cycle@example.com", status=UserStatus.ACTIVE)

    client.post(
        f"/api/v1/admin/users/{user.id}/suspend",
        headers=admin_headers,
        json={"reason": "Payment dispute"},
    )
    db_session.refresh(user)
    assert user.status == UserStatus.SUSPENDED
    assert login("cycle@example.com").status_code == 403

    client.post(f"/api/v1/admin/users/{user.id}/reactivate", headers=admin_headers)
    db_session.refresh(user)
    assert user.status == UserStatus.ACTIVE
    # Reactivating clears the note that explained the old state.
    assert user.status_reason is None
    assert login("cycle@example.com").status_code == 200


def test_disable_is_terminal(client, admin_headers, make_user, login, db_session):
    user = make_user(email="gone@example.com", status=UserStatus.ACTIVE)

    client.post(
        f"/api/v1/admin/users/{user.id}/disable",
        headers=admin_headers,
        json={"reason": "Account closed at owner request"},
    )
    db_session.refresh(user)
    assert user.status == UserStatus.DISABLED
    assert login("gone@example.com").status_code == 403

    # No route back out of a terminal state.
    assert client.post(
        f"/api/v1/admin/users/{user.id}/reactivate", headers=admin_headers
    ).status_code == 409


def test_is_active_mirror_tracks_status(client, admin_headers, make_user, db_session):
    user = make_user(email="mirror@example.com", status=UserStatus.PENDING)
    assert user.is_active is False

    client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)
    db_session.refresh(user)
    assert user.is_active is True

    client.post(f"/api/v1/admin/users/{user.id}/suspend", headers=admin_headers)
    db_session.refresh(user)
    assert user.is_active is False


# ---------------------------------------------------------------------------
# Invalid transitions
# ---------------------------------------------------------------------------

def test_double_approval_is_rejected(client, admin_headers, make_user):
    user = make_user(email="twice@example.com", status=UserStatus.PENDING)

    first = client.post(
        f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers
    )
    second = client.post(
        f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert "cannot change status" in second.json()["detail"].lower()


def test_cannot_reject_an_active_user(client, admin_headers, make_user):
    user = make_user(email="active2@example.com", status=UserStatus.ACTIVE)

    assert client.post(
        f"/api/v1/admin/users/{user.id}/reject", headers=admin_headers
    ).status_code == 409


def test_cannot_suspend_a_pending_user(client, admin_headers, make_user):
    user = make_user(email="pending3@example.com", status=UserStatus.PENDING)

    assert client.post(
        f"/api/v1/admin/users/{user.id}/suspend", headers=admin_headers
    ).status_code == 409


def test_cannot_reactivate_a_rejected_user(client, admin_headers, make_user):
    user = make_user(email="rejected2@example.com", status=UserStatus.REJECTED)

    assert client.post(
        f"/api/v1/admin/users/{user.id}/reactivate", headers=admin_headers
    ).status_code == 409


def test_suspended_user_can_be_disabled_directly(
    client, admin_headers, make_user, db_session
):
    user = make_user(email="susp2dis@example.com", status=UserStatus.SUSPENDED)

    assert client.post(
        f"/api/v1/admin/users/{user.id}/disable", headers=admin_headers
    ).status_code == 200
    db_session.refresh(user)
    assert user.status == UserStatus.DISABLED


# ---------------------------------------------------------------------------
# Role changes
# ---------------------------------------------------------------------------

def test_promote_and_demote(client, admin_headers, make_user, db_session):
    user = make_user(email="promote@example.com", status=UserStatus.ACTIVE)

    response = client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.SUPER_ADMIN},
    )
    assert response.status_code == 200, response.text
    db_session.refresh(user)
    assert user.role == UserRole.SUPER_ADMIN

    # Now that a second super admin exists, demotion is allowed.
    assert client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.OWNER},
    ).status_code == 200


def test_promoted_user_gains_admin_access(client, admin_headers, make_user, auth_headers):
    user = make_user(email="newadmin@example.com", status=UserStatus.ACTIVE)
    headers = auth_headers("newadmin@example.com")

    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403

    client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.SUPER_ADMIN},
    )

    # The same already-issued token now works: get_current_user re-reads the
    # role from the database on every request.
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 200


def test_cannot_promote_a_non_active_user(client, admin_headers, make_user):
    user = make_user(email="pending4@example.com", status=UserStatus.PENDING)

    response = client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.SUPER_ADMIN},
    )

    assert response.status_code == 409
    assert "active" in response.json()["detail"].lower()


def test_redundant_role_change_is_rejected(client, admin_headers, make_user):
    user = make_user(email="already@example.com", status=UserStatus.ACTIVE)

    assert client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.OWNER},
    ).status_code == 409


def test_unknown_role_is_rejected(client, admin_headers, make_user):
    user = make_user(email="badrole@example.com", status=UserStatus.ACTIVE)

    assert client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": "god_mode"},
    ).status_code == 400
