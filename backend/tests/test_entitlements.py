from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.domain_errors import DomainErrorCode
from app.core.subscription_status import LicenseStatus, SubscriptionStatus
from app.models.entitlement import (
    EntitlementDefinition,
    EntitlementKind,
    EntitlementValueType,
    PlanEntitlement,
    ShopEntitlementOverride,
)
from app.models.invoice import Invoice
from app.models.license import ShopLicense
from app.models.plan import Plan
from app.models.product import Product
from app.models.subscription import ShopSubscription
from app.models.vendor import Vendor
from app.services import entitlement_service
from app.services import commercial_service
from app.schemas.product import ProductCreate
from app.schemas.vendor import VendorCreate
from app.schemas.subscription import (
    PaymentCreateRequest,
)
from app.services.product_service import create_product
from app.services.vendor_service import create_vendor
from app.services.license_service import (
    create_license_for_subscription,
    generate_license_key,
    hash_license_key,
    mask_license_key,
)
from app.services.subscription_service import (
    LEGACY_PLAN_CODE,
    ensure_legacy_subscription_for_shop,
)


def _now():
    return datetime.now(timezone.utc)


def _make_plan(db_session, code="starter", archived=False, active=True):
    plan = Plan(
        code=code,
        name=code.title(),
        description="Test plan",
        monthly_price=Decimal("100.00"),
        annual_price=Decimal("1000.00"),
        currency="INR",
        is_active=active,
        is_archived=archived,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)
    return plan


def _make_limit_definition(db_session, key="products.max", resource_key="products"):
    definition = EntitlementDefinition(
        key=key,
        name=key,
        kind=EntitlementKind.LIMIT,
        value_type=EntitlementValueType.INTEGER,
        resource_key=resource_key,
        is_active=True,
    )
    db_session.add(definition)
    db_session.commit()
    db_session.refresh(definition)
    return definition


def _make_feature_definition(db_session, key="reports.advanced"):
    definition = EntitlementDefinition(
        key=key,
        name=key,
        kind=EntitlementKind.FEATURE,
        value_type=EntitlementValueType.BOOLEAN,
        is_active=True,
    )
    db_session.add(definition)
    db_session.commit()
    db_session.refresh(definition)
    return definition


def _subscribe(db_session, shop_id, plan, status=SubscriptionStatus.ACTIVE):
    subscription = ShopSubscription(
        shop_id=shop_id,
        plan_id=plan.id,
        status=status,
        billing_interval="monthly",
        current_period_start=_now(),
    )
    db_session.add(subscription)
    db_session.commit()
    db_session.refresh(subscription)
    license_row, _ = create_license_for_subscription(
        db=db_session,
        subscription=subscription,
        status=LicenseStatus.ACTIVE,
    )
    db_session.commit()
    db_session.refresh(license_row)
    return subscription


def test_plan_model(db_session):
    plan = _make_plan(db_session)
    assert plan.id
    assert plan.code == "starter"
    assert plan.monthly_price == Decimal("100.00")
    assert plan.is_active is True


def test_entitlement_definition(db_session):
    definition = _make_limit_definition(db_session)
    assert definition.key == "products.max"
    assert definition.kind == EntitlementKind.LIMIT
    assert definition.resource_key == "products"


def test_plan_entitlement_unique_constraint(db_session):
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            limit_value=Decimal("10"),
        )
    )
    db_session.commit()

    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            limit_value=Decimal("20"),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_quantitative_entitlement(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            limit_value=Decimal("100"),
        )
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)

    limit = entitlement_service.get_limit(shop.id, "products", db_session)

    assert limit.configured is True
    assert limit.limit_value == Decimal("100.00")
    assert limit.is_unlimited is False


def test_feature_entitlement(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_feature_definition(db_session)
    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            feature_enabled=True,
        )
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)

    assert entitlement_service.has_feature(shop.id, "reports.advanced", db_session) is True


def test_unlimited_entitlement(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            is_unlimited=True,
            limit_value=None,
        )
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)

    limit = entitlement_service.get_limit(shop.id, "products", db_session)
    capability = entitlement_service.can_create(shop.id, "products", db_session)

    assert limit.is_unlimited is True
    assert capability.allowed is True
    assert capability.is_unlimited is True


