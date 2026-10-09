from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import create_access_token
from app.core.shop_status import ShopStatus
from app.models.admin_audit_log import AdminAuditLog, AuditAction
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.services.organization_entitlement_service import (
    entitlement_scope,
    get_scoped_limit,
    resolve_entitlement_shop,
    resolve_organization_commercial_source,
)
from app.services.subscription_service import ensure_legacy_subscription_for_shop


REGISTRATION_FORM = {
    "shop_name": "Commercial Source Registration",
    "owner_name": "Source Owner",
    "email": "source-registration@example.com",
    "category": "Retail",
    "phone": "9876543210",
    "password": "CorrectHorse123!",
}


def _headers(user: User, branch_id: int | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}
    if branch_id is not None:
        headers["X-Branch-ID"] = str(branch_id)
    return headers


def _membership(db, user: User) -> OrganizationMembership:
    return db.query(OrganizationMembership).filter_by(user_id=user.id).one()


def _add_branch(
    db,
    owner: User,
    *,
    name: str,
    status: str = ShopStatus.ACTIVE,
    provision: bool = True,
) -> Shop:
    shop = Shop(
        organization_id=owner.shop.organization_id,
        is_default_branch=False,
        status=status,
        name=name,
        category="Retail",
        email=f"{name.lower().replace(' ', '-')}@example.com",
        phone="9000000011",
    )
    db.add(shop)
    db.flush()
    db.add(
        BranchMembership(
            organization_membership_id=_membership(db, owner).id,
            organization_id=owner.shop.organization_id,
            shop_id=shop.id,
            status=MembershipStatus.ACTIVE,
        )
    )
    if provision:
        ensure_legacy_subscription_for_shop(db=db, shop_id=shop.id)
    db.commit()
    db.refresh(shop)
    return shop


def _override_limit(db, shop_id: int, key: str, value: int) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key=key).one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(value),
            starts_at=datetime.now(timezone.utc),
            reason="Commercial source scope test",
        )
    )
    db.commit()


def test_registration_assigns_initial_commercial_source_and_audits(client, db_session):
    response = client.post("/api/v1/auth/register", data=REGISTRATION_FORM)

    assert response.status_code == 201, response.text
    organization = db_session.get(Organization, response.json()["organization_id"])
    assert organization.commercial_source_shop_id == response.json()["shop_id"]
    audit = (
        db_session.query(BusinessAuditLog)
        .filter_by(
            action=BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_ASSIGNED,
            entity_id=organization.id,
        )
        .one()
    )
    assert audit.after_data == {"commercial_source_shop_id": response.json()["shop_id"]}


def test_missing_source_fails_closed_with_stable_error(db_session, make_user):
    owner = make_user(email="missing-source@example.com")
    owner.shop.organization.commercial_source_shop_id = None
    db_session.commit()

    with pytest.raises(HTTPException) as raised:
        resolve_organization_commercial_source(
            db_session,
            owner.shop.organization_id,
            require_access=True,
        )

    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "COMMERCIAL_SOURCE_REQUIRED"


def test_organization_scope_ignores_selected_branch_and_shop_scope_does_not(
    db_session, make_user
):
    owner = make_user(email="scope-independence@example.com")
    selected = _add_branch(db_session, owner, name="Selected Branch")
    _override_limit(db_session, owner.shop_id, "locations.max", 7)
    _override_limit(db_session, selected.id, "locations.max", 1)

    location_limit = get_scoped_limit(
        db_session,
        organization_id=owner.shop.organization_id,
        operational_shop_id=selected.id,
        resource_key="locations",
    )
    products_shop = resolve_entitlement_shop(
        db_session,
        organization_id=owner.shop.organization_id,
        operational_shop_id=selected.id,
        entitlement_key="products.max",
    )

    assert location_limit.limit_value == Decimal("7")
    assert location_limit.source == "override"
    assert products_shop.id == selected.id
    assert entitlement_scope("staff.max") == "organization"
    assert entitlement_scope("multi_location.enabled") == "organization"
    assert entitlement_scope("products.max") == "shop"


def test_owner_reassignment_is_explicit_independent_of_default_and_audited(
    client, db_session, make_user
):
    owner = make_user(email="owner-source-change@example.com")
    original = owner.shop
    target = _add_branch(db_session, owner, name="Eligible Source")

    response = client.post(
        "/api/v1/branches/commercial-source",
        headers=_headers(owner, original.id),
        json={"shop_id": target.id, "reason": "Move organization allowance"},
    )

    assert response.status_code == 200, response.text
    db_session.expire_all()
    organization = db_session.get(Organization, original.organization_id)
    assert organization.commercial_source_shop_id == target.id
    assert original.is_default_branch is True
    assert target.is_default_branch is False
    audit = (
        db_session.query(BusinessAuditLog)
        .filter_by(
            action=BusinessAuditAction.ORGANIZATION_COMMERCIAL_SOURCE_CHANGED,
            entity_id=organization.id,
        )
        .one()
    )
    assert audit.before_data == {"commercial_source_shop_id": original.id}
    assert audit.after_data == {"commercial_source_shop_id": target.id}
    assert audit.audit_metadata["actor_scope"] == "organization_owner"


