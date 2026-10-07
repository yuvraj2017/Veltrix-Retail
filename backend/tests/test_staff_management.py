import json

import pytest

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import create_access_token
from app.core.subscription_status import SubscriptionStatus
from app.core.user_status import UserStatus
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User


STAFF_URL = "/api/v1/organizations/current/staff"
LOWER_ADMIN_ROLES = (
    MembershipRole.MANAGER,
    MembershipRole.CASHIER,
    MembershipRole.INVENTORY_MANAGER,
    MembershipRole.PURCHASING_MANAGER,
    MembershipRole.REPORT_VIEWER,
)
OWNER_ASSIGNABLE_ROLES = (MembershipRole.ADMIN,) + LOWER_ADMIN_ROLES


def _membership(db_session, user: User) -> OrganizationMembership:
    return db_session.query(OrganizationMembership).filter_by(user_id=user.id).one()


def _headers_for_user(user: User) -> dict[str, str]:
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def _payload(
    owner: User,
    *,
    email: str,
    role: str = MembershipRole.MANAGER,
    branch_ids: list[int] | None = None,
    default_shop_id: int | None = None,
) -> dict:
    return {
        "full_name": "Created Staff",
        "email": email,
        "initial_password": "StrongPassword123!",
        "role": role,
        "branch_ids": branch_ids or [owner.shop_id],
        "default_shop_id": default_shop_id or owner.shop_id,
    }


def _create_second_branch(db_session, owner: User, suffix: str = "second") -> Shop:
    branch = Shop(
        organization_id=owner.shop.organization_id,
        is_default_branch=False,
        name=f"{suffix.title()} Branch",
        category="Grocery",
        email=f"{suffix}-branch@example.com",
        phone="9111111111",
    )
    db_session.add(branch)
    db_session.commit()
    db_session.refresh(branch)
    return branch


@pytest.mark.parametrize("role", OWNER_ASSIGNABLE_ROLES)
def test_owner_creates_each_supported_staff_role(
    client, db_session, make_user, auth_headers, role
):
    owner = make_user(email=f"owner-create-{role}@example.com")
    response = client.post(
        STAFF_URL,
        json=_payload(owner, email=f"created-{role}@example.com", role=role),
        headers=auth_headers(owner.email),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["role"] == role
    assert body["membership_status"] == MembershipStatus.ACTIVE
    assert body["active_shop_id"] == owner.shop_id
    assert body["branches"] == [
        {
            "shop_id": owner.shop_id,
            "shop_name": owner.shop.name,
            "status": MembershipStatus.ACTIVE,
            "is_current": True,
        }
    ]
    created_user = db_session.get(User, body["user_id"])
    assert created_user.role == "owner"
    assert created_user.password_hash != "StrongPassword123!"


@pytest.mark.parametrize("role", LOWER_ADMIN_ROLES)
def test_admin_creates_only_lower_staff_roles(client, make_user, auth_headers, role):
    admin = make_user(
        email=f"admin-create-{role}@example.com",
        membership_role=MembershipRole.ADMIN,
    )
    response = client.post(
        STAFF_URL,
        json=_payload(admin, email=f"admin-created-{role}@example.com", role=role),
        headers=auth_headers(admin.email),
    )
    assert response.status_code == 201, response.text
    assert response.json()["role"] == role


@pytest.mark.parametrize(
    ("actor_role", "requested_role", "expected"),
    [
        (MembershipRole.ADMIN, MembershipRole.ADMIN, 403),
        (MembershipRole.ADMIN, MembershipRole.OWNER, 422),
        (MembershipRole.OWNER, MembershipRole.OWNER, 422),
        (MembershipRole.OWNER, "super_admin", 422),
        (MembershipRole.OWNER, "unexpected", 422),
    ],
)
def test_privileged_role_creation_is_rejected(
    client, make_user, auth_headers, actor_role, requested_role, expected
):
    actor = make_user(
        email=f"role-reject-{actor_role}-{requested_role}@example.com",
        membership_role=actor_role,
    )
    response = client.post(
        STAFF_URL,
        json=_payload(
            actor,
            email=f"rejected-{actor_role}-{requested_role}@example.com",
            role=requested_role,
        ),
        headers=auth_headers(actor.email),
    )
    assert response.status_code == expected


def test_duplicate_existing_identity_is_rejected_without_attachment(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="identity-owner@example.com")
    existing = make_user(email="existing-identity@example.com")
    original_shop_id = existing.shop_id

    response = client.post(
        STAFF_URL,
        json=_payload(owner, email=existing.email),
        headers=auth_headers(owner.email),
    )
    assert response.status_code == 409
    db_session.refresh(existing)
    assert existing.shop_id == original_shop_id
    assert (
        db_session.query(OrganizationMembership)
        .filter_by(organization_id=owner.shop.organization_id, user_id=existing.id)
        .count()
        == 0
    )


def test_staff_listing_and_detail_are_tenant_scoped(
    client, db_session, make_user, auth_headers
):
    owner_a = make_user(email="staff-owner-a@example.com")
    owner_b = make_user(email="staff-owner-b@example.com")
    staff_b = make_user(
        email="staff-b@example.com",
        shop=owner_b.shop,
        membership_role=MembershipRole.CASHIER,
    )
    staff_b_membership = _membership(db_session, staff_b)

    listed = client.get(STAFF_URL, headers=auth_headers(owner_a.email))
    assert listed.status_code == 200
    assert {item["email"] for item in listed.json()} == {owner_a.email}

    detail = client.get(
        f"{STAFF_URL}/{staff_b_membership.id}",
        headers=auth_headers(owner_a.email),
    )
    assert detail.status_code == 404


def test_cross_organization_staff_mutations_are_not_disclosed(
    client, db_session, make_user, auth_headers
):
    owner_a = make_user(email="idor-owner-a@example.com")
    owner_b = make_user(email="idor-owner-b@example.com")
    staff_b = make_user(
        email="idor-staff-b@example.com",
        shop=owner_b.shop,
        membership_role=MembershipRole.MANAGER,
    )
    foreign_membership = _membership(db_session, staff_b)
    headers = auth_headers(owner_a.email)

    assert client.get(f"{STAFF_URL}/{foreign_membership.id}", headers=headers).status_code == 404
    assert client.patch(
        f"{STAFF_URL}/{foreign_membership.id}",
        json={"role": MembershipRole.CASHIER},
        headers=headers,
    ).status_code == 404
    assert client.post(
        f"{STAFF_URL}/{foreign_membership.id}/branches/{owner_a.shop_id}",
        headers=headers,
    ).status_code == 404
    assert client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": foreign_membership.id},
        headers=headers,
    ).status_code == 404


