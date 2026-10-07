from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import text

from app.api.deps import require_active_shop_access, require_super_admin
from app.core.membership import MembershipRole, MembershipStatus
from app.core.permissions import (
    AUTHENTICATION_ONLY_ENDPOINTS,
    ENDPOINT_PERMISSION_POLICIES,
    PUBLIC_ENDPOINTS,
    Permission,
    permissions_for_role,
)
from app.core.security import create_access_token
from app.core.subscription_status import SubscriptionStatus
from app.main import app
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.subscription import ShopSubscription


def _membership(db_session, user) -> OrganizationMembership:
    return db_session.query(OrganizationMembership).filter_by(user_id=user.id).one()


def _branch_membership(db_session, user) -> BranchMembership:
    return (
        db_session.query(BranchMembership)
        .join(
            OrganizationMembership,
            OrganizationMembership.id == BranchMembership.organization_membership_id,
        )
        .filter(OrganizationMembership.user_id == user.id)
        .one()
    )


def _set_role(db_session, user, role: str) -> None:
    _membership(db_session, user).role = role
    db_session.commit()


def _headers_for_user(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}


def _expire_subscription(db_session, user) -> None:
    subscription = (
        db_session.query(ShopSubscription)
        .filter(ShopSubscription.shop_id == user.shop_id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    subscription.status = SubscriptionStatus.EXPIRED
    subscription.current_period_end = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()


def test_role_permission_matrix_is_fail_closed():
    assert set(permissions_for_role(MembershipRole.OWNER)) == set(Permission.ALL)

    admin = permissions_for_role(MembershipRole.ADMIN)
    assert Permission.STAFF_MANAGE in admin
    assert Permission.SETTINGS_MANAGE in admin
    assert Permission.OWNERSHIP_TRANSFER not in admin
    assert Permission.SUBSCRIPTION_MANAGE not in admin

    manager = permissions_for_role(MembershipRole.MANAGER)
    assert Permission.SALES_REFUND in manager
    assert Permission.SALES_CANCEL in manager
    assert Permission.INVENTORY_ADJUST in manager
    assert Permission.STAFF_MANAGE not in manager

    cashier = permissions_for_role(MembershipRole.CASHIER)
    assert Permission.SALES_CREATE in cashier
    assert Permission.SALES_PAYMENT in cashier
    assert Permission.SALES_RETURN in cashier
    assert Permission.SALES_REFUND not in cashier
    assert Permission.SALES_CANCEL not in cashier

    inventory = permissions_for_role(MembershipRole.INVENTORY_MANAGER)
    assert Permission.INVENTORY_ADJUST in inventory
    assert Permission.INVENTORY_COUNT in inventory
    assert Permission.SALES_REFUND not in inventory

    purchasing = permissions_for_role(MembershipRole.PURCHASING_MANAGER)
    assert Permission.PURCHASING_RECEIVE in purchasing
    assert Permission.PURCHASING_RETURN in purchasing
    assert Permission.PAYABLES_MANAGE in purchasing
    assert Permission.PAYABLES_PAYMENT not in purchasing

    viewer = permissions_for_role(MembershipRole.REPORT_VIEWER)
    assert Permission.REPORTS_VIEW in viewer
    assert Permission.REPORTS_EXPORT in viewer
    assert Permission.PRODUCTS_MANAGE not in viewer

    with pytest.raises(ValueError):
        permissions_for_role("super_admin")
    with pytest.raises(ValueError):
        permissions_for_role("unknown")


def test_existing_owner_retains_business_access(client, make_user, auth_headers):
    user = make_user(email="rbac-owner@example.com")
    response = client.get("/api/v1/products", headers=auth_headers(user.email))
    assert response.status_code == 200, response.text


def test_admin_and_manager_operational_permissions(
    client, db_session, make_user, auth_headers
):
    admin = make_user(email="rbac-admin@example.com", membership_role=MembershipRole.ADMIN)
    manager = make_user(
        email="rbac-manager@example.com",
        membership_role=MembershipRole.MANAGER,
    )

    assert client.get("/api/v1/audit-logs", headers=auth_headers(admin.email)).status_code == 200
    manager_cancel = client.post(
        "/api/v1/invoices/999/cancel",
        json={"reason": "Manager review"},
        headers=auth_headers(manager.email),
    )
    assert manager_cancel.status_code == 404


def test_cashier_allowed_sales_but_denied_refund_and_cancellation(
    client, make_user, auth_headers
):
    cashier = make_user(
        email="rbac-cashier@example.com",
        membership_role=MembershipRole.CASHIER,
    )
    headers = auth_headers(cashier.email)

    assert client.get("/api/v1/invoices", headers=headers).status_code == 200
    assert client.get("/api/v1/customers", headers=headers).status_code == 200
    cancelled = client.post(
        "/api/v1/invoices/999/cancel",
        json={"reason": "Not permitted"},
        headers=headers,
    )
    refunded = client.post(
        "/api/v1/invoices/returns/999/refunds",
        json={
            "client_request_id": "cashier-refund-001",
            "amount": "10.00",
            "refund_method": "cash",
        },
        headers=headers,
    )
    assert cancelled.status_code == 403
    assert refunded.status_code == 403


def test_inventory_manager_scope(client, make_user, auth_headers):
    user = make_user(
        email="rbac-inventory@example.com",
        membership_role=MembershipRole.INVENTORY_MANAGER,
    )
    headers = auth_headers(user.email)
    adjustment = client.post(
        "/api/v1/inventory/products/999/adjustments",
        json={
            "client_request_id": "inventory-adjust-001",
            "direction": "in",
            "quantity": 1,
            "reason": "found_stock",
        },
        headers=headers,
    )
    assert adjustment.status_code == 404
    assert client.get("/api/v1/invoices", headers=headers).status_code == 403


def test_purchasing_manager_scope(client, make_user, auth_headers):
    user = make_user(
        email="rbac-purchasing@example.com",
        membership_role=MembershipRole.PURCHASING_MANAGER,
    )
    headers = auth_headers(user.email)
    assert client.get("/api/v1/purchase-orders", headers=headers).status_code == 200
    receipt = client.post(
        "/api/v1/purchase-orders/999/receipts",
        json={
            "client_request_id": "purchase-receipt-001",
            "received_date": date.today().isoformat(),
            "items": [{"purchase_order_item_id": 999, "received_quantity": 1}],
        },
        headers=headers,
    )
    payment = client.post(
        "/api/v1/vendors/bills/999/payments",
        json={
            "client_request_id": "vendor-payment-001",
            "payment_date": date.today().isoformat(),
            "amount": "1.00",
        },
        headers=headers,
    )
    assert receipt.status_code == 404
    assert payment.status_code == 403


def test_report_viewer_is_read_only(client, make_user, auth_headers):
    user = make_user(
        email="rbac-viewer@example.com",
        membership_role=MembershipRole.REPORT_VIEWER,
    )
    headers = auth_headers(user.email)
    assert client.get("/api/v1/reports/summary", headers=headers).status_code == 200
    assert client.get("/api/v1/inventory/exports/inventory", headers=headers).status_code == 200
    denied = client.post(
        "/api/v1/customers",
        json={"name": "Denied Customer", "phone": "9999999999"},
        headers=headers,
    )
    assert denied.status_code == 403


@pytest.mark.parametrize("target", ["organization", "branch"])
def test_inactive_membership_is_denied(
    client, db_session, make_user, auth_headers, target
):
    user = make_user(email=f"inactive-{target}@example.com")
    if target == "organization":
        _membership(db_session, user).status = MembershipStatus.INACTIVE
    else:
        _branch_membership(db_session, user).status = MembershipStatus.INACTIVE
    db_session.commit()

    response = client.get("/api/v1/products", headers=_headers_for_user(user))
    assert response.status_code == 403


@pytest.mark.parametrize("target", ["organization", "branch"])
def test_missing_membership_is_denied(client, db_session, make_user, target):
    user = make_user(email=f"missing-{target}@example.com")
    if target == "organization":
        db_session.delete(_branch_membership(db_session, user))
        db_session.flush()
        db_session.delete(_membership(db_session, user))
    else:
        db_session.delete(_branch_membership(db_session, user))
    db_session.commit()

    response = client.get("/api/v1/products", headers=_headers_for_user(user))
    assert response.status_code == 403


def test_cross_organization_shop_pointer_is_denied(
    client, db_session, make_user, make_shop
):
    user = make_user(email="cross-org-context@example.com")
    other_shop = make_shop("Other Tenant")
    user.shop_id = other_shop.id
    db_session.commit()

    response = client.get("/api/v1/products", headers=_headers_for_user(user))
    assert response.status_code == 403


def test_invalid_legacy_and_membership_roles_fail_closed(
    client, db_session, make_user
):
    invalid_user = make_user(email="invalid-legacy-role@example.com")
    invalid_user.role = "unexpected"
    db_session.commit()
    assert client.get(
        "/api/v1/products", headers=_headers_for_user(invalid_user)
    ).status_code == 403

    invalid_membership_user = make_user(email="invalid-membership-role@example.com")
    db_session.execute(text("PRAGMA ignore_check_constraints = ON"))
    _membership(db_session, invalid_membership_user).role = "unexpected"
    db_session.commit()
    response = client.get(
        "/api/v1/products",
        headers=_headers_for_user(invalid_membership_user),
    )
    assert response.status_code == 403


def test_super_admin_and_tenant_routes_remain_separate(
    client, make_user, super_admin, auth_headers
):
    owner = make_user(email="tenant-not-platform@example.com")
    assert client.get("/api/v1/products", headers=auth_headers(super_admin.email)).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=auth_headers(owner.email)).status_code == 403


def test_entitlement_and_membership_are_both_required(
    client, db_session, make_user, auth_headers
):
    user = make_user(email="rbac-expired@example.com")
    _expire_subscription(db_session, user)
    headers = auth_headers(user.email)

    blocked = client.get("/api/v1/products", headers=headers)
    recovery = client.get("/api/v1/subscription/me", headers=headers)
    assert blocked.status_code == 403
    assert recovery.status_code == 200


def test_auth_me_reflects_database_permissions_without_new_jwt(
    client, db_session, make_user, auth_headers
):
    user = make_user(email="rbac-me@example.com")
    headers = auth_headers(user.email)

    owner_me = client.get("/api/v1/auth/me", headers=headers)
    assert owner_me.status_code == 200
    assert owner_me.json()["organization_id"] == user.shop.organization_id
    assert owner_me.json()["active_shop_id"] == user.shop_id
    assert owner_me.json()["membership_role"] == MembershipRole.OWNER
    assert Permission.OWNERSHIP_TRANSFER in owner_me.json()["permissions"]

    _set_role(db_session, user, MembershipRole.REPORT_VIEWER)
    viewer_me = client.get("/api/v1/auth/me", headers=headers)
    assert viewer_me.status_code == 200
    assert viewer_me.json()["membership_role"] == MembershipRole.REPORT_VIEWER
    assert Permission.REPORTS_VIEW in viewer_me.json()["permissions"]
    assert Permission.CUSTOMERS_MANAGE not in viewer_me.json()["permissions"]

    denied = client.post(
        "/api/v1/customers",
        json={"name": "Denied Customer", "phone": "9999999999"},
        headers=headers,
    )
    assert denied.status_code == 403


def test_every_api_endpoint_has_an_explicit_authorization_policy():
    uncovered = []
    incorrectly_wired = []

    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/v1"):
            continue
        if route.path.startswith("/api/v1/admin"):
            if not any(
                dependency.call is require_super_admin
                for dependency in route.dependant.dependencies
            ):
                incorrectly_wired.append(route.name)
            continue
        if route.name in ENDPOINT_PERMISSION_POLICIES:
            if not any(
                dependency.call is require_active_shop_access
                for dependency in route.dependant.dependencies
            ):
                incorrectly_wired.append(route.name)
            continue
        if route.name in PUBLIC_ENDPOINTS | AUTHENTICATION_ONLY_ENDPOINTS:
            continue
        uncovered.append(f"{sorted(route.methods)} {route.path} ({route.name})")

    assert uncovered == []
    assert incorrectly_wired == []

