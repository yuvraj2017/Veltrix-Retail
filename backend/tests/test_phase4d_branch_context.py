from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.core.membership import MembershipStatus
from app.core.security import create_access_token
from app.core.subscription_status import SubscriptionStatus
from app.core.user_status import UserRole
from app.models.business_audit_log import BusinessAuditLog
from app.models.expense import Expense
from app.models.invoice_idempotency import InvoiceIdempotencyKey
from app.models.invoice_payment import InvoicePayment
from app.models.invoice_return import InvoiceReturn
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.product import Product
from app.models.purchase import GoodsReceipt, PurchaseReturn
from app.models.shop import Shop
from app.models.stock_adjustment_request import StockAdjustmentRequest
from app.models.subscription import ShopSubscription
from app.models.vendor_bill_payment import VendorBillPayment
from app.services.subscription_service import ensure_legacy_subscription_for_shop


def _token_headers(user, branch_id=None):
    headers = {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}
    if branch_id is not None:
        headers["X-Branch-ID"] = str(branch_id)
    return headers


def _add_branch(db, user, *, name="Second Branch", entitled=True):
    shop = Shop(
        organization_id=user.shop.organization_id,
        is_default_branch=False,
        name=name,
        category="Grocery",
        email=f"{name.lower().replace(' ', '-')}@example.com",
        phone="9000012345",
    )
    db.add(shop)
    db.flush()
    organization_membership = (
        db.query(OrganizationMembership)
        .filter_by(user_id=user.id, organization_id=shop.organization_id)
        .one()
    )
    branch_membership = BranchMembership(
        organization_membership_id=organization_membership.id,
        organization_id=shop.organization_id,
        shop_id=shop.id,
        status=MembershipStatus.ACTIVE,
    )
    db.add(branch_membership)
    if entitled:
        ensure_legacy_subscription_for_shop(db=db, shop_id=shop.id)
    db.commit()
    db.refresh(shop)
    return shop, branch_membership


