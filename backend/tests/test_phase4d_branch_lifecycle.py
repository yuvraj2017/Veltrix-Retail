from datetime import datetime, timezone
from decimal import Decimal

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import create_access_token
from app.core.shop_status import ShopStatus
from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.customer import Customer
from app.models.entitlement import (
    EntitlementDefinition,
    PlanEntitlement,
    ShopEntitlementOverride,
)
from app.models.license import ShopLicense
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.product import Product
from app.models.shop import Shop
from app.models.subscription import ShopSubscription
from app.models.user import User
from app.models.vendor import Vendor
from app.services.subscription_service import ensure_legacy_subscription_for_shop


def _headers(user: User, branch_id: int | None = None) -> dict[str, str]:
    result = {
        "Authorization": f"Bearer {create_access_token(subject=str(user.id))}"
    }
    if branch_id is not None:
        result["X-Branch-ID"] = str(branch_id)
    return result


def _payload(name: str = "North Branch") -> dict:
    return {
        "name": name,
        "category": "Grocery",
        "email": f"{name.lower().replace(' ', '-')}@example.com",
        "phone": "9000011111",
        "address": "Branch address",
        "gst_enabled": False,
    }


def _create(client, owner: User, name: str = "North Branch"):
    return client.post(
        "/api/v1/branches",
        headers=_headers(owner),
        json=_payload(name),
    )


def _membership(db_session, user: User) -> OrganizationMembership:
    return db_session.query(OrganizationMembership).filter_by(user_id=user.id).one()


def _provision(db_session, branch_id: int) -> None:
    ensure_legacy_subscription_for_shop(db=db_session, shop_id=branch_id)
    db_session.commit()


def test_owner_creates_pending_branch_with_owner_assignments_only(
    client, db_session, make_user
):
    owner = make_user(email="branch-create-owner@example.com")
    second_owner = make_user(
        email="branch-create-coowner@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.OWNER,
    )
    staff = make_user(
        email="branch-create-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )

    response = _create(client, owner)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == ShopStatus.PENDING
    assert body["is_default_branch"] is False
    assert db_session.query(ShopSubscription).filter_by(shop_id=body["id"]).count() == 0
    assigned = (
        db_session.query(BranchMembership)
        .filter_by(shop_id=body["id"], status=MembershipStatus.ACTIVE)
        .all()
    )
    assert {row.organization_membership_id for row in assigned} == {
        _membership(db_session, owner).id,
        _membership(db_session, second_owner).id,
    }
    assert _membership(db_session, staff).id not in {
        row.organization_membership_id for row in assigned
    }


def test_branch_create_is_owner_only(client, make_user):
    admin = make_user(
        email="branch-create-admin@example.com",
        membership_role=MembershipRole.ADMIN,
    )
    manager = make_user(
        email="branch-create-manager@example.com",
        membership_role=MembershipRole.MANAGER,
    )

    assert _create(client, admin, "Admin Branch").status_code == 403
    assert _create(client, manager, "Manager Branch").status_code == 403


def test_accessible_list_excludes_pending_but_directory_includes_it(
    client, make_user
):
    owner = make_user(email="branch-list-lifecycle@example.com")
    created = _create(client, owner).json()

    accessible = client.get("/api/v1/branches", headers=_headers(owner))
    directory = client.get("/api/v1/branches/directory", headers=_headers(owner))

    assert accessible.status_code == 200
    assert created["id"] not in {row["id"] for row in accessible.json()["items"]}
    assert directory.status_code == 200
    pending = next(row for row in directory.json()["items"] if row["id"] == created["id"])
    assert pending["status"] == ShopStatus.PENDING


def test_branch_update_is_scoped_and_rejects_lifecycle_fields(
    client, db_session, make_user
):
    owner = make_user(email="branch-update@example.com")
    created = _create(client, owner).json()

    updated = client.patch(
        f"/api/v1/branches/{created['id']}",
        headers=_headers(owner),
        json={"name": "Renamed Branch", "address": "Updated address"},
    )
    forbidden_field = client.patch(
        f"/api/v1/branches/{created['id']}",
        headers=_headers(owner),
        json={"organization_id": 999},
    )
    blank_name = client.patch(
        f"/api/v1/branches/{created['id']}",
        headers=_headers(owner),
        json={"name": "   "},
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed Branch"
    assert updated.json()["status"] == ShopStatus.PENDING
    assert forbidden_field.status_code == 422
    assert blank_name.status_code == 422
    db_session.expire_all()
    assert db_session.get(Shop, created["id"]).organization_id == owner.shop.organization_id


def test_activation_requires_branch_local_entitlement(client, db_session, make_user):
    owner = make_user(email="branch-activation@example.com")
    branch_id = _create(client, owner).json()["id"]

    blocked = client.post(
        f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner)
    )
    assert blocked.status_code == 409
    assert db_session.get(Shop, branch_id).status == ShopStatus.PENDING

    _provision(db_session, branch_id)
    activated = client.post(
        f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner)
    )
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == ShopStatus.ACTIVE


