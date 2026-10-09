from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import create_access_token
from app.core.shop_status import ShopStatus
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.services.organization_entitlement_service import (
    count_organization_locations,
)
from app.services.subscription_service import ensure_legacy_subscription_for_shop


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
    status: str,
    provision: bool = True,
) -> Shop:
    shop = Shop(
        organization_id=owner.shop.organization_id,
        is_default_branch=False,
        status=status,
        name=name,
        category="Retail",
        email=f"{name.lower().replace(' ', '-')}@example.com",
        phone="9000000043",
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


def _override(
    db,
    shop_id: int,
    key: str,
    *,
    limit: int | None = None,
    unlimited: bool = False,
    enabled: bool | None = None,
) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key=key).one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(limit) if limit is not None else None,
            is_unlimited=unlimited,
            feature_enabled=enabled,
            starts_at=datetime.now(timezone.utc),
            reason=f"Location quota test for {key}",
        )
    )
    db.commit()


def _create(client, owner: User, name: str, branch_id: int | None = None):
    return client.post(
        "/api/v1/branches",
        headers=_headers(owner, branch_id),
        json={
            "name": name,
            "category": "Retail",
            "email": f"{name.lower().replace(' ', '-')}@example.com",
            "phone": "9000000044",
        },
    )


def test_location_usage_counts_active_and_pending_but_not_inactive(
    db_session, make_user
):
    owner = make_user(email="location-usage@example.com")
    _add_branch(db_session, owner, name="Usage Pending", status=ShopStatus.PENDING)
    _add_branch(db_session, owner, name="Usage Inactive", status=ShopStatus.INACTIVE)

    assert count_organization_locations(db_session, owner.shop.organization_id) == 2


def test_multi_location_disabled_returns_structured_denial(
    client, db_session, make_user
):
    owner = make_user(email="location-feature-disabled@example.com")
    _override(
        db_session,
        owner.shop_id,
        "multi_location.enabled",
        enabled=False,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=5)

    response = _create(client, owner, "Feature Denied")

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "FEATURE_NOT_AVAILABLE"
    assert detail["details"] == {
        "entitlement_key": "multi_location.enabled",
        "current_usage": 1,
        "effective_limit": "1",
        "remaining_allowance": "0",
        "requested_increase": 1,
    }


def test_active_and_pending_locations_enforce_finite_limit(
    client, db_session, make_user
):
    owner = make_user(email="location-finite-limit@example.com")
    _add_branch(db_session, owner, name="Counted Pending", status=ShopStatus.PENDING)
    _override(db_session, owner.shop_id, "locations.max", limit=2)

    response = _create(client, owner, "Finite Denied")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "PLAN_LIMIT_REACHED"
    assert detail["details"] == {
        "entitlement_key": "locations.max",
        "current_usage": 2,
        "effective_limit": "2.00",
        "remaining_allowance": "0.00",
        "requested_increase": 1,
    }


def test_inactive_locations_do_not_consume_capacity(client, db_session, make_user):
    owner = make_user(email="location-inactive-excluded@example.com")
    _add_branch(db_session, owner, name="Excluded Inactive", status=ShopStatus.INACTIVE)
    _override(db_session, owner.shop_id, "locations.max", limit=2)

    response = _create(client, owner, "Allowed Pending")

    assert response.status_code == 201, response.text
    assert response.json()["status"] == ShopStatus.PENDING


def test_commercial_source_not_selected_or_default_controls_location_allowance(
    client, db_session, make_user
):
    owner = make_user(email="location-source-independent@example.com")
    selected = _add_branch(
        db_session,
        owner,
        name="Selected Default Plan",
        status=ShopStatus.ACTIVE,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=3)
    _override(db_session, selected.id, "locations.max", limit=1)
    _override(
        db_session,
        selected.id,
        "multi_location.enabled",
        enabled=False,
    )

    response = _create(client, owner, "Source Scoped", selected.id)

    assert response.status_code == 201, response.text
    assert owner.shop.is_default_branch is True