def test_missing_entitlement(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    _subscribe(db_session, shop.id, plan)

    capability = entitlement_service.can_create(shop.id, "products", db_session)

    assert capability.allowed is False
    assert capability.code == DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED


def test_shop_subscription(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    subscription = _subscribe(db_session, shop.id, plan)

    assert subscription.shop_id == shop.id
    assert subscription.plan_id == plan.id
    assert subscription.status == SubscriptionStatus.ACTIVE


def test_subscription_status(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    _subscribe(db_session, shop.id, plan, status=SubscriptionStatus.SUSPENDED)

    access = entitlement_service.evaluate_shop_access(shop.id, db_session)

    assert access.allowed is False
    assert access.code == DomainErrorCode.SUBSCRIPTION_SUSPENDED


def test_license_generation():
    key = generate_license_key()

    assert key.startswith("PRPL-")
    assert len(key) > 30
    assert mask_license_key(key).endswith(key[-4:])
    assert key not in mask_license_key(key)


def test_license_uniqueness():
    keys = {generate_license_key() for _ in range(200)}
    assert len(keys) == 200


def test_license_masking():
    key = "PRPL-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH"
    masked = mask_license_key(key)

    assert masked == "PRPL-****-****-****-****-HHHH"
    assert "AAAA" not in masked


def test_license_status(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    subscription = _subscribe(db_session, shop.id, plan)
    license_row = (
        db_session.query(ShopLicense)
        .filter(ShopLicense.subscription_id == subscription.id)
        .one()
    )
    license_row.status = LicenseStatus.REVOKED
    db_session.commit()

    access = entitlement_service.evaluate_shop_access(shop.id, db_session)

    assert access.allowed is False
    assert access.code == DomainErrorCode.LICENSE_INACTIVE


def test_shop_override(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(
            plan_id=plan.id,
            entitlement_id=definition.id,
            limit_value=Decimal("100"),
        )
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)
    db_session.add(
        ShopEntitlementOverride(
            shop_id=shop.id,
            entitlement_id=definition.id,
            limit_value=Decimal("250"),
            starts_at=_now() - timedelta(minutes=1),
            reason="Test override",
        )
    )
    db_session.commit()

    limit = entitlement_service.get_limit(shop.id, "products", db_session)

    assert limit.source == "override"
    assert limit.limit_value == Decimal("250.00")


def test_override_active_period(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=10)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)
    db_session.add(
        ShopEntitlementOverride(
            shop_id=shop.id,
            entitlement_id=definition.id,
            limit_value=20,
            starts_at=_now() - timedelta(days=1),
            ends_at=_now() + timedelta(days=1),
        )
    )
    db_session.commit()

    assert entitlement_service.get_limit(shop.id, "products", db_session).limit_value == Decimal("20.00")


def test_expired_override(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=10)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)
    db_session.add(
        ShopEntitlementOverride(
            shop_id=shop.id,
            entitlement_id=definition.id,
            limit_value=20,
            starts_at=_now() - timedelta(days=2),
            ends_at=_now() - timedelta(days=1),
        )
    )
    db_session.commit()

    limit = entitlement_service.get_limit(shop.id, "products", db_session)
    assert limit.source == "plan"
    assert limit.limit_value == Decimal("10.00")


def test_future_override(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=10)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)
    db_session.add(
        ShopEntitlementOverride(
            shop_id=shop.id,
            entitlement_id=definition.id,
            limit_value=20,
            starts_at=_now() + timedelta(days=1),
        )
    )
    db_session.commit()

    assert entitlement_service.get_limit(shop.id, "products", db_session).limit_value == Decimal("10.00")


def test_effective_entitlement_without_override(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=5)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)

    effective = entitlement_service.get_effective_entitlements(shop.id, db_session)

    assert effective["products.max"].source == "plan"
    assert effective["products.max"].limit_value == Decimal("5.00")


def test_effective_entitlement_with_override(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=5)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)
    db_session.add(
        ShopEntitlementOverride(
            shop_id=shop.id,
            entitlement_id=definition.id,
            limit_value=9,
            starts_at=_now() - timedelta(minutes=1),
        )
    )
    db_session.commit()

    effective = entitlement_service.get_effective_entitlements(shop.id, db_session)

    assert effective["products.max"].source == "override"
    assert effective["products.max"].limit_value == Decimal("9.00")


def test_product_usage(db_session, make_shop):
    shop = make_shop()
    db_session.add_all(
        [
            Product(shop_id=shop.id, name="A", sku="A", category="Cat"),
            Product(shop_id=shop.id, name="B", sku="B", category="Cat"),
        ]
    )
    db_session.commit()

    usage = entitlement_service.get_usage(shop.id, "products", db_session)

    assert usage.supported is True
    assert usage.used == 2


