"""Registration and login enforcement.

These are the tests that matter most: they prove the approval gate lives on the
backend, not in the UI.
"""

from app.core.user_status import UserStatus
from app.models.admin_audit_log import AdminAuditLog, AuditAction
from app.models.user import User

REGISTRATION_FORM = {
    "shop_name": "New Corner Store",
    "owner_name": "Asha Patel",
    "email": "asha@example.com",
    "category": "Grocery",
    "phone": "9876543210",
    "password": "CorrectHorse123!",
}


def test_registration_creates_pending_account(client, db_session):
    response = client.post("/api/v1/auth/register", data=REGISTRATION_FORM)

    assert response.status_code == 201, response.text
    body = response.json()

    assert body["status"] == UserStatus.PENDING
    assert "approval" in body["message"].lower()

    # No credential is handed out for an account that cannot yet sign in.
    assert "access_token" not in body

    user = db_session.query(User).filter(User.email == "asha@example.com").one()
    assert user.status == UserStatus.PENDING
    assert user.is_active is False


def test_registration_is_audited(client, db_session):
    client.post("/api/v1/auth/register", data=REGISTRATION_FORM)

    entry = (
        db_session.query(AdminAuditLog)
        .filter(AdminAuditLog.action == AuditAction.USER_REGISTERED)
        .one()
    )
    assert entry.target_email == "asha@example.com"
    assert entry.new_value == UserStatus.PENDING


def test_pending_user_cannot_login(client, login):
    client.post("/api/v1/auth/register", data=REGISTRATION_FORM)

    response = login("asha@example.com")

    assert response.status_code == 403
    assert "awaiting approval" in response.json()["detail"].lower()


def test_rejected_user_cannot_login(make_user, login):
    make_user(email="rejected@example.com", status=UserStatus.REJECTED)

    response = login("rejected@example.com")

    assert response.status_code == 403


def test_suspended_user_cannot_login(make_user, login):
    make_user(email="suspended@example.com", status=UserStatus.SUSPENDED)

    response = login("suspended@example.com")

    assert response.status_code == 403
    assert "suspended" in response.json()["detail"].lower()


def test_disabled_user_cannot_login(make_user, login):
    make_user(email="disabled@example.com", status=UserStatus.DISABLED)

    response = login("disabled@example.com")

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


def test_active_user_can_login(make_user, login):
    make_user(email="active@example.com", status=UserStatus.ACTIVE)

    response = login("active@example.com")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access_token"]
    assert body["status"] == UserStatus.ACTIVE
    assert body["role"] == "owner"


def test_login_records_last_login_at(make_user, login, db_session):
    user = make_user(email="stamped@example.com")
    assert user.last_login_at is None

    assert login("stamped@example.com").status_code == 200

    db_session.refresh(user)
    assert user.last_login_at is not None


def test_wrong_password_does_not_disclose_account_status(make_user, login):
    """Password is checked before status.

    A suspended account and an active one must both answer 401 for a bad
    password, so the endpoint cannot be used to probe account states without
    already knowing the credentials.
    """
    make_user(email="quiet@example.com", status=UserStatus.SUSPENDED)

    response = login("quiet@example.com", password="WrongPassword123!")

    assert response.status_code == 401
    detail = response.json()["detail"].lower()
    assert "suspend" not in detail
    assert "pending" not in detail


def test_unknown_status_value_is_treated_as_active():
    """Defensive normalisation for rows this feature did not write.

    `status` is NOT NULL with a server default, so production rows always carry
    a value -- but a value written by hand through SQL should not lock an
    account out silently. Anything unrecognised reads as ACTIVE, matching the
    pre-migration behaviour where only `is_active` gated access.
    """
    from app.core.user_status import UserStatus, can_login, normalize_status

    assert normalize_status(None) == UserStatus.ACTIVE
    assert normalize_status("") == UserStatus.ACTIVE
    assert normalize_status("nonsense") == UserStatus.ACTIVE
    assert can_login(None) is True

    # Casing and stray whitespace from hand-written SQL still resolve.
    assert normalize_status("  SUSPENDED ") == UserStatus.SUSPENDED
    assert can_login("  SUSPENDED ") is False


def test_legacy_is_active_false_still_blocks_login(make_user, login, db_session):
    """The legacy mirror is honoured even if it diverges from `status`.

    Someone deactivating an account with a hand-written UPDATE on `is_active`
    alone must still lock it, which is why both fields are checked at login.
    """
    user = make_user(email="legacy@example.com")
    user.is_active = False
    db_session.commit()

    response = login("legacy@example.com")

    assert response.status_code == 403