def test_supported_branch_provisioning_journey_is_isolated_and_revocable(
    client,
    db_session,
    make_user,
    admin_headers,
):
    owner = make_user(email="branch-release-owner@example.com")
    staff = make_user(
        email="branch-release-staff@example.com",
        shop=owner.shop,
        membership_role=MembershipRole.MANAGER,
    )
    original_shop_id = owner.shop_id
    original_default_id = owner.shop_id
    source_subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=original_shop_id)
        .order_by(ShopSubscription.id.desc())
        .one()
    )

    created = _create(client, owner, "Release Journey Branch")
    assert created.status_code == 201, created.text
    branch_id = created.json()["id"]
    assert created.json()["status"] == ShopStatus.PENDING
    assert created.json()["is_default_branch"] is False
    assert db_session.query(ShopSubscription).filter_by(shop_id=branch_id).count() == 0
    assert db_session.query(ShopLicense).filter_by(shop_id=branch_id).count() == 0
    assert db_session.query(Product).filter_by(shop_id=branch_id).count() == 0
    assert db_session.query(Customer).filter_by(shop_id=branch_id).count() == 0
    assert db_session.query(Vendor).filter_by(shop_id=branch_id).count() == 0

    staff_membership = _membership(db_session, staff)
    assert (
        db_session.query(BranchMembership)
        .filter_by(
            organization_membership_id=staff_membership.id,
            shop_id=branch_id,
        )
        .count()
        == 0
    )
    assert client.get(
        "/api/v1/products", headers=_headers(staff, branch_id)
    ).status_code == 403

    provisioned = client.post(
        f"/api/v1/admin/shops/{branch_id}/subscription",
        headers=admin_headers,
        json={
            "plan_id": source_subscription.plan_id,
            "status": "active",
            "billing_interval": "legacy",
            "reason": "Isolated Phase 4 release provisioning test",
        },
    )
    assert provisioned.status_code == 200, provisioned.text
    assert provisioned.json()["shop_id"] == branch_id
    assert db_session.query(ShopLicense).filter_by(shop_id=branch_id).count() == 1

    activated = client.post(
        f"/api/v1/branches/{branch_id}/activate",
        headers=_headers(owner),
    )
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == ShopStatus.ACTIVE

    owner_branches = client.get("/api/v1/branches", headers=_headers(owner))
    staff_branches = client.get("/api/v1/branches", headers=_headers(staff))
    assert branch_id in {row["id"] for row in owner_branches.json()["items"]}
    assert branch_id not in {row["id"] for row in staff_branches.json()["items"]}

    granted = client.post(
        f"/api/v1/organizations/current/staff/{staff_membership.id}/branches/{branch_id}",
        headers=_headers(owner),
    )
    assert granted.status_code == 200, granted.text
    assert client.get(
        "/api/v1/products", headers=_headers(staff, branch_id)
    ).status_code == 200

    revoked = client.delete(
        f"/api/v1/organizations/current/staff/{staff_membership.id}/branches/{branch_id}",
        headers=_headers(owner),
    )
    assert revoked.status_code == 200, revoked.text
    assert client.get(
        "/api/v1/products", headers=_headers(staff, branch_id)
    ).status_code == 403

    db_session.expire_all()
    assert db_session.get(User, owner.id).shop_id == original_shop_id
    assert db_session.get(User, staff.id).shop_id == original_shop_id
    assert db_session.get(Shop, original_default_id).is_default_branch is True


def test_inactive_branch_is_denied_for_header_and_preferred_fallback(
    client, db_session, make_user
):
    owner = make_user(email="branch-inactive-auth@example.com")
    branch_id = _create(client, owner).json()["id"]
    _provision(db_session, branch_id)
    assert client.post(
        f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner)
    ).status_code == 200

    branch = db_session.get(Shop, branch_id)
    branch.status = ShopStatus.INACTIVE
    db_session.commit()
    assert client.get("/api/v1/products", headers=_headers(owner, branch_id)).status_code == 403

    owner.shop_id = branch_id
    db_session.commit()
    assert client.get("/api/v1/products", headers=_headers(owner)).status_code == 403


def test_default_change_is_dedicated_and_does_not_rewrite_user_preference(
    client, db_session, make_user
):
    owner = make_user(email="branch-default@example.com")
    preferred = owner.shop_id
    branch_id = _create(client, owner).json()["id"]
    _provision(db_session, branch_id)
    client.post(f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner))

    response = client.post(
        f"/api/v1/branches/{branch_id}/make-default", headers=_headers(owner)
    )

    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(Shop, branch_id).is_default_branch is True
    assert db_session.get(Shop, preferred).is_default_branch is False
    assert db_session.get(User, owner.id).shop_id == preferred
    defaults = (
        db_session.query(Shop)
        .filter_by(organization_id=owner.shop.organization_id, is_default_branch=True)
        .count()
    )
    assert defaults == 1