def test_cross_organization_branch_grant_is_rejected(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="branch-owner@example.com")
    foreign_owner = make_user(email="foreign-branch-owner@example.com")
    staff = make_user(
        email="branch-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    response = client.post(
        f"{STAFF_URL}/{_membership(db_session, staff).id}/branches/{foreign_owner.shop_id}",
        headers=auth_headers(owner.email),
    )
    assert response.status_code == 422


def test_membership_deactivation_and_reactivation_take_effect_on_same_jwt(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="lifecycle-owner@example.com")
    staff = make_user(
        email="lifecycle-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.CASHIER,
    )
    membership = _membership(db_session, staff)
    owner_headers = auth_headers(owner.email)
    stale_staff_headers = auth_headers(staff.email)

    assert client.get("/api/v1/products", headers=stale_staff_headers).status_code == 200
    disabled = client.patch(
        f"{STAFF_URL}/{membership.id}",
        json={"status": MembershipStatus.INACTIVE},
        headers=owner_headers,
    )
    assert disabled.status_code == 200
    assert client.get("/api/v1/products", headers=stale_staff_headers).status_code == 403

    enabled = client.patch(
        f"{STAFF_URL}/{membership.id}",
        json={"status": MembershipStatus.ACTIVE},
        headers=owner_headers,
    )
    assert enabled.status_code == 200
    assert client.get("/api/v1/products", headers=stale_staff_headers).status_code == 200


def test_inactive_global_user_cannot_be_reactivated_through_membership(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="inactive-account-owner@example.com")
    staff = make_user(
        email="inactive-account-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.CASHIER,
    )
    membership = _membership(db_session, staff)
    membership.status = MembershipStatus.INACTIVE
    staff.status = UserStatus.SUSPENDED
    staff.is_active = False
    db_session.commit()

    response = client.patch(
        f"{STAFF_URL}/{membership.id}",
        json={"status": MembershipStatus.ACTIVE},
        headers=auth_headers(owner.email),
    )
    assert response.status_code == 409
    db_session.refresh(membership)
    assert membership.status == MembershipStatus.INACTIVE


