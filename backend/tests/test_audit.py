"""Audit trail: every administrative action leaves exactly one correct record."""

from app.core.user_status import UserRole, UserStatus
from app.models.admin_audit_log import AdminAuditLog, AuditAction


def _entries(db_session, action: str):
    return (
        db_session.query(AdminAuditLog).filter(AdminAuditLog.action == action).all()
    )


def test_approve_writes_one_entry_with_both_values(
    client, admin_headers, super_admin, make_user, db_session
):
    user = make_user(email="audited@example.com", status=UserStatus.PENDING)

    client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)

    entries = _entries(db_session, AuditAction.USER_APPROVED)
    assert len(entries) == 1

    entry = entries[0]
    assert entry.actor_user_id == super_admin.id
    assert entry.actor_email == super_admin.email
    assert entry.target_user_id == user.id
    assert entry.target_email == user.email
    assert entry.previous_value == UserStatus.PENDING
    assert entry.new_value == UserStatus.ACTIVE
    assert entry.created_at is not None


def test_reject_records_the_reason(client, admin_headers, make_user, db_session):
    user = make_user(email="why@example.com", status=UserStatus.PENDING)

    client.post(
        f"/api/v1/admin/users/{user.id}/reject",
        headers=admin_headers,
        json={"reason": "Not a genuine retail business"},
    )

    entry = _entries(db_session, AuditAction.USER_REJECTED)[0]
    assert entry.reason == "Not a genuine retail business"


def test_approve_and_reactivate_are_distinct_actions(
    client, admin_headers, make_user, db_session
):
    """Both land on ACTIVE but they are different events."""
    approved = make_user(email="app@example.com", status=UserStatus.PENDING)
    suspended = make_user(email="sus@example.com", status=UserStatus.SUSPENDED)

    client.post(f"/api/v1/admin/users/{approved.id}/approve", headers=admin_headers)
    client.post(
        f"/api/v1/admin/users/{suspended.id}/reactivate", headers=admin_headers
    )

    assert len(_entries(db_session, AuditAction.USER_APPROVED)) == 1
    assert len(_entries(db_session, AuditAction.USER_REACTIVATED)) == 1


def test_every_action_type_is_recorded(client, admin_headers, make_user, db_session):
    pending = make_user(email="a@example.com", status=UserStatus.PENDING)
    to_reject = make_user(email="b@example.com", status=UserStatus.PENDING)
    to_suspend = make_user(email="c@example.com", status=UserStatus.ACTIVE)
    to_disable = make_user(email="d@example.com", status=UserStatus.ACTIVE)
    to_promote = make_user(email="e@example.com", status=UserStatus.ACTIVE)

    client.post(f"/api/v1/admin/users/{pending.id}/approve", headers=admin_headers)
    client.post(f"/api/v1/admin/users/{to_reject.id}/reject", headers=admin_headers)
    client.post(f"/api/v1/admin/users/{to_suspend.id}/suspend", headers=admin_headers)
    client.post(
        f"/api/v1/admin/users/{to_suspend.id}/reactivate", headers=admin_headers
    )
    client.post(f"/api/v1/admin/users/{to_disable.id}/disable", headers=admin_headers)
    client.patch(
        f"/api/v1/admin/users/{to_promote.id}/role",
        headers=admin_headers,
        json={"role": UserRole.SUPER_ADMIN},
    )

    for action in (
        AuditAction.USER_APPROVED,
        AuditAction.USER_REJECTED,
        AuditAction.USER_SUSPENDED,
        AuditAction.USER_REACTIVATED,
        AuditAction.USER_DISABLED,
        AuditAction.ROLE_CHANGED,
    ):
        assert len(_entries(db_session, action)) == 1, action