def test_deactivation_rejects_default_and_preferred_user_dependency(
    client, db_session, make_user
):
    owner = make_user(email="branch-deactivate-guard@example.com")
    original_id = owner.shop_id
    branch_id = _create(client, owner).json()["id"]
    _provision(db_session, branch_id)
    client.post(f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner))

    assert client.post(
        f"/api/v1/branches/{original_id}/deactivate", headers=_headers(owner)
    ).status_code == 409

    owner.shop_id = branch_id
    db_session.commit()
    assert client.post(
        f"/api/v1/branches/{branch_id}/deactivate",
        headers=_headers(owner, original_id),
    ).status_code == 409


def test_nondefault_unreferenced_branch_can_deactivate_and_reactivate(
    client, db_session, make_user
):
    owner = make_user(email="branch-lifecycle-success@example.com")
    branch_id = _create(client, owner).json()["id"]
    _provision(db_session, branch_id)
    client.post(f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner))

    deactivated = client.post(
        f"/api/v1/branches/{branch_id}/deactivate", headers=_headers(owner)
    )
    reactivated = client.post(
        f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner)
    )

    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["status"] == ShopStatus.INACTIVE
    assert reactivated.status_code == 200, reactivated.text
    assert reactivated.json()["status"] == ShopStatus.ACTIVE


def test_foreign_branch_management_is_tenant_safe(client, make_user):
    owner_a = make_user(email="branch-tenant-a@example.com")
    owner_b = make_user(email="branch-tenant-b@example.com")

    assert client.get(
        f"/api/v1/branches/{owner_b.shop_id}", headers=_headers(owner_a)
    ).status_code == 404
    assert client.patch(
        f"/api/v1/branches/{owner_b.shop_id}",
        headers=_headers(owner_a),
        json={"name": "Cross Tenant"},
    ).status_code == 404
    assert client.post(
        f"/api/v1/branches/{owner_b.shop_id}/make-default",
        headers=_headers(owner_a),
    ).status_code == 404


def test_super_admin_cannot_manage_tenant_branches(client, super_admin, make_user):
    owner = make_user(email="branch-superadmin-target@example.com")
    assert client.get(
        "/api/v1/branches/directory",
        headers=_headers(super_admin, owner.shop_id),
    ).status_code == 403
    assert _create(client, super_admin, "Platform Branch").status_code == 403


def test_branch_mutations_write_sanitized_transactional_audit(
    client, db_session, make_user
):
    owner = make_user(email="branch-audit@example.com")
    branch_id = _create(client, owner).json()["id"]
    _provision(db_session, branch_id)
    client.patch(
        f"/api/v1/branches/{branch_id}",
        headers=_headers(owner),
        json={"name": "Audited Branch"},
    )
    client.post(f"/api/v1/branches/{branch_id}/activate", headers=_headers(owner))
    client.post(f"/api/v1/branches/{branch_id}/deactivate", headers=_headers(owner))

    actions = {
        row.action
        for row in db_session.query(BusinessAuditLog)
        .filter_by(entity_type="shop", entity_id=branch_id)
        .all()
    }
    assert {
        BusinessAuditAction.BRANCH_CREATED,
        BusinessAuditAction.BRANCH_UPDATED,
        BusinessAuditAction.BRANCH_ACTIVATED,
        BusinessAuditAction.BRANCH_DEACTIVATED,
    }.issubset(actions)


def test_audit_failure_rolls_back_branch_update(
    client, db_session, make_user, monkeypatch
):
    owner = make_user(email="branch-audit-rollback@example.com")
    branch = owner.shop
    original_name = branch.name

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(
        "app.services.branch_service.record_business_audit", fail_audit
    )
    try:
        client.patch(
            f"/api/v1/branches/{branch.id}",
            headers=_headers(owner),
            json={"name": "Must Roll Back"},
        )
    except RuntimeError:
        pass

    db_session.expire_all()
    assert db_session.get(Shop, branch.id).name == original_name


def test_location_limit_blocks_branch_creation(client, db_session, make_user):
    owner = make_user(email="branch-location-limit@example.com")
    subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=owner.shop_id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    definition = (
        db_session.query(EntitlementDefinition)
        .filter_by(key="locations.max")
        .one()
    )
    db_session.add(
        ShopEntitlementOverride(
            shop_id=owner.shop_id,
            entitlement_id=definition.id,
            limit_value=Decimal("1"),
            is_unlimited=False,
            starts_at=datetime.now(timezone.utc),
            reason="Branch-limit test override",
        )
    )
    db_session.commit()

    response = _create(client, owner, "Over Limit")

    assert response.status_code == 409
    assert (
        db_session.query(Shop)
        .filter_by(organization_id=owner.shop.organization_id)
        .count()
        == 1
    )
