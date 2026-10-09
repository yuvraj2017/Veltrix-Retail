from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import create_access_token
from app.core.shop_status import ShopStatus
from app.core.user_status import UserStatus
from app.models.business_audit_log import BusinessAuditLog
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.services.organization_entitlement_service import count_organization_staff
from app.services.subscription_service import ensure_legacy_subscription_for_shop


STAFF_URL = "/api/v1/organizations/current/staff"


def _headers(user: User, branch_id: int | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}
    if branch_id is not None:
        headers["X-Branch-ID"] = str(branch_id)
    return headers


def _membership(db, user: User) -> OrganizationMembership:
    return db.query(OrganizationMembership).filter_by(user_id=user.id).one()


def _payload(owner: User, email: str) -> dict:
    return {
        "full_name": "Quota Staff",
        "email": email,
        "initial_password": "StrongPassword123!",
        "role": MembershipRole.MANAGER,
        "branch_ids": [owner.shop_id],
        "default_shop_id": owner.shop_id,
    }


def _override_staff_limit(
    db,
    shop_id: int,
    *,
    limit: int | None = None,
    unlimited: bool = False,
) -> None:
    definition = db.query(EntitlementDefinition).filter_by(key="staff.max").one()
    db.add(
        ShopEntitlementOverride(
            shop_id=shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal(limit) if limit is not None else None,
            is_unlimited=unlimited,
            starts_at=datetime.now(timezone.utc),
            reason="Staff quota test",
        )
    )
    db.commit()


def _add_branch(db, owner: User, name: str) -> Shop:
    branch = Shop(
        organization_id=owner.shop.organization_id,
        is_default_branch=False,
        status=ShopStatus.ACTIVE,
        name=name,
        category="Retail",
        email=f"{name.lower().replace(' ', '-')}@example.com",
        phone="9000000061",
    )
    db.add(branch)
    db.flush()
    db.add(
        BranchMembership(
            organization_membership_id=_membership(db, owner).id,
            organization_id=owner.shop.organization_id,
            shop_id=branch.id,
            status=MembershipStatus.ACTIVE,
        )
    )
    ensure_legacy_subscription_for_shop(db=db, shop_id=branch.id)
    db.commit()
    db.refresh(branch)
    return branch


def test_staff_usage_counts_distinct_active_non_owners_only(db_session, make_user):
    owner = make_user(email="staff-count-owner@example.com")
    active = make_user(
        email="staff-count-active@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    inactive = make_user(
        email="staff-count-inactive@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.CASHIER,
    )
    suspended = make_user(
        email="staff-count-suspended@example.com",
        shop=owner.shop,
        status=UserStatus.SUSPENDED,
        membership_role=MembershipRole.REPORT_VIEWER,
    )
    foreign_owner = make_user(email="staff-count-foreign-owner@example.com")
    make_user(
        email="staff-count-foreign@example.com",
        shop=foreign_owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    _membership(db_session, inactive).status = MembershipStatus.INACTIVE
    second = _add_branch(db_session, owner, "Staff Count Second")
    db_session.add(
        BranchMembership(
            organization_membership_id=_membership(db_session, active).id,
            organization_id=owner.shop.organization_id,
            shop_id=second.id,
            status=MembershipStatus.ACTIVE,
        )
    )
    db_session.commit()

    assert suspended.is_active is False
    assert count_organization_staff(db_session, owner.shop.organization_id) == 2


def test_staff_creation_enforces_finite_limit_and_rolls_back_denial(
    client, db_session, make_user
):
    owner = make_user(email="staff-limit-owner@example.com")
    _override_staff_limit(db_session, owner.shop_id, limit=1)

    first = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-limit-first@example.com"),
    )
    assert first.status_code == 201, first.text
    audit_count = db_session.query(BusinessAuditLog).count()

    denied = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-limit-denied@example.com"),
    )

    assert denied.status_code == 409
    detail = denied.json()["detail"]
    assert detail["code"] == "PLAN_LIMIT_REACHED"
    assert detail["details"] == {
        "entitlement_key": "staff.max",
        "current_usage": 1,
        "effective_limit": "1.00",
        "remaining_allowance": "0.00",
        "requested_increase": 1,
    }
    assert db_session.query(User).filter_by(email="staff-limit-denied@example.com").count() == 0
    assert db_session.query(BusinessAuditLog).count() == audit_count


def test_zero_staff_limit_is_finite(client, db_session, make_user):
    owner = make_user(email="staff-zero-owner@example.com")
    _override_staff_limit(db_session, owner.shop_id, limit=0)

    response = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-zero-denied@example.com"),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["details"]["effective_limit"] == "0.00"