def test_role_change_records_both_roles(client, admin_headers, make_user, db_session):
    user = make_user(email="rolechange@example.com", status=UserStatus.ACTIVE)

    client.patch(
        f"/api/v1/admin/users/{user.id}/role",
        headers=admin_headers,
        json={"role": UserRole.SUPER_ADMIN},
    )

    entry = _entries(db_session, AuditAction.ROLE_CHANGED)[0]
    assert entry.previous_value == UserRole.OWNER
    assert entry.new_value == UserRole.SUPER_ADMIN


def test_refused_action_writes_no_audit_record(
    client, admin_headers, make_user, db_session
):
    """A rejected transition must not leave a misleading trace."""
    user = make_user(email="noop@example.com", status=UserStatus.ACTIVE)

    assert client.post(
        f"/api/v1/admin/users/{user.id}/reject", headers=admin_headers
    ).status_code == 409

    assert _entries(db_session, AuditAction.USER_REJECTED) == []


def test_audit_records_carry_no_credential_material(
    client, admin_headers, make_user, db_session
):
    user = make_user(email="clean@example.com", status=UserStatus.PENDING)
    client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)

    entry = _entries(db_session, AuditAction.USER_APPROVED)[0]
    serialised = " ".join(
        str(getattr(entry, column.name)) for column in entry.__table__.columns
    ).lower()

    assert "$2b$" not in serialised          # no bcrypt hash
    assert "bearer" not in serialised
    assert "eyj" not in serialised           # no JWT
    assert "correcthorse" not in serialised  # no plaintext password


def test_audit_log_endpoint_paginates_newest_first(
    client, admin_headers, make_user
):
    for index in range(5):
        user = make_user(email=f"seq{index}@example.com", status=UserStatus.PENDING)
        client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)

    body = client.get(
        "/api/v1/admin/audit-logs?page=1&page_size=3", headers=admin_headers
    ).json()

    assert body["total"] == 5
    assert len(body["items"]) == 3
    timestamps = [item["created_at"] for item in body["items"]]
    assert timestamps == sorted(timestamps, reverse=True)


def test_audit_log_filters(client, admin_headers, make_user):
    approved = make_user(email="f1@example.com", status=UserStatus.PENDING)
    rejected = make_user(email="f2@example.com", status=UserStatus.PENDING)

    client.post(f"/api/v1/admin/users/{approved.id}/approve", headers=admin_headers)
    client.post(f"/api/v1/admin/users/{rejected.id}/reject", headers=admin_headers)

    by_action = client.get(
        f"/api/v1/admin/audit-logs?action={AuditAction.USER_APPROVED}",
        headers=admin_headers,
    ).json()
    assert by_action["total"] == 1

    by_target = client.get(
        f"/api/v1/admin/audit-logs?target_user_id={rejected.id}",
        headers=admin_headers,
    ).json()
    assert by_target["total"] == 1
    assert by_target["items"][0]["action"] == AuditAction.USER_REJECTED

    assert client.get(
        "/api/v1/admin/audit-logs?action=NOT_AN_ACTION", headers=admin_headers
    ).status_code == 400


def test_user_detail_includes_its_own_audit_trail(
    client, admin_headers, make_user
):
    user = make_user(email="trail@example.com", status=UserStatus.PENDING)

    client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)
    client.post(f"/api/v1/admin/users/{user.id}/suspend", headers=admin_headers)

    body = client.get(f"/api/v1/admin/users/{user.id}", headers=admin_headers).json()

    actions = [entry["action"] for entry in body["audit_trail"]]
    assert actions == [AuditAction.USER_SUSPENDED, AuditAction.USER_APPROVED]


def test_stats_surface_recent_activity(client, admin_headers, make_user):
    user = make_user(email="act@example.com", status=UserStatus.PENDING)
    client.post(f"/api/v1/admin/users/{user.id}/approve", headers=admin_headers)

    body = client.get("/api/v1/admin/stats", headers=admin_headers).json()

    assert body["admin_actions_last_7_days"] >= 1
    assert body["recent_activity"][0]["action"] == AuditAction.USER_APPROVED
