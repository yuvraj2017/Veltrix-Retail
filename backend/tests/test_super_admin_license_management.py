from datetime import datetime, timedelta, timezone

from app.core.domain_errors import DomainErrorCode
from app.core.subscription_status import LicenseStatus, SubscriptionStatus
from app.models.admin_audit_log import AdminAuditLog, AuditAction
from app.models.commercial_event import LicenseEvent
from app.models.license import ShopLicense
from app.models.subscription import ShopSubscription


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _latest_subscription(db_session, shop_id: int) -> ShopSubscription:
    subscription = (
        db_session.query(ShopSubscription)
        .filter(ShopSubscription.shop_id == shop_id)
        .order_by(ShopSubscription.created_at.desc(), ShopSubscription.id.desc())
        .first()
    )
    assert subscription is not None
    return subscription


def _latest_license(db_session, subscription_id: int) -> ShopLicense:
    license_row = (
        db_session.query(ShopLicense)
        .filter(ShopLicense.subscription_id == subscription_id)
        .order_by(ShopLicense.created_at.desc(), ShopLicense.id.desc())
        .first()
    )
    assert license_row is not None
    return license_row


def _shop_license(db_session, shop_id: int) -> ShopLicense:
    return _latest_license(db_session, _latest_subscription(db_session, shop_id).id)


def _set_subscription(
    db_session,
    shop_id: int,
    *,
    status: str = SubscriptionStatus.ACTIVE,
    current_period_end: datetime | None = None,
    grace_period_days: int = 0,
) -> ShopSubscription:
    subscription = _latest_subscription(db_session, shop_id)
    subscription.status = status
    subscription.current_period_end = current_period_end
    subscription.plan.grace_period_days = grace_period_days
    db_session.commit()
    db_session.refresh(subscription)
    return subscription


def _status_payload(status: str, reason: str = "Phase 1F.1 test reason") -> dict[str, str]:
    return {"status": status, "reason": reason}


def _license_events(db_session, license_id: int) -> int:
    return db_session.query(LicenseEvent).filter(LicenseEvent.license_id == license_id).count()


def _license_audits(db_session, license_id: int) -> int:
    return (
        db_session.query(AdminAuditLog)
        .filter(
            AdminAuditLog.action == AuditAction.LICENSE_CHANGED,
            AdminAuditLog.target_entity_type == "shop_license",
            AdminAuditLog.target_entity_id == license_id,
        )
        .count()
    )


def test_non_super_admin_cannot_mutate_license(
    client,
    db_session,
    make_user,
    auth_headers,
):
    owner = make_user(email="license-owner-denied@example.com")
    license_row = _shop_license(db_session, owner.shop_id)

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=auth_headers(owner.email),
        json=_status_payload(LicenseStatus.SUSPENDED),
    )

    assert response.status_code == 403