def test_vendor_usage(db_session, make_shop):
    shop = make_shop()
    db_session.add_all(
        [
            Vendor(shop_id=shop.id, vendor_name="A"),
            Vendor(shop_id=shop.id, vendor_name="B"),
        ]
    )
    db_session.commit()

    usage = entitlement_service.get_usage(shop.id, "vendors", db_session)

    assert usage.supported is True
    assert usage.used == 2


def test_monthly_order_usage_uses_live_invoices(db_session, make_shop):
    shop = make_shop()
    today = datetime.now(timezone.utc).date()
    db_session.add_all(
        [
            Invoice(
                shop_id=shop.id,
                invoice_number="INV-1",
                customer_name_snapshot="A",
                customer_phone_snapshot="12345",
                invoice_date=today,
                invoice_status="saved",
            ),
            Invoice(
                shop_id=shop.id,
                invoice_number="INV-2",
                customer_name_snapshot="B",
                customer_phone_snapshot="12345",
                invoice_date=today,
                invoice_status="cancelled",
            ),
        ]
    )
    db_session.commit()

    usage = entitlement_service.get_usage(shop.id, "orders.monthly", db_session)

    assert usage.supported is True
    assert usage.used == 1


def test_unsupported_usage_is_explicit(db_session, make_shop):
    shop = make_shop()

    usage = entitlement_service.get_usage(shop.id, "storage", db_session)

    assert usage.supported is False
    assert usage.code == DomainErrorCode.USAGE_UNSUPPORTED


def test_legacy_shop_compatibility(db_session, make_shop):
    shop = make_shop()

    subscription = ensure_legacy_subscription_for_shop(db=db_session, shop_id=shop.id)
    db_session.commit()

    assert subscription.status == SubscriptionStatus.ACTIVE
    assert subscription.plan.code == LEGACY_PLAN_CODE
    assert entitlement_service.can_create(shop.id, "products", db_session).allowed is True


def test_shop_isolation(db_session, make_shop):
    shop_a = make_shop()
    shop_b = make_shop()
    db_session.add(Product(shop_id=shop_b.id, name="B", sku="B", category="Cat"))
    db_session.commit()

    assert entitlement_service.get_usage(shop_a.id, "products", db_session).used == 0
    assert entitlement_service.get_usage(shop_b.id, "products", db_session).used == 1


def test_archived_inactive_plan_behavior(db_session, make_shop):
    shop = make_shop()
    plan = _make_plan(db_session, code="archived", archived=True, active=False)
    definition = _make_limit_definition(db_session)
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=3)
    )
    db_session.commit()
    _subscribe(db_session, shop.id, plan)

    # Existing subscriptions keep resolving even if their plan is later archived.
    limit = entitlement_service.get_limit(shop.id, "products", db_session)
    assert limit.configured is True
    assert limit.limit_value == Decimal("3.00")


def test_invalid_entitlement_configuration(db_session):
    limit_definition = _make_limit_definition(db_session)
    feature_definition = _make_feature_definition(db_session)

    with pytest.raises(ValueError):
        entitlement_service.validate_entitlement_configuration(
            definition=limit_definition,
            feature_enabled=True,
        )

    with pytest.raises(ValueError):
        entitlement_service.validate_entitlement_configuration(
            definition=feature_definition,
            limit_value=Decimal("10"),
            feature_enabled=True,
        )


def test_hash_license_key_is_stable_and_not_plaintext():
    key = generate_license_key()
    digest = hash_license_key(key)

    assert digest == hash_license_key(key)
    assert key not in digest
    assert len(digest) == 64


def test_product_limit_enforcement_blocks_creation(db_session, make_user):
    owner = make_user(email="limit-products@example.com")
    plan = _make_plan(db_session, code="product-limit-plan")
    definition = (
        db_session.query(EntitlementDefinition)
        .filter(EntitlementDefinition.key == "products.max")
        .one()
    )
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=1)
    )
    db_session.commit()
    _subscribe(db_session, owner.shop_id, plan)
    db_session.add(Product(shop_id=owner.shop_id, name="Existing", sku="EX", category="Cat"))
    db_session.commit()

    payload = ProductCreate(name="Blocked", sku="BL", category="Cat")

    with pytest.raises(Exception) as exc:
        create_product(payload, owner, db_session)

    assert getattr(exc.value, "status_code", None) == 409
    assert exc.value.detail["code"] == DomainErrorCode.PLAN_LIMIT_REACHED


