from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.routing import APIRoute

from app.api.deps import require_active_shop_access
from app.core.domain_errors import DomainErrorCode
from app.core.subscription_status import SubscriptionStatus
from app.main import app
from app.models.plan import Plan
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


def _set_subscription(
    db_session,
    shop_id: int,
    *,
    status: str = SubscriptionStatus.ACTIVE,
    current_period_end: datetime | None = None,
    trial_start_at: datetime | None = None,
    trial_end_at: datetime | None = None,
    grace_period_days: int | None = None,
) -> ShopSubscription:
    subscription = _latest_subscription(db_session, shop_id)
    subscription.status = status
    subscription.current_period_end = current_period_end
    subscription.trial_start_at = trial_start_at
    subscription.trial_end_at = trial_end_at
    if grace_period_days is not None:
        subscription.plan.grace_period_days = grace_period_days
    db_session.commit()
    db_session.refresh(subscription)
    return subscription


def _create_empty_plan(db_session) -> Plan:
    plan = Plan(
        code="empty",
        name="Empty",
        description="No entitlements",
        monthly_price=Decimal("100.00"),
        annual_price=Decimal("1000.00"),
        currency="INR",
        trial_days=0,
        grace_period_days=0,
        is_active=True,
        is_archived=False,
        display_order=50,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)
    return plan


def _product_form_data(sku: str = "ENF001") -> dict[str, str]:
    return {
        "name": "Enforced Product",
        "sku": sku,
        "category": "General",
        "description": "",
        "buying_price": "10.00",
        "mrp": "20.00",
        "selling_price": "18.00",
        "stock_quantity": "5",
        "low_stock_threshold": "1",
        "unit": "pcs",
        "is_active": "true",
    }


def test_unauthenticated_business_route_is_denied(client):
    response = client.get("/api/v1/products")

    assert response.status_code in (401, 403)


def test_active_subscription_allows_business_route(client, make_user, auth_headers):
    user = make_user(email="phase1f-active@example.com")

    response = client.get("/api/v1/products", headers=auth_headers(user.email))

    assert response.status_code == 200, response.text


def test_valid_trial_allows_business_route(client, db_session, make_user, auth_headers):
    user = make_user(email="phase1f-trial@example.com")
    now = _utcnow()
    _set_subscription(
        db_session,
        user.shop_id,
        trial_start_at=now - timedelta(days=1),
        trial_end_at=now + timedelta(days=7),
    )

    response = client.get("/api/v1/products", headers=auth_headers(user.email))

    assert response.status_code == 200, response.text