def test_super_admin_suspend_license_blocks_tenant_access_and_records_events(
    client,
    db_session,
    make_user,
    admin_headers,
    auth_headers,
):
    owner = make_user(email="license-suspend@example.com")
    headers = auth_headers(owner.email)
    license_row = _shop_license(db_session, owner.shop_id)

    assert client.get("/api/v1/products", headers=headers).status_code == 200

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload(LicenseStatus.SUSPENDED, "Suspicious license usage"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == LicenseStatus.SUSPENDED
    assert body["masked_key"].startswith("PRPL-")
    assert "license_key_hash" not in body
    assert "license_key_prefix" not in body
    assert "license_key_suffix" not in body
    assert _license_events(db_session, license_row.id) == 1
    assert _license_audits(db_session, license_row.id) == 1

    blocked = client.get("/api/v1/products", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == DomainErrorCode.LICENSE_INACTIVE


def test_super_admin_reactivate_suspended_license_restores_access_and_clears_stale_revoked_at(
    client,
    db_session,
    make_user,
    admin_headers,
    auth_headers,
):
    owner = make_user(email="license-reactivate@example.com")
    headers = auth_headers(owner.email)
    license_row = _shop_license(db_session, owner.shop_id)
    license_row.status = LicenseStatus.SUSPENDED
    license_row.revoked_at = _utcnow() - timedelta(days=1)
    db_session.commit()

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload(LicenseStatus.ACTIVE, "Review complete"),
    )

    assert response.status_code == 200, response.text
    db_session.refresh(license_row)
    assert license_row.status == LicenseStatus.ACTIVE
    assert license_row.revoked_at is None
    assert license_row.activated_at is not None
    assert _license_events(db_session, license_row.id) == 1
    assert _license_audits(db_session, license_row.id) == 1
    assert client.get("/api/v1/products", headers=headers).status_code == 200


def test_expired_license_reactivation_is_rejected_without_extending_access(
    client,
    db_session,
    make_user,
    admin_headers,
    auth_headers,
):
    owner = make_user(email="license-expired-reactivation@example.com")
    headers = auth_headers(owner.email)
    license_row = _shop_license(db_session, owner.shop_id)
    license_row.status = LicenseStatus.SUSPENDED
    license_row.expires_at = _utcnow() - timedelta(days=1)
    db_session.commit()

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload(LicenseStatus.ACTIVE, "Attempt old license reactivation"),
    )

    assert response.status_code == 409
    db_session.refresh(license_row)
    assert license_row.status == LicenseStatus.SUSPENDED
    expires_at = license_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    assert expires_at < _utcnow()
    assert client.get("/api/v1/products", headers=headers).status_code == 403


def test_revoked_license_is_terminal_for_direct_reactivation(
    client,
    db_session,
    make_user,
    admin_headers,
):
    owner = make_user(email="license-revoked-terminal@example.com")
    license_row = _shop_license(db_session, owner.shop_id)
    license_row.status = LicenseStatus.REVOKED
    license_row.revoked_at = _utcnow()
    db_session.commit()

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload(LicenseStatus.ACTIVE, "Unsafe direct reactivation"),
    )

    assert response.status_code == 409
    db_session.refresh(license_row)
    assert license_row.status == LicenseStatus.REVOKED


def test_super_admin_revoke_license_blocks_access_and_populates_revoked_at(
    client,
    db_session,
    make_user,
    admin_headers,
    auth_headers,
):
    owner = make_user(email="license-revoke@example.com")
    headers = auth_headers(owner.email)
    license_row = _shop_license(db_session, owner.shop_id)

    response = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload(LicenseStatus.REVOKED, "Security revocation"),
    )

    assert response.status_code == 200, response.text
    db_session.refresh(license_row)
    assert license_row.status == LicenseStatus.REVOKED
    assert license_row.revoked_at is not None
    assert _license_events(db_session, license_row.id) == 1
    assert _license_audits(db_session, license_row.id) == 1

    blocked = client.get("/api/v1/products", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == DomainErrorCode.LICENSE_INACTIVE


def test_invalid_license_status_and_missing_reason_are_rejected(
    client,
    db_session,
    make_user,
    admin_headers,
):
    owner = make_user(email="license-invalid@example.com")
    license_row = _shop_license(db_session, owner.shop_id)

    invalid = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json=_status_payload("nonsense"),
    )
    missing_reason = client.patch(
        f"/api/v1/admin/licenses/{license_row.id}/status",
        headers=admin_headers,
        json={"status": LicenseStatus.SUSPENDED, "reason": "   "},
    )

    assert invalid.status_code == 400
    assert missing_reason.status_code == 400


def test_subscription_remains_authoritative_even_when_license_is_active(
    client,
    db_session,
    make_user,
    auth_headers,
):
    owner = make_user(email="license-subscription-authority@example.com")
    headers = auth_headers(owner.email)
    _set_subscription(
        db_session,
        owner.shop_id,
        status=SubscriptionStatus.ACTIVE,
        current_period_end=_utcnow() - timedelta(days=30),
        grace_period_days=0,
    )
    license_row = _shop_license(db_session, owner.shop_id)
    license_row.status = LicenseStatus.ACTIVE
    license_row.expires_at = None
    db_session.commit()

    response = client.get("/api/v1/products", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_EXPIRED