def test_non_owner_cannot_reassign_source(client, db_session, make_user):
    owner = make_user(email="source-owner@example.com")
    manager = make_user(
        email="source-manager@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    target = _add_branch(db_session, owner, name="Manager Forbidden Target")

    response = client.post(
        "/api/v1/branches/commercial-source",
        headers=_headers(manager, owner.shop_id),
        json={"shop_id": target.id, "reason": "Unauthorized source change"},
    )

    assert response.status_code == 403
    db_session.refresh(owner.shop.organization)
    assert owner.shop.organization.commercial_source_shop_id == owner.shop_id


def test_foreign_inactive_and_commercially_ineligible_targets_are_rejected(
    client, db_session, make_user
):
    owner = make_user(email="source-validation-owner@example.com")
    foreign_owner = make_user(email="source-validation-foreign@example.com")
    inactive = _add_branch(
        db_session,
        owner,
        name="Inactive Source",
        status=ShopStatus.INACTIVE,
    )
    expired = _add_branch(db_session, owner, name="Expired Source")
    subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=expired.id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    subscription.status = "expired"
    db_session.commit()

    for shop_id, expected in (
        (foreign_owner.shop_id, 404),
        (inactive.id, 409),
        (expired.id, 409),
    ):
        response = client.post(
            "/api/v1/branches/commercial-source",
            headers=_headers(owner),
            json={"shop_id": shop_id, "reason": "Validation test"},
        )
        assert response.status_code == expected, response.text


def test_revoked_license_cannot_become_source(client, db_session, make_user):
    owner = make_user(email="revoked-source-owner@example.com")
    target = _add_branch(db_session, owner, name="Revoked Source")
    license_row = (
        db_session.query(ShopLicense)
        .filter_by(shop_id=target.id)
        .order_by(ShopLicense.id.desc())
        .first()
    )
    license_row.status = "revoked"
    license_row.revoked_at = datetime.now(timezone.utc)
    db_session.commit()

    response = client.post(
        "/api/v1/branches/commercial-source",
        headers=_headers(owner),
        json={"shop_id": target.id, "reason": "Must remain rejected"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "COMMERCIAL_SOURCE_INELIGIBLE"


@pytest.mark.parametrize("commercial_failure", ["expired_subscription", "revoked_license"])
def test_ineligible_current_source_fails_closed_and_can_be_explicitly_recovered(
    commercial_failure, client, db_session, make_user
):
    owner = make_user(email=f"current-source-{commercial_failure}@example.com")
    replacement = _add_branch(db_session, owner, name=f"Recovery {commercial_failure}")
    if commercial_failure == "expired_subscription":
        subscription = (
            db_session.query(ShopSubscription)
            .filter_by(shop_id=owner.shop_id)
            .order_by(ShopSubscription.id.desc())
            .first()
        )
        subscription.status = "expired"
        expected_code = "SUBSCRIPTION_EXPIRED"
    else:
        license_row = (
            db_session.query(ShopLicense)
            .filter_by(shop_id=owner.shop_id)
            .order_by(ShopLicense.id.desc())
            .first()
        )
        license_row.status = "revoked"
        license_row.revoked_at = datetime.now(timezone.utc)
        expected_code = "LICENSE_INACTIVE"
    db_session.commit()

    with pytest.raises(HTTPException) as raised:
        get_scoped_limit(
            db_session,
            organization_id=owner.shop.organization_id,
            operational_shop_id=replacement.id,
            resource_key="locations",
        )
    assert raised.value.detail["code"] == expected_code

    recovered = client.post(
        "/api/v1/branches/commercial-source",
        headers=_headers(owner, replacement.id),
        json={"shop_id": replacement.id, "reason": "Recover unavailable source"},
    )
    assert recovered.status_code == 200, recovered.text


def test_super_admin_recovery_is_audited_without_tenant_membership(
    client, db_session, make_user, super_admin, admin_headers
):
    owner = make_user(email="admin-recovery-owner@example.com")
    target = _add_branch(db_session, owner, name="Recovery Source")

    response = client.post(
        f"/api/v1/admin/organizations/{owner.shop.organization_id}/commercial-source",
        headers=admin_headers,
        json={"shop_id": target.id, "reason": "Platform recovery case"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["commercial_source_shop_id"] == target.id
    assert (
        db_session.query(OrganizationMembership)
        .filter_by(user_id=super_admin.id)
        .count()
        == 0
    )
    admin_audit = (
        db_session.query(AdminAuditLog)
        .filter_by(
            action=AuditAction.COMMERCIAL_SOURCE_CHANGED,
            target_entity_id=owner.shop.organization_id,
        )
        .one()
    )
    assert admin_audit.reason == "Platform recovery case"


def test_commercial_source_cannot_be_deactivated_or_deleted(
    client, db_session, make_user
):
    owner = make_user(email="protected-source-owner@example.com")
    target = _add_branch(db_session, owner, name="Protected Source")
    changed = client.post(
        "/api/v1/branches/commercial-source",
        headers=_headers(owner),
        json={"shop_id": target.id, "reason": "Protect this source"},
    )
    assert changed.status_code == 200

    deactivated = client.post(
        f"/api/v1/branches/{target.id}/deactivate",
        headers=_headers(owner),
    )
    assert deactivated.status_code == 409
    assert "commercial-source" in deactivated.json()["detail"]

    with pytest.raises(IntegrityError):
        db_session.query(Shop).filter(Shop.id == target.id).delete(
            synchronize_session=False
        )
        db_session.commit()
    db_session.rollback()


def test_selected_expired_branch_does_not_override_valid_source_for_branch_creation(
    client, db_session, make_user
):
    owner = make_user(email="selected-expired-owner@example.com")
    selected = _add_branch(db_session, owner, name="Expired Operational")
    subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=selected.id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    subscription.status = "expired"
    db_session.commit()

    response = client.post(
        "/api/v1/branches",
        headers=_headers(owner, selected.id),
        json={
            "name": "Source Authorized Branch",
            "category": "Retail",
            "email": "source-authorized-branch@example.com",
            "phone": "9000000099",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["status"] == ShopStatus.PENDING
