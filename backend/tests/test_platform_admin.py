"""A super admin is the platform owner, not a tenant.

Covers: shopless admin accounts, the shop-scoped route gate, and the shop-owner
business metrics the admin panel reports.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.user_status import UserRole, UserStatus
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.product import Product

# Routes that belong to shop accounts and must refuse a shopless admin.
SHOP_SCOPED_ROUTES = [
    "/api/v1/products",
    "/api/v1/products/stats",
    "/api/v1/products/categories",
    "/api/v1/dashboard/overview",
    "/api/v1/invoices",
    "/api/v1/invoices/stats",
    "/api/v1/customers",
    "/api/v1/customers/summary",
    "/api/v1/expenses",
    "/api/v1/expenses/analytics",
    "/api/v1/vendors",
    "/api/v1/vendors/stats",
    "/api/v1/reports/summary",
    "/api/v1/reports/cashflow",
]


@pytest.fixture()
def platform_admin(db_session, make_user):
    """A super admin with no shop, as the bootstrap script now creates them."""
    admin = make_user(
        email="platform@example.com",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        full_name="Platform Owner",
    )
    admin.shop_id = None
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture()
def platform_headers(platform_admin, auth_headers):
    return auth_headers("platform@example.com")


# ---------------------------------------------------------------------------
# Shopless admin
# ---------------------------------------------------------------------------

def test_shopless_admin_can_log_in(platform_admin, login):
    response = login("platform@example.com")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["shop_id"] is None
    assert body["shop_name"] is None
    assert body["role"] == UserRole.SUPER_ADMIN


def test_me_reports_no_shop_for_platform_admin(client, platform_headers):
    body = client.get("/api/v1/auth/me", headers=platform_headers).json()

    assert body["shop_id"] is None
    assert body["shop_name"] is None


def test_platform_admin_can_manage_own_profile(client, platform_headers):
    """Admins still own an account, even without a shop."""
    assert client.get("/api/v1/profile/me", headers=platform_headers).status_code == 200


@pytest.mark.parametrize("path", SHOP_SCOPED_ROUTES)
def test_shop_routes_refuse_a_shopless_admin(client, platform_headers, path):
    """A clear 403, not an empty list and not a 500."""
    response = client.get(path, headers=platform_headers)

    assert response.status_code == 403, f"{path} -> {response.status_code}"
    assert "shop" in response.json()["detail"].lower()


def test_shop_owners_are_unaffected_by_the_gate(client, make_user, auth_headers):
    """Regression guard: the new dependency must not touch ordinary users."""
    make_user(email="owner@example.com", status=UserStatus.ACTIVE)
    headers = auth_headers("owner@example.com")

    for path in SHOP_SCOPED_ROUTES:
        assert client.get(path, headers=headers).status_code == 200, path


def test_admin_routes_work_without_a_shop(client, platform_headers):
    """The whole point: platform administration needs no shop."""
    assert client.get("/api/v1/admin/stats", headers=platform_headers).status_code == 200
    assert client.get("/api/v1/admin/users", headers=platform_headers).status_code == 200
    assert (
        client.get("/api/v1/admin/audit-logs", headers=platform_headers).status_code
        == 200
    )


def test_shopless_admin_appears_without_shop_details(client, platform_admin, platform_headers):
    body = client.get(
        f"/api/v1/admin/users/{platform_admin.id}", headers=platform_headers
    ).json()

    assert body["has_shop"] is False
    assert body["shop_id"] is None
    assert body["shop_name"] is None
    # No fabricated trading figures for an account that does not trade.
    assert body["invoice_count"] == 0
    assert Decimal(str(body["total_revenue"])) == Decimal("0.00")


# ---------------------------------------------------------------------------
# Shop-owner business metrics
# ---------------------------------------------------------------------------

def _add_invoice(
    db_session,
    shop_id,
    *,
    final,
    profit,
    paid,
    remaining,
    invoice_date=None,
    status="saved",
    number="INV-1",
):
    db_session.add(
        Invoice(
            shop_id=shop_id,
            invoice_number=number,
            customer_name_snapshot="Walk-in",
            customer_phone_snapshot="9999999999",
            invoice_date=invoice_date or date.today(),
            final_amount=Decimal(final),
            total_profit=Decimal(profit),
            paid_amount=Decimal(paid),
            remaining_amount=Decimal(remaining),
            invoice_status=status,
            payment_status="paid" if Decimal(remaining) == 0 else "partial",
        )
    )
    db_session.commit()


def test_owner_row_reports_real_trading_figures(
    client, platform_headers, make_user, db_session
):
    owner = make_user(email="trader@example.com", status=UserStatus.ACTIVE)

    _add_invoice(
        db_session, owner.shop_id,
        final="1000.00", profit="250.00", paid="1000.00", remaining="0.00",
        number="INV-A",
    )
    _add_invoice(
        db_session, owner.shop_id,
        final="500.00", profit="100.00", paid="200.00", remaining="300.00",
        number="INV-B",
    )
    db_session.add(
        Product(shop_id=owner.shop_id, name="Rice", sku="R-1", category="Grocery")
    )
    db_session.add(
        Customer(
            shop_id=owner.shop_id,
            first_name="Asha",
            full_name="Asha",
            phone="8888888888",
        )
    )
    db_session.commit()

    body = client.get(
        "/api/v1/admin/users?search=trader", headers=platform_headers
    ).json()
    row = body["items"][0]

    assert row["invoice_count"] == 2
    assert Decimal(str(row["total_revenue"])) == Decimal("1500.00")
    assert Decimal(str(row["total_profit"])) == Decimal("350.00")
    assert Decimal(str(row["collected_amount"])) == Decimal("1200.00")
    assert Decimal(str(row["outstanding_amount"])) == Decimal("300.00")
    assert row["product_count"] == 1
    assert row["customer_count"] == 1
    assert row["last_invoice_date"] is not None
    assert row["has_shop"] is True


def test_cancelled_invoices_are_excluded_from_metrics(
    client, platform_headers, make_user, db_session
):
    """Matches how the shop owner's own reports treat cancellations."""
    owner = make_user(email="cancels@example.com", status=UserStatus.ACTIVE)

    _add_invoice(
        db_session, owner.shop_id,
        final="1000.00", profit="200.00", paid="1000.00", remaining="0.00",
        number="INV-LIVE",
    )
    _add_invoice(
        db_session, owner.shop_id,
        final="9999.00", profit="9999.00", paid="0.00", remaining="9999.00",
        status="cancelled", number="INV-DEAD",
    )

    row = client.get(
        "/api/v1/admin/users?search=cancels", headers=platform_headers
    ).json()["items"][0]

    assert row["invoice_count"] == 1
    assert Decimal(str(row["total_revenue"])) == Decimal("1000.00")