def test_expired_trial_blocks_business_but_allows_subscription_access(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1f-expired-trial@example.com")
    now = _utcnow()
    _set_subscription(
        db_session,
        user.shop_id,
        trial_start_at=now - timedelta(days=10),
        trial_end_at=now - timedelta(days=1),
    )
    headers = auth_headers(user.email)

    blocked = client.get("/api/v1/products", headers=headers)
    overview = client.get("/api/v1/subscription/me", headers=headers)
    plans = client.get("/api/v1/subscription/plans", headers=headers)

    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_EXPIRED
    assert overview.status_code == 200
    assert overview.json()["access_allowed"] is False
    assert plans.status_code == 200


def test_grace_period_allows_business_until_grace_expires(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1f-grace@example.com")
    headers = auth_headers(user.email)

    _set_subscription(
        db_session,
        user.shop_id,
        current_period_end=_utcnow() - timedelta(days=1),
        grace_period_days=3,
    )
    allowed = client.get("/api/v1/products", headers=headers)

    _set_subscription(
        db_session,
        user.shop_id,
        current_period_end=_utcnow() - timedelta(days=5),
        grace_period_days=3,
    )
    denied = client.get("/api/v1/products", headers=headers)

    assert allowed.status_code == 200, allowed.text
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_EXPIRED


def test_expired_subscription_blocks_major_business_routes_but_not_renewal(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1f-expired-sub@example.com")
    _set_subscription(
        db_session,
        user.shop_id,
        current_period_end=_utcnow() - timedelta(days=30),
        grace_period_days=0,
    )
    headers = auth_headers(user.email)

    for path in (
        "/api/v1/products",
        "/api/v1/invoices",
        "/api/v1/customers",
        "/api/v1/vendors",
        "/api/v1/reports/summary",
        "/api/v1/audit-logs",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_EXPIRED

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/profile/me", headers=headers).status_code == 200
    assert client.get("/api/v1/subscription/me", headers=headers).status_code == 200
    assert client.get("/api/v1/subscription/plans", headers=headers).status_code == 200

    subscription = _latest_subscription(db_session, user.shop_id)
    checkout = client.post(
        "/api/v1/subscription/checkout",
        json={"plan_id": subscription.plan_id, "billing_interval": "monthly"},
        headers=headers,
    )
    assert checkout.status_code != 403


def test_suspended_subscription_blocks_business_operations(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1f-suspended@example.com")
    _set_subscription(db_session, user.shop_id, status=SubscriptionStatus.SUSPENDED)

    response = client.get("/api/v1/products", headers=auth_headers(user.email))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == DomainErrorCode.SUBSCRIPTION_SUSPENDED


def test_entitlement_denial_is_feature_specific_not_global_access_denial(
    client,
    db_session,
    make_user,
    auth_headers,
):
    user = make_user(email="phase1f-entitlement@example.com")
    empty_plan = _create_empty_plan(db_session)
    subscription = _latest_subscription(db_session, user.shop_id)
    subscription.plan_id = empty_plan.id
    subscription.current_period_end = None
    db_session.commit()
    headers = auth_headers(user.email)

    list_response = client.get("/api/v1/products", headers=headers)
    create_response = client.post(
        "/api/v1/products",
        data=_product_form_data(),
        headers=headers,
    )

    assert list_response.status_code == 200, list_response.text
    assert create_response.status_code == 403
    assert create_response.json()["detail"]["code"] == DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED


def test_tenant_subscription_state_is_isolated_by_shop(
    client,
    db_session,
    make_user,
    auth_headers,
):
    expired_user = make_user(email="phase1f-shop-expired@example.com")
    active_user = make_user(email="phase1f-shop-active@example.com")
    _set_subscription(
        db_session,
        expired_user.shop_id,
        current_period_end=_utcnow() - timedelta(days=30),
        grace_period_days=0,
    )

    expired_response = client.get("/api/v1/products", headers=auth_headers(expired_user.email))
    active_response = client.get("/api/v1/products", headers=auth_headers(active_user.email))

    assert expired_response.status_code == 403
    assert active_response.status_code == 200, active_response.text


def test_super_admin_route_not_blocked_by_tenant_subscription_gate(client, admin_headers):
    response = client.get("/api/v1/admin/stats", headers=admin_headers)

    assert response.status_code == 200, response.text


def test_razorpay_webhook_keeps_webhook_security_without_user_subscription_auth(client):
    response = client.post(
        "/api/v1/subscription/webhooks/razorpay",
        content=b"{}",
        headers={"X-Razorpay-Signature": "bad"},
    )

    assert response.status_code in (400, 402)


def test_business_route_coverage_uses_active_shop_dependency():
    business_prefixes = (
        "/api/v1/audit-logs",
        "/api/v1/billing",
        "/api/v1/customers",
        "/api/v1/dashboard",
        "/api/v1/expenses",
        "/api/v1/invoices",
        "/api/v1/products",
        "/api/v1/reports",
        "/api/v1/shops",
        "/api/v1/vendors",
    )
    uncovered = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not any(route.path.startswith(prefix) for prefix in business_prefixes):
            continue
        if not any(
            dependency.call is require_active_shop_access
            for dependency in route.dependant.dependencies
        ):
            uncovered.append(f"{sorted(route.methods)} {route.path}")

    assert uncovered == []