def test_commercial_source_not_selected_branch_controls_staff_limit(
    client, db_session, make_user
):
    owner = make_user(email="staff-source-owner@example.com")
    selected = _add_branch(db_session, owner, "Staff Selected")
    _override_staff_limit(db_session, owner.shop_id, limit=1)
    _override_staff_limit(db_session, selected.id, limit=0)

    response = client.post(
        STAFF_URL,
        headers=_headers(owner, selected.id),
        json=_payload(owner, "staff-source-created@example.com"),
    )

    assert response.status_code == 201, response.text


def test_reactivation_that_increases_usage_enforces_limit(
    client, db_session, make_user
):
    owner = make_user(email="staff-reactivate-owner@example.com")
    make_user(
        email="staff-reactivate-active@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    inactive = make_user(
        email="staff-reactivate-inactive@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.CASHIER,
    )
    inactive_membership = _membership(db_session, inactive)
    inactive_membership.status = MembershipStatus.INACTIVE
    db_session.commit()
    _override_staff_limit(db_session, owner.shop_id, limit=1)

    response = client.patch(
        f"{STAFF_URL}/{inactive_membership.id}",
        headers=_headers(owner),
        json={"status": MembershipStatus.ACTIVE},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    db_session.refresh(inactive_membership)
    assert inactive_membership.status == MembershipStatus.INACTIVE


def test_non_increasing_staff_changes_remain_available_when_over_limit(
    client, db_session, make_user
):
    owner = make_user(email="staff-over-limit-owner@example.com")
    first = make_user(
        email="staff-over-limit-first@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    second = make_user(
        email="staff-over-limit-second@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.CASHIER,
    )
    _override_staff_limit(db_session, owner.shop_id, limit=1)

    role_change = client.patch(
        f"{STAFF_URL}/{_membership(db_session, first).id}",
        headers=_headers(owner),
        json={"role": MembershipRole.REPORT_VIEWER},
    )
    deactivation = client.patch(
        f"{STAFF_URL}/{_membership(db_session, second).id}",
        headers=_headers(owner),
        json={"status": MembershipStatus.INACTIVE},
    )

    assert role_change.status_code == 200, role_change.text
    assert deactivation.status_code == 200, deactivation.text
    assert count_organization_staff(db_session, owner.shop.organization_id) == 1


def test_branch_assignment_does_not_consume_another_staff_slot(
    client, db_session, make_user
):
    owner = make_user(email="staff-branch-owner@example.com")
    staff = make_user(
        email="staff-branch-member@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    branch = _add_branch(db_session, owner, "Staff Branch Grant")
    _override_staff_limit(db_session, owner.shop_id, limit=1)

    response = client.post(
        f"{STAFF_URL}/{_membership(db_session, staff).id}/branches/{branch.id}",
        headers=_headers(owner),
    )

    assert response.status_code == 200, response.text
    assert count_organization_staff(db_session, owner.shop.organization_id) == 1


def test_legacy_unlimited_staff_access_is_preserved(client, make_user):
    owner = make_user(email="staff-legacy-owner@example.com")

    first = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-legacy-first@example.com"),
    )
    second = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-legacy-second@example.com"),
    )

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text


def test_missing_commercial_source_fails_closed(client, db_session, make_user):
    owner = make_user(email="staff-missing-source-owner@example.com")
    owner.shop.organization.commercial_source_shop_id = None
    db_session.commit()

    response = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, "staff-missing-source-denied@example.com"),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "COMMERCIAL_SOURCE_REQUIRED"


@pytest.mark.parametrize("failure", ["expired", "revoked"])
def test_unavailable_commercial_source_denies_staff_increase(
    failure, client, db_session, make_user
):
    owner = make_user(email=f"staff-source-{failure}@example.com")
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

    response = client.post(
        STAFF_URL,
        headers=_headers(owner),
        json=_payload(owner, f"staff-source-{failure}-denied@example.com"),
    )

    assert response.status_code in {403, 409}
    assert response.json()["detail"]["code"] == expected


def test_ownership_transfer_is_seat_neutral_when_over_limit(
    client, db_session, make_user
):
    owner = make_user(email="staff-transfer-owner@example.com")
    target = make_user(
        email="staff-transfer-target@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    _override_staff_limit(db_session, owner.shop_id, limit=0)

    response = client.post(
        f"{STAFF_URL}/ownership-transfer",
        headers=_headers(owner),
        json={"target_membership_id": _membership(db_session, target).id},
    )

    assert response.status_code == 200, response.text
    assert count_organization_staff(db_session, owner.shop.organization_id) == 1