def test_vendor_limit_enforcement_blocks_creation(db_session, make_user):
    owner = make_user(email="limit-vendors@example.com")
    plan = _make_plan(db_session, code="vendor-limit-plan")
    definition = (
        db_session.query(EntitlementDefinition)
        .filter(EntitlementDefinition.key == "vendors.max")
        .one()
    )
    db_session.add(
        PlanEntitlement(plan_id=plan.id, entitlement_id=definition.id, limit_value=1)
    )
    db_session.commit()
    _subscribe(db_session, owner.shop_id, plan)
    db_session.add(Vendor(shop_id=owner.shop_id, vendor_name="Existing Vendor"))
    db_session.commit()

    with pytest.raises(Exception) as exc:
        create_vendor(VendorCreate(vendor_name="Blocked Vendor"), db_session, owner)

    assert getattr(exc.value, "status_code", None) == 409
    assert exc.value.detail["code"] == DomainErrorCode.PLAN_LIMIT_REACHED


def test_admin_plan_entitlement_subscription_and_overview_api(
    client,
    admin_headers,
    make_shop,
):
    shop = make_shop("Commerce API Shop")

    plan_response = client.post(
        "/api/v1/admin/plans",
        headers=admin_headers,
        json={
            "code": "Growth API",
            "name": "Growth API",
            "monthly_price": "499.00",
            "annual_price": "4990.00",
            "currency": "INR",
        },
    )
    assert plan_response.status_code == 201, plan_response.text
    plan = plan_response.json()

    entitlement_response = client.post(
        "/api/v1/admin/entitlements",
        headers=admin_headers,
        json={
            "key": "api-test-products.max",
            "name": "API test products",
            "kind": "limit",
            "value_type": "integer",
            "resource_key": "products",
        },
    )
    assert entitlement_response.status_code == 201, entitlement_response.text
    entitlement = entitlement_response.json()

    config_response = client.put(
        f"/api/v1/admin/plans/{plan['id']}/entitlements/{entitlement['id']}",
        headers=admin_headers,
        json={"limit_value": "2", "is_unlimited": False, "feature_enabled": None},
    )
    assert config_response.status_code == 200, config_response.text
    assert config_response.json()["limit_value"] == "2.00"

    assign_response = client.post(
        f"/api/v1/admin/shops/{shop.id}/subscription",
        headers=admin_headers,
        json={
            "plan_id": plan["id"],
            "status": "active",
            "billing_interval": "monthly",
        },
    )
    assert assign_response.status_code == 200, assign_response.text

    overview = client.get(
        f"/api/v1/admin/shops/{shop.id}/subscription",
        headers=admin_headers,
    )
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert body["plan"]["id"] == plan["id"]
    assert body["license"]["masked_key"].startswith("PRPL-")
    assert any(item["resource_key"] == "products" for item in body["limits"])


def test_shop_owner_subscription_overview_uses_authenticated_shop(
    client,
    make_user,
    auth_headers,
):
    owner = make_user(email="subscription-owner@example.com")

    response = client.get(
        "/api/v1/subscription/me",
        headers=auth_headers(owner.email),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["shop_id"] == owner.shop_id
    assert body["subscription"]["status"] == "active"
    assert body["license"]["masked_key"].startswith("PRPL-")


def test_payment_recording_is_idempotent_and_activates_subscription(
    db_session,
    super_admin,
    make_shop,
):
    shop = make_shop("Paid Shop")
    plan = _make_plan(db_session, code="paid-plan")
    request = PaymentCreateRequest(
        shop_id=shop.id,
        plan_id=plan.id,
        amount=Decimal("999.00"),
        currency="INR",
        billing_interval="monthly",
        provider="manual",
        provider_payment_id="pay_123",
        provider_event_id="evt_123",
        status="succeeded",
    )

    first = commercial_service.record_payment(db_session, request, super_admin)
    second = commercial_service.record_payment(db_session, request, super_admin)

    assert first.id == second.id
    assert first.subscription_id is not None
    subscription = (
        db_session.query(ShopSubscription)
        .filter(ShopSubscription.id == first.subscription_id)
        .one()
    )
    assert subscription.plan_id == plan.id
    assert subscription.status == SubscriptionStatus.ACTIVE


def test_admin_cannot_assign_archived_plan_api(client, admin_headers, make_shop, db_session):
    shop = make_shop("Archived Assignment Shop")
    plan = _make_plan(db_session, code="archived-assignment", archived=True, active=False)

    response = client.post(
        f"/api/v1/admin/shops/{shop.id}/subscription",
        headers=admin_headers,
        json={"plan_id": plan.id, "status": "active", "billing_interval": "monthly"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_NOT_ASSIGNABLE"