def test_branch_grant_revoke_and_current_branch_safety(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="branch-lifecycle-owner@example.com")
    staff = make_user(
        email="branch-lifecycle-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    membership = _membership(db_session, staff)
    second = _create_second_branch(db_session, owner, "lifecycle")
    headers = auth_headers(owner.email)

    granted = client.post(
        f"{STAFF_URL}/{membership.id}/branches/{second.id}", headers=headers
    )
    assert granted.status_code == 200, granted.text
    assert {branch["shop_id"] for branch in granted.json()["branches"]} == {
        owner.shop_id,
        second.id,
    }

    revoked = client.delete(
        f"{STAFF_URL}/{membership.id}/branches/{second.id}", headers=headers
    )
    assert revoked.status_code == 200
    assert next(
        branch for branch in revoked.json()["branches"] if branch["shop_id"] == second.id
    )["status"] == MembershipStatus.INACTIVE

    current_revoke = client.delete(
        f"{STAFF_URL}/{membership.id}/branches/{staff.shop_id}", headers=headers
    )
    assert current_revoke.status_code == 409


def test_admin_self_modification_owner_modification_and_lower_role_are_denied(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="hierarchy-owner@example.com")
    admin = make_user(
        email="hierarchy-admin@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.ADMIN,
    )
    manager = make_user(
        email="hierarchy-manager@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    admin_headers = auth_headers(admin.email)
    second = _create_second_branch(db_session, owner, "admin-self")

    assert client.patch(
        f"{STAFF_URL}/{_membership(db_session, admin).id}",
        json={"status": MembershipStatus.INACTIVE},
        headers=admin_headers,
    ).status_code == 409
    assert client.post(
        f"{STAFF_URL}/{_membership(db_session, admin).id}/branches/{second.id}",
        headers=admin_headers,
    ).status_code == 409
    assert client.patch(
        f"{STAFF_URL}/{_membership(db_session, owner).id}",
        json={"role": MembershipRole.MANAGER},
        headers=admin_headers,
    ).status_code == 403
    assert client.patch(
        f"{STAFF_URL}/{_membership(db_session, manager).id}",
        json={"role": MembershipRole.ADMIN},
        headers=admin_headers,
    ).status_code == 403
    assert client.post(
        STAFF_URL,
        json=_payload(manager, email="manager-created@example.com"),
        headers=auth_headers(manager.email),
    ).status_code == 403


def test_owner_generic_mutations_cannot_remove_owner_access(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="owner-safety@example.com")
    membership = _membership(db_session, owner)
    headers = auth_headers(owner.email)

    assert client.patch(
        f"{STAFF_URL}/{membership.id}",
        json={"status": MembershipStatus.INACTIVE},
        headers=headers,
    ).status_code == 409
    assert client.patch(
        f"{STAFF_URL}/{membership.id}",
        json={"role": MembershipRole.ADMIN},
        headers=headers,
    ).status_code == 409
    assert client.delete(
        f"{STAFF_URL}/{membership.id}/branches/{owner.shop_id}",
        headers=headers,
    ).status_code == 409


def test_ownership_transfer_is_atomic_and_permissions_change_without_new_jwt(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="transfer-owner@example.com")
    target = make_user(
        email="transfer-target@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    owner_membership = _membership(db_session, owner)
    target_membership = _membership(db_session, target)
    owner_headers = auth_headers(owner.email)
    target_headers = auth_headers(target.email)

    response = client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": target_membership.id},
        headers=owner_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["previous_owner"]["role"] == MembershipRole.ADMIN
    assert response.json()["new_owner"]["role"] == MembershipRole.OWNER

    db_session.refresh(owner_membership)
    db_session.refresh(target_membership)
    assert owner_membership.role == MembershipRole.ADMIN
    assert target_membership.role == MembershipRole.OWNER
    assert client.get("/api/v1/auth/me", headers=owner_headers).json()["membership_role"] == MembershipRole.ADMIN
    assert client.get("/api/v1/auth/me", headers=target_headers).json()["membership_role"] == MembershipRole.OWNER
    assert client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": owner_membership.id},
        headers=owner_headers,
    ).status_code == 403


def test_transfer_rejects_inactive_or_cross_organization_target(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="transfer-validation-owner@example.com")
    inactive = make_user(
        email="transfer-inactive@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    inactive_membership = _membership(db_session, inactive)
    inactive_membership.status = MembershipStatus.INACTIVE
    foreign = make_user(email="transfer-foreign@example.com")
    db_session.commit()
    headers = auth_headers(owner.email)

    assert client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": inactive_membership.id},
        headers=headers,
    ).status_code == 409
    assert client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": _membership(db_session, foreign).id},
        headers=headers,
    ).status_code == 404


def test_ownership_transfer_audit_failure_rolls_back_both_roles(
    client, db_session, make_user, auth_headers, monkeypatch
):
    owner = make_user(email="transfer-rollback-owner@example.com")
    target = make_user(
        email="transfer-rollback-target@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    owner_membership = _membership(db_session, owner)
    target_membership = _membership(db_session, target)

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("app.services.staff_service.record_business_audit", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        client.post(
            f"{STAFF_URL}/ownership-transfer",
            json={"target_membership_id": target_membership.id},
            headers=auth_headers(owner.email),
        )
    db_session.refresh(owner_membership)
    db_session.refresh(target_membership)
    assert owner_membership.role == MembershipRole.OWNER
    assert target_membership.role == MembershipRole.MANAGER


def test_security_mutations_create_sanitized_business_audits(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="audit-owner@example.com")
    second = _create_second_branch(db_session, owner, "audit")
    headers = auth_headers(owner.email)
    created = client.post(
        STAFF_URL,
        json=_payload(owner, email="audit-staff@example.com"),
        headers=headers,
    )
    assert created.status_code == 201
    membership_id = created.json()["membership_id"]
    assert client.patch(
        f"{STAFF_URL}/{membership_id}",
        json={"role": MembershipRole.CASHIER},
        headers=headers,
    ).status_code == 200
    assert client.patch(
        f"{STAFF_URL}/{membership_id}",
        json={"status": MembershipStatus.INACTIVE},
        headers=headers,
    ).status_code == 200
    assert client.patch(
        f"{STAFF_URL}/{membership_id}",
        json={"status": MembershipStatus.ACTIVE},
        headers=headers,
    ).status_code == 200
    assert client.post(
        f"{STAFF_URL}/{membership_id}/branches/{second.id}", headers=headers
    ).status_code == 200
    assert client.delete(
        f"{STAFF_URL}/{membership_id}/branches/{second.id}", headers=headers
    ).status_code == 200
    assert client.post(
        f"{STAFF_URL}/ownership-transfer",
        json={"target_membership_id": membership_id},
        headers=headers,
    ).status_code == 200

    logs = db_session.query(BusinessAuditLog).order_by(BusinessAuditLog.id).all()
    actions = {log.action for log in logs}
    assert {
        BusinessAuditAction.STAFF_CREATED,
        BusinessAuditAction.STAFF_ROLE_CHANGED,
        BusinessAuditAction.STAFF_DEACTIVATED,
        BusinessAuditAction.STAFF_ACTIVATED,
        BusinessAuditAction.STAFF_BRANCH_GRANTED,
        BusinessAuditAction.STAFF_BRANCH_REVOKED,
        BusinessAuditAction.OWNERSHIP_TRANSFERRED,
    }.issubset(actions)
    staff_logs = [log for log in logs if log.action.startswith("staff.") or log.action.startswith("ownership.")]
    assert all(log.actor_user_id == owner.id for log in staff_logs)
    by_action = {log.action: log for log in staff_logs}
    assert by_action[BusinessAuditAction.STAFF_ROLE_CHANGED].before_data["role"] == MembershipRole.MANAGER
    assert by_action[BusinessAuditAction.STAFF_ROLE_CHANGED].after_data["role"] == MembershipRole.CASHIER
    assert by_action[BusinessAuditAction.STAFF_DEACTIVATED].before_data["membership_status"] == MembershipStatus.ACTIVE
    assert by_action[BusinessAuditAction.STAFF_DEACTIVATED].after_data["membership_status"] == MembershipStatus.INACTIVE
    assert second.id not in by_action[BusinessAuditAction.STAFF_BRANCH_GRANTED].before_data["branch_ids"]
    assert second.id in by_action[BusinessAuditAction.STAFF_BRANCH_GRANTED].after_data["branch_ids"]
    assert by_action[BusinessAuditAction.OWNERSHIP_TRANSFERRED].before_data["target"]["role"] == MembershipRole.CASHIER
    assert by_action[BusinessAuditAction.OWNERSHIP_TRANSFERRED].after_data["new_owner"]["role"] == MembershipRole.OWNER
    serialized = json.dumps(
        [
            {
                "before": log.before_data,
                "after": log.after_data,
                "metadata": log.audit_metadata,
            }
            for log in staff_logs
        ]
    ).lower()
    assert "strongpassword" not in serialized
    assert "password_hash" not in serialized


def test_audit_failure_rolls_back_staff_creation(
    client, db_session, make_user, auth_headers, monkeypatch
):
    owner = make_user(email="audit-rollback-owner@example.com")

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("app.services.staff_service.record_business_audit", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        client.post(
            STAFF_URL,
            json=_payload(owner, email="must-rollback@example.com"),
            headers=auth_headers(owner.email),
        )
    assert db_session.query(User).filter_by(email="must-rollback@example.com").count() == 0
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.STAFF_CREATED)
        .count()
        == 0
    )


def test_staff_management_remains_entitlement_protected(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="staff-entitlement@example.com")
    subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=owner.shop_id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    subscription.status = SubscriptionStatus.EXPIRED
    db_session.commit()
    assert client.get(STAFF_URL, headers=auth_headers(owner.email)).status_code == 403