def test_owner_with_no_sales_reports_zeros_not_nulls(
    client, platform_headers, make_user
):
    make_user(email="quiet@example.com", status=UserStatus.ACTIVE)

    row = client.get(
        "/api/v1/admin/users?search=quiet", headers=platform_headers
    ).json()["items"][0]

    assert row["invoice_count"] == 0
    assert Decimal(str(row["total_revenue"])) == Decimal("0.00")
    assert row["last_invoice_date"] is None


def test_user_detail_includes_performance_and_shop_context(
    client, platform_headers, make_user, db_session
):
    owner = make_user(email="detail2@example.com", status=UserStatus.ACTIVE)
    _add_invoice(
        db_session, owner.shop_id,
        final="750.00", profit="150.00", paid="750.00", remaining="0.00",
        number="INV-D",
    )

    body = client.get(
        f"/api/v1/admin/users/{owner.id}", headers=platform_headers
    ).json()

    assert body["has_shop"] is True
    assert body["shop_name"]
    assert body["shop_category"]
    assert Decimal(str(body["total_revenue"])) == Decimal("750.00")
    assert Decimal(str(body["total_profit"])) == Decimal("150.00")


# ---------------------------------------------------------------------------
# Platform totals
# ---------------------------------------------------------------------------

def test_platform_stats_aggregate_every_shop(
    client, platform_headers, make_user, db_session
):
    first = make_user(email="s1@example.com", status=UserStatus.ACTIVE)
    second = make_user(email="s2@example.com", status=UserStatus.ACTIVE)

    _add_invoice(
        db_session, first.shop_id,
        final="1000.00", profit="300.00", paid="600.00", remaining="400.00",
        number="INV-1",
    )
    _add_invoice(
        db_session, second.shop_id,
        final="2000.00", profit="500.00", paid="2000.00", remaining="0.00",
        number="INV-2",
    )

    body = client.get("/api/v1/admin/stats", headers=platform_headers).json()

    assert body["platform_invoice_count"] == 2
    assert Decimal(str(body["platform_revenue"])) == Decimal("3000.00")
    assert Decimal(str(body["platform_profit"])) == Decimal("800.00")
    assert Decimal(str(body["platform_collected"])) == Decimal("2600.00")
    assert Decimal(str(body["platform_outstanding"])) == Decimal("400.00")

    # Shop owners are counted separately from platform administrators.
    assert body["shop_owner_count"] == 2
    assert body["super_admin_count"] == 1