def test_legacy_unlimited_location_allowance_is_preserved(client, make_user):
    owner = make_user(email="location-legacy@example.com")

    first = _create(client, owner, "Legacy Pending One")
    second = _create(client, owner, "Legacy Pending Two")

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text


def test_pending_activation_and_active_deactivation_are_not_blocked_when_over_limit(
    client, db_session, make_user
):
    owner = make_user(email="location-over-limit-recovery@example.com")
    pending = _add_branch(
        db_session,
        owner,
        name="Over Limit Pending",
        status=ShopStatus.PENDING,
    )
    active = _add_branch(
        db_session,
        owner,
        name="Over Limit Active",
        status=ShopStatus.ACTIVE,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=1)

    activated = client.post(
        f"/api/v1/branches/{pending.id}/activate",
        headers=_headers(owner),
    )
    deactivated = client.post(
        f"/api/v1/branches/{active.id}/deactivate",
        headers=_headers(owner),
    )

    assert activated.status_code == 200, activated.text
    assert deactivated.status_code == 200, deactivated.text


def test_inactive_reactivation_enforces_capacity(client, db_session, make_user):
    owner = make_user(email="location-reactivation-limit@example.com")
    _add_branch(
        db_session,
        owner,
        name="Existing Active",
        status=ShopStatus.ACTIVE,
    )
    inactive = _add_branch(
        db_session,
        owner,
        name="Reactivate Denied",
        status=ShopStatus.INACTIVE,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=2)

    response = client.post(
        f"/api/v1/branches/{inactive.id}/activate",
        headers=_headers(owner),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    db_session.refresh(inactive)
    assert inactive.status == ShopStatus.INACTIVE


def test_inactive_reactivation_requires_owner_even_with_capacity(
    client, db_session, make_user
):
    owner = make_user(email="location-reactivation-owner@example.com")
    manager = make_user(
        email="location-reactivation-manager@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    inactive = _add_branch(
        db_session,
        owner,
        name="Manager Reactivate Denied",
        status=ShopStatus.INACTIVE,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=2)

    response = client.post(
        f"/api/v1/branches/{inactive.id}/activate",
        headers=_headers(manager),
    )

    assert response.status_code == 403


@pytest.mark.parametrize("failure", ["expired", "revoked"])
def test_unavailable_commercial_source_denies_location_increase(
    failure, client, db_session, make_user
):
    owner = make_user(email=f"location-source-{failure}@example.com")
    if failure == "expired":
        subscription = (
            db_session.query(ShopSubscription)
            .filter_by(shop_id=owner.shop_id)
            .order_by(ShopSubscription.id.desc())
            .first()
        )
        subscription.status = "expired"
        expected = "SUBSCRIPTION_EXPIRED"
    else:
        license_row = (
            db_session.query(ShopLicense)
            .filter_by(shop_id=owner.shop_id)
            .order_by(ShopLicense.id.desc())
            .first()
        )
        license_row.status = "revoked"
        license_row.revoked_at = datetime.now(timezone.utc)
        expected = "LICENSE_INACTIVE"
    db_session.commit()

    response = _create(client, owner, f"Unavailable {failure}")

    assert response.status_code in {403, 409}
    assert response.json()["detail"]["code"] == expected


def test_cross_organization_locations_do_not_consume_allowance(
    client, db_session, make_user
):
    owner = make_user(email="location-isolated-a@example.com")
    foreign = make_user(email="location-isolated-b@example.com")
    _add_branch(
        db_session,
        foreign,
        name="Foreign Counted Branch",
        status=ShopStatus.ACTIVE,
    )
    _override(db_session, owner.shop_id, "locations.max", limit=2)

    response = _create(client, owner, "Tenant Isolated")

    assert response.status_code == 201, response.text