def _product(db, shop_id, *, name, sku):
    row = Product(
        shop_id=shop_id,
        name=name,
        sku=sku,
        category="General",
        buying_price=Decimal("10.00"),
        mrp=Decimal("15.00"),
        selling_price=Decimal("14.00"),
        stock_quantity=0,
        low_stock_threshold=5,
        unit="pcs",
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _create_api_product(client, headers, *, name, sku, stock=5):
    response = client.post(
        "/api/v1/products",
        headers=headers,
        data={
            "name": name,
            "sku": sku,
            "category": "General",
            "buying_price": "10.00",
            "mrp": "15.00",
            "selling_price": "14.00",
            "stock_quantity": str(stock),
            "low_stock_threshold": "2",
            "unit": "pcs",
            "is_active": "true",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_headerless_request_uses_validated_preferred_branch(
    client, db_session, make_user
):
    user = make_user(email="branch-fallback@example.com")
    preferred = _product(
        db_session, user.shop_id, name="Preferred Product", sku="PREFERRED"
    )

    response = client.get("/api/v1/products", headers=_token_headers(user))

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [preferred.id]


def test_assigned_header_selects_branch_without_changing_user_preference(
    client, db_session, make_user
):
    user = make_user(email="branch-select@example.com")
    preferred_shop_id = user.shop_id
    second, _ = _add_branch(db_session, user)
    _product(db_session, preferred_shop_id, name="First Product", sku="FIRST")
    selected = _product(db_session, second.id, name="Second Product", sku="SECOND")

    response = client.get(
        "/api/v1/products", headers=_token_headers(user, second.id)
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [selected.id]
    db_session.refresh(user)
    assert user.shop_id == preferred_shop_id


def test_malformed_header_never_falls_back(client, make_user):
    user = make_user(email="branch-malformed@example.com")
    response = client.get(
        "/api/v1/products",
        headers={**_token_headers(user), "X-Branch-ID": "not-an-id"},
    )
    assert response.status_code == 400


def test_foreign_and_same_organization_unassigned_branches_are_denied(
    client, db_session, make_user, make_shop
):
    user = make_user(email="branch-denied@example.com")
    unassigned, membership = _add_branch(db_session, user, name="Unassigned")
    db_session.delete(membership)
    db_session.commit()
    foreign = make_shop("Foreign Branch")

    assert client.get(
        "/api/v1/products", headers=_token_headers(user, unassigned.id)
    ).status_code == 403
    assert client.get(
        "/api/v1/products", headers=_token_headers(user, foreign.id)
    ).status_code == 403
    assert client.get(
        "/api/v1/products", headers=_token_headers(user, 999999)
    ).status_code == 403


def test_revoked_branch_membership_denies_same_jwt_immediately(
    client, db_session, make_user
):
    user = make_user(email="branch-revoked@example.com")
    second, membership = _add_branch(db_session, user)
    headers = _token_headers(user, second.id)
    assert client.get("/api/v1/products", headers=headers).status_code == 200

    membership.status = MembershipStatus.INACTIVE
    db_session.commit()

    assert client.get("/api/v1/products", headers=headers).status_code == 403


def test_selected_branch_entitlement_and_recovery_are_branch_scoped(
    client, db_session, make_user
):
    user = make_user(email="branch-entitlement@example.com")
    second, _ = _add_branch(db_session, user)
    subscription = (
        db_session.query(ShopSubscription)
        .filter_by(shop_id=second.id)
        .order_by(ShopSubscription.id.desc())
        .first()
    )
    subscription.status = SubscriptionStatus.EXPIRED
    subscription.current_period_end = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()
    headers = _token_headers(user, second.id)

    blocked = client.get("/api/v1/products", headers=headers)
    recovery = client.get("/api/v1/subscription/me", headers=headers)

    assert blocked.status_code == 403
    assert recovery.status_code == 200
    assert recovery.json()["shop_id"] == second.id


def test_branch_list_returns_only_explicit_active_assignments(
    client, db_session, make_user
):
    owner = make_user(email="branch-list@example.com")
    assigned, _ = _add_branch(db_session, owner, name="Assigned")
    hidden, hidden_membership = _add_branch(db_session, owner, name="Hidden")
    hidden_membership.status = MembershipStatus.INACTIVE
    db_session.commit()

    response = client.get("/api/v1/branches", headers=_token_headers(owner))

    assert response.status_code == 200
    rows = response.json()["items"]
    assert {row["id"] for row in rows} == {owner.shop_id, assigned.id}
    assert hidden.id not in {row["id"] for row in rows}
    assert next(row for row in rows if row["id"] == owner.shop_id)["is_preferred"]


def test_super_admin_cannot_use_tenant_branch_context(
    client, super_admin, make_shop
):
    shop = make_shop("Tenant Branch")
    response = client.get(
        "/api/v1/branches", headers=_token_headers(super_admin, shop.id)
    )
    assert response.status_code == 403


def test_products_settings_and_audit_use_selected_branch(
    client, db_session, make_user
):
    user = make_user(email="branch-domains@example.com")
    second, _ = _add_branch(db_session, user)
    first_product = _product(
        db_session, user.shop_id, name="First Product", sku="FIRST-IDOR"
    )
    headers = _token_headers(user, second.id)

    assert client.get(
        f"/api/v1/products/{first_product.id}", headers=headers
    ).status_code == 404
    assert client.get(f"/api/v1/shops/{second.id}", headers=headers).status_code == 200
    assert client.get(
        f"/api/v1/shops/{user.shop_id}", headers=headers
    ).status_code == 403

    created = client.post(
        "/api/v1/products",
        headers=headers,
        data={
            "name": "Audited Branch Product",
            "sku": "AUDIT-BRANCH",
            "category": "General",
            "buying_price": "10.00",
            "mrp": "15.00",
            "selling_price": "14.00",
            "stock_quantity": "0",
            "low_stock_threshold": "5",
            "unit": "pcs",
            "is_active": "true",
        },
    )
    assert created.status_code == 201, created.text
    audit = (
        db_session.query(BusinessAuditLog)
        .filter_by(entity_type="product", entity_id=created.json()["id"])
        .one()
    )
    assert audit.shop_id == second.id


def test_cross_branch_product_update_is_rejected_before_file_persistence(
    client, db_session, make_user, monkeypatch
):
    user = make_user(email="branch-upload-guard@example.com")
    second, _ = _add_branch(db_session, user)
    foreign_product = _product(
        db_session, user.shop_id, name="Foreign Product", sku="FOREIGN-UPLOAD"
    )
    called = False

    def _unexpected_save(_images):
        nonlocal called
        called = True
        return []

    monkeypatch.setattr(
        "app.api.v1.endpoints.products.save_uploaded_product_images",
        _unexpected_save,
    )
    response = client.put(
        f"/api/v1/products/{foreign_product.id}",
        headers=_token_headers(user, second.id),
        data={"name": "Should Not Save"},
    )

    assert response.status_code == 404
    assert called is False


def test_expenses_are_isolated_by_selected_branch_for_same_user(
    client, db_session, make_user
):
    user = make_user(email="branch-expenses@example.com")
    second, _ = _add_branch(db_session, user)
    first_expense = Expense(
        user_id=user.id,
        shop_id=user.shop_id,
        title="First Branch Rent",
        category="Rent",
        amount=Decimal("100.00"),
        expense_date=date.today(),
    )
    second_expense = Expense(
        user_id=user.id,
        shop_id=second.id,
        title="Second Branch Rent",
        category="Rent",
        amount=Decimal("200.00"),
        expense_date=date.today(),
    )
    db_session.add_all([first_expense, second_expense])
    db_session.commit()
    headers = _token_headers(user, second.id)

    response = client.get("/api/v1/expenses", headers=headers)
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["items"]] == [second_expense.id]

    denied = client.put(
        f"/api/v1/expenses/{first_expense.id}",
        headers=headers,
        json={"title": "Cross-branch edit"},
    )
    assert denied.status_code == 404


def test_cross_branch_report_and_inventory_data_do_not_mix(
    client, db_session, make_user
):
    user = make_user(email="branch-report@example.com")
    second, _ = _add_branch(db_session, user)
    _product(db_session, user.shop_id, name="First Inventory", sku="INV-FIRST")
    selected = _product(
        db_session, second.id, name="Second Inventory", sku="INV-SECOND"
    )
    headers = _token_headers(user, second.id)

    inventory = client.get("/api/v1/inventory/products", headers=headers)
    export = client.get("/api/v1/inventory/exports/inventory", headers=headers)
    reports = client.get("/api/v1/reports/summary", headers=headers)

    assert inventory.status_code == 200
    assert [row["product_id"] for row in inventory.json()["items"]] == [selected.id]
    assert export.status_code == 200
    assert "Second Inventory" in export.text
    assert "First Inventory" not in export.text
    assert reports.status_code == 200


def test_customer_vendor_purchase_and_invoice_writes_use_selected_branch(
    client, db_session, make_user
):
    user = make_user(email="branch-write-domains@example.com")
    second, _ = _add_branch(db_session, user)
    headers = _token_headers(user, second.id)
    product = _create_api_product(
        client, headers, name="Second Branch Sale Item", sku="SECOND-SALE"
    )

    customer = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"first_name": "Branch", "last_name": "Customer", "phone": "9000090000"},
    )
    vendor = client.post(
        "/api/v1/vendors",
        headers=headers,
        json={"vendor_name": "Branch Vendor", "company_name": "Branch Vendor Co"},
    )
    assert customer.status_code == 201, customer.text
    assert vendor.status_code == 201, vendor.text
    assert customer.json()["shop_id"] == second.id
    assert vendor.json()["shop_id"] == second.id

    purchase_order = client.post(
        "/api/v1/purchase-orders",
        headers=headers,
        json={
            "vendor_id": vendor.json()["id"],
            "order_date": date.today().isoformat(),
            "status": "draft",
            "items": [
                {
                    "product_id": product["id"],
                    "ordered_quantity": 2,
                    "unit_cost": "10.00",
                }
            ],
        },
    )
    assert purchase_order.status_code == 201, purchase_order.text
    assert purchase_order.json()["shop_id"] == second.id

    invoice = client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "client_request_id": "same-key-per-branch",
            "customer": {
                "id": customer.json()["id"],
                "first_name": "Branch",
                "last_name": "Customer",
                "phone": "9000090000",
            },
            "items": [
                {
                    "product_id": product["id"],
                    "product_code": product["sku"],
                    "quantity": 1,
                    "selling_price_per_unit": "14.00",
                }
            ],
            "invoice_status": "saved",
            "payment_status": "pending",
        },
    )
    assert invoice.status_code == 201, invoice.text
    assert invoice.json()["shop_id"] == second.id

    preferred_headers = _token_headers(user)
    preferred_product = _create_api_product(
        client,
        preferred_headers,
        name="Preferred Branch Sale Item",
        sku="PREFERRED-SALE",
    )
    preferred_invoice = client.post(
        "/api/v1/invoices",
        headers=preferred_headers,
        json={
            "client_request_id": "same-key-per-branch",
            "customer": {"first_name": "Preferred", "phone": "9000090001"},
            "items": [
                {
                    "product_id": preferred_product["id"],
                    "product_code": preferred_product["sku"],
                    "quantity": 1,
                    "selling_price_per_unit": "14.00",
                }
            ],
            "invoice_status": "saved",
            "payment_status": "pending",
        },
    )
    assert preferred_invoice.status_code == 201, preferred_invoice.text
    assert preferred_invoice.json()["shop_id"] == user.shop_id
    assert preferred_invoice.json()["id"] != invoice.json()["id"]

    assert client.get(
        f"/api/v1/invoices/{preferred_invoice.json()['id']}", headers=headers
    ).status_code == 404
    assert client.get(
        f"/api/v1/vendors/{vendor.json()['id']}", headers=preferred_headers
    ).status_code == 404
    assert client.get(
        f"/api/v1/purchase-orders/{purchase_order.json()['id']}",
        headers=preferred_headers,
    ).status_code == 404


def test_inventory_and_financial_idempotency_scopes_include_branch():
    expected = {
        InvoiceIdempotencyKey: "uq_invoice_idempotency_shop_request",
        InvoicePayment: "uq_invoice_payments_shop_invoice_request",
        InvoiceReturn: "uq_invoice_returns_shop_request",
        StockAdjustmentRequest: "uq_stock_adjustment_requests_scope",
        GoodsReceipt: "uq_goods_receipts_request_scope",
        PurchaseReturn: "uq_purchase_returns_request_scope",
        VendorBillPayment: "uq_vendor_bill_payments_request_scope",
    }

    for model, constraint_name in expected.items():
        candidates = list(model.__table__.constraints) + list(model.__table__.indexes)
        constraint = next(item for item in candidates if item.name == constraint_name)
        assert "shop_id" in {column.name for column in constraint.columns}