def test_top_shops_rank_by_revenue_and_name_the_owner(
    client, platform_headers, make_user, db_session
):
    small = make_user(email="small@example.com", status=UserStatus.ACTIVE)
    big = make_user(email="big@example.com", status=UserStatus.ACTIVE)

    _add_invoice(
        db_session, small.shop_id,
        final="100.00", profit="10.00", paid="100.00", remaining="0.00",
        number="INV-S",
    )
    _add_invoice(
        db_session, big.shop_id,
        final="5000.00", profit="900.00", paid="5000.00", remaining="0.00",
        number="INV-B",
    )

    body = client.get("/api/v1/admin/stats", headers=platform_headers).json()
    top = body["top_shops"]

    assert len(top) == 2
    assert top[0]["owner_email"] == "big@example.com"
    assert Decimal(str(top[0]["total_revenue"])) == Decimal("5000.00")
    assert top[0]["owner_user_id"] == big.id
    assert top[1]["owner_email"] == "small@example.com"


def test_revenue_last_7_days_window(
    client, platform_headers, make_user, db_session
):
    owner = make_user(email="window@example.com", status=UserStatus.ACTIVE)

    _add_invoice(
        db_session, owner.shop_id,
        final="400.00", profit="40.00", paid="400.00", remaining="0.00",
        invoice_date=date.today(), number="INV-NEW",
    )
    _add_invoice(
        db_session, owner.shop_id,
        final="900.00", profit="90.00", paid="900.00", remaining="0.00",
        invoice_date=date.today() - timedelta(days=60), number="INV-OLD",
    )

    body = client.get("/api/v1/admin/stats", headers=platform_headers).json()

    # Lifetime revenue counts both; the 7-day window counts only the recent one.
    assert Decimal(str(body["platform_revenue"])) == Decimal("1300.00")
    assert Decimal(str(body["platform_revenue_last_7_days"])) == Decimal("400.00")


def test_platform_stats_are_zero_on_an_empty_platform(client, platform_headers):
    body = client.get("/api/v1/admin/stats", headers=platform_headers).json()

    assert body["platform_invoice_count"] == 0
    assert Decimal(str(body["platform_revenue"])) == Decimal("0.00")
    assert body["top_shops"] == []


def test_metrics_are_not_reachable_by_a_shop_owner(client, make_user, auth_headers):
    """One owner must never see another's revenue."""
    make_user(email="nosy2@example.com", status=UserStatus.ACTIVE)

    assert client.get(
        "/api/v1/admin/users", headers=auth_headers("nosy2@example.com")
    ).status_code == 403
    assert client.get(
        "/api/v1/admin/stats", headers=auth_headers("nosy2@example.com")
    ).status_code == 403
