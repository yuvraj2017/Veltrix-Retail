"""Stable tenant permission vocabulary and endpoint authorization policies."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.membership import MembershipRole


class Permission:
    DASHBOARD_VIEW = "dashboard.view"

    PRODUCTS_VIEW = "products.view"
    PRODUCTS_MANAGE = "products.manage"

    INVENTORY_VIEW = "inventory.view"
    INVENTORY_ADJUST = "inventory.adjust"
    INVENTORY_COUNT = "inventory.count"
    INVENTORY_EXPORT = "inventory.export"

    SALES_VIEW = "sales.view"
    SALES_CREATE = "sales.create"
    SALES_PAYMENT = "sales.payment"
    SALES_RETURN = "sales.return"
    SALES_REFUND = "sales.refund"
    SALES_CANCEL = "sales.cancel"

    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_MANAGE = "customers.manage"

    PURCHASING_VIEW = "purchasing.view"
    PURCHASING_MANAGE = "purchasing.manage"
    PURCHASING_RECEIVE = "purchasing.receive"
    PURCHASING_RETURN = "purchasing.return"

    VENDORS_VIEW = "vendors.view"
    VENDORS_MANAGE = "vendors.manage"

    PAYABLES_VIEW = "payables.view"
    PAYABLES_MANAGE = "payables.manage"
    PAYABLES_PAYMENT = "payables.payment"

    EXPENSES_VIEW = "expenses.view"
    EXPENSES_MANAGE = "expenses.manage"

    REPORTS_VIEW = "reports.view"
    REPORTS_EXPORT = "reports.export"

    AUDIT_VIEW = "audit.view"

    SETTINGS_VIEW = "settings.view"
    SETTINGS_MANAGE = "settings.manage"

    STAFF_VIEW = "staff.view"
    STAFF_MANAGE = "staff.manage"

    SUBSCRIPTION_VIEW = "subscription.view"
    SUBSCRIPTION_MANAGE = "subscription.manage"

    OWNERSHIP_TRANSFER = "ownership.transfer"

    ALL = (
        DASHBOARD_VIEW,
        PRODUCTS_VIEW,
        PRODUCTS_MANAGE,
        INVENTORY_VIEW,
        INVENTORY_ADJUST,
        INVENTORY_COUNT,
        INVENTORY_EXPORT,
        SALES_VIEW,
        SALES_CREATE,
        SALES_PAYMENT,
        SALES_RETURN,
        SALES_REFUND,
        SALES_CANCEL,
        CUSTOMERS_VIEW,
        CUSTOMERS_MANAGE,
        PURCHASING_VIEW,
        PURCHASING_MANAGE,
        PURCHASING_RECEIVE,
        PURCHASING_RETURN,
        VENDORS_VIEW,
        VENDORS_MANAGE,
        PAYABLES_VIEW,
        PAYABLES_MANAGE,
        PAYABLES_PAYMENT,
        EXPENSES_VIEW,
        EXPENSES_MANAGE,
        REPORTS_VIEW,
        REPORTS_EXPORT,
        AUDIT_VIEW,
        SETTINGS_VIEW,
        SETTINGS_MANAGE,
        STAFF_VIEW,
        STAFF_MANAGE,
        SUBSCRIPTION_VIEW,
        SUBSCRIPTION_MANAGE,
        OWNERSHIP_TRANSFER,
    )


_ALL = frozenset(Permission.ALL)
_OPERATIONAL_ADMIN = _ALL - {
    Permission.OWNERSHIP_TRANSFER,
    Permission.SUBSCRIPTION_MANAGE,
}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    MembershipRole.OWNER: _ALL,
    MembershipRole.ADMIN: _OPERATIONAL_ADMIN,
    MembershipRole.MANAGER: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.PRODUCTS_VIEW,
            Permission.PRODUCTS_MANAGE,
            Permission.INVENTORY_VIEW,
            Permission.INVENTORY_ADJUST,
            Permission.INVENTORY_COUNT,
            Permission.INVENTORY_EXPORT,
            Permission.SALES_VIEW,
            Permission.SALES_CREATE,
            Permission.SALES_PAYMENT,
            Permission.SALES_RETURN,
            Permission.SALES_REFUND,
            Permission.SALES_CANCEL,
            Permission.CUSTOMERS_VIEW,
            Permission.CUSTOMERS_MANAGE,
            Permission.PURCHASING_VIEW,
            Permission.PURCHASING_MANAGE,
            Permission.PURCHASING_RECEIVE,
            Permission.PURCHASING_RETURN,
            Permission.VENDORS_VIEW,
            Permission.VENDORS_MANAGE,
            Permission.PAYABLES_VIEW,
            Permission.PAYABLES_MANAGE,
            Permission.PAYABLES_PAYMENT,
            Permission.EXPENSES_VIEW,
            Permission.EXPENSES_MANAGE,
            Permission.REPORTS_VIEW,
            Permission.REPORTS_EXPORT,
            Permission.AUDIT_VIEW,
            Permission.SETTINGS_VIEW,
            Permission.SUBSCRIPTION_VIEW,
        }
    ),
    MembershipRole.CASHIER: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.PRODUCTS_VIEW,
            Permission.SALES_VIEW,
            Permission.SALES_CREATE,
            Permission.SALES_PAYMENT,
            Permission.SALES_RETURN,
            Permission.CUSTOMERS_VIEW,
            Permission.CUSTOMERS_MANAGE,
        }
    ),
    MembershipRole.INVENTORY_MANAGER: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.PRODUCTS_VIEW,
            Permission.PRODUCTS_MANAGE,
            Permission.INVENTORY_VIEW,
            Permission.INVENTORY_ADJUST,
            Permission.INVENTORY_COUNT,
            Permission.INVENTORY_EXPORT,
            Permission.PURCHASING_VIEW,
            Permission.VENDORS_VIEW,
        }
    ),
    MembershipRole.PURCHASING_MANAGER: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.PRODUCTS_VIEW,
            Permission.INVENTORY_VIEW,
            Permission.PURCHASING_VIEW,
            Permission.PURCHASING_MANAGE,
            Permission.PURCHASING_RECEIVE,
            Permission.PURCHASING_RETURN,
            Permission.VENDORS_VIEW,
            Permission.VENDORS_MANAGE,
            Permission.PAYABLES_VIEW,
            Permission.PAYABLES_MANAGE,
            Permission.REPORTS_VIEW,
            Permission.REPORTS_EXPORT,
        }
    ),
    MembershipRole.REPORT_VIEWER: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.PRODUCTS_VIEW,
            Permission.INVENTORY_VIEW,
            Permission.INVENTORY_EXPORT,
            Permission.SALES_VIEW,
            Permission.CUSTOMERS_VIEW,
            Permission.PURCHASING_VIEW,
            Permission.VENDORS_VIEW,
            Permission.PAYABLES_VIEW,
            Permission.EXPENSES_VIEW,
            Permission.REPORTS_VIEW,
            Permission.REPORTS_EXPORT,
        }
    ),
}


def permissions_for_role(role: str) -> frozenset[str]:
    try:
        return ROLE_PERMISSIONS[role]
    except KeyError as exc:
        raise ValueError("Unsupported organization membership role") from exc


@dataclass(frozen=True, slots=True)
class EndpointPermissionPolicy:
    permission: str
    require_entitlement: bool = True


def _policy(permission: str, *, entitlement: bool = True) -> EndpointPermissionPolicy:
    return EndpointPermissionPolicy(permission, entitlement)


# Endpoint function names are stable within this API and avoid coupling policy
# to URL formatting details. The coverage test requires every tenant endpoint
# to appear here, so a new route cannot silently inherit owner-level access.
ENDPOINT_PERMISSION_POLICIES: dict[str, EndpointPermissionPolicy] = {
    # Dashboard and audit
    "dashboard_overview": _policy(Permission.DASHBOARD_VIEW),
    "list_my_business_audit_logs": _policy(Permission.AUDIT_VIEW),
    # Billing product lookup
    "search_products_for_billing": _policy(Permission.PRODUCTS_VIEW),
    "get_product_for_billing_by_code": _policy(Permission.PRODUCTS_VIEW),
    # Products
    "create_product_endpoint": _policy(Permission.PRODUCTS_MANAGE),
    "list_products_endpoint": _policy(Permission.PRODUCTS_VIEW),
    "list_product_categories_endpoint": _policy(Permission.PRODUCTS_VIEW),
    "product_stats_endpoint": _policy(Permission.PRODUCTS_VIEW),
    "get_product_endpoint": _policy(Permission.PRODUCTS_VIEW),
    "update_product_endpoint": _policy(Permission.PRODUCTS_MANAGE),
    "delete_product_endpoint": _policy(Permission.PRODUCTS_MANAGE),
    "delete_product_image_endpoint": _policy(Permission.PRODUCTS_MANAGE),
    # Customers
    "search_existing_customers": _policy(Permission.CUSTOMERS_VIEW),
    "get_customer_directory": _policy(Permission.CUSTOMERS_VIEW),
    "get_customer_summary_endpoint": _policy(Permission.CUSTOMERS_VIEW),
    "get_customer_charts_endpoint": _policy(Permission.CUSTOMERS_VIEW),
    "get_customer_insights_endpoint": _policy(Permission.CUSTOMERS_VIEW),
    "add_customer": _policy(Permission.CUSTOMERS_MANAGE),
    "get_single_customer_analytics": _policy(Permission.CUSTOMERS_VIEW),
    "get_single_customer": _policy(Permission.CUSTOMERS_VIEW),
    "edit_customer": _policy(Permission.CUSTOMERS_MANAGE),
    # Inventory
    "inventory_summary": _policy(Permission.INVENTORY_VIEW),
    "inventory_products": _policy(Permission.INVENTORY_VIEW),
    "inventory_movements": _policy(Permission.INVENTORY_VIEW),
    "inventory_reconciliation_report": _policy(Permission.INVENTORY_VIEW),
    "inventory_activity": _policy(Permission.INVENTORY_VIEW),
    "inventory_purchasing_report": _policy(Permission.PURCHASING_VIEW),
    "vendor_purchasing_insights": _policy(Permission.PURCHASING_VIEW),
    "product_inventory_detail": _policy(Permission.INVENTORY_VIEW),
    "export_inventory_report": _policy(Permission.INVENTORY_EXPORT),
    "adjust_product_stock": _policy(Permission.INVENTORY_ADJUST),
    "record_product_physical_count": _policy(Permission.INVENTORY_COUNT),
    "product_stock_history": _policy(Permission.INVENTORY_VIEW),
    "stock_reconciliation": _policy(Permission.INVENTORY_VIEW),
    # Sales and invoice lifecycle
    "get_invoices": _policy(Permission.SALES_VIEW),
    "invoice_stats": _policy(Permission.SALES_VIEW),
    "add_invoice": _policy(Permission.SALES_CREATE),
    "get_single_invoice": _policy(Permission.SALES_VIEW),
    "edit_invoice": _policy(Permission.SALES_CREATE),
    "remove_invoice": _policy(Permission.SALES_CANCEL),
    "cancel_single_invoice": _policy(Permission.SALES_CANCEL),
    "preview_invoice": _policy(Permission.SALES_VIEW),
    "get_invoice_payments": _policy(Permission.SALES_VIEW),
    "record_invoice_payment": _policy(Permission.SALES_PAYMENT),
    "get_invoice_returns": _policy(Permission.SALES_VIEW),
    "create_return": _policy(Permission.SALES_RETURN),
    "create_refund": _policy(Permission.SALES_REFUND),
    "get_invoice_pdf": _policy(Permission.SALES_VIEW),
    "download_invoice": _policy(Permission.SALES_VIEW),
    "share_invoice": _policy(Permission.SALES_VIEW),
    # Expenses
    "create_expense_endpoint": _policy(Permission.EXPENSES_MANAGE),
    "list_expenses_endpoint": _policy(Permission.EXPENSES_VIEW),
    "expense_analytics_endpoint": _policy(Permission.EXPENSES_VIEW),
    "update_expense_endpoint": _policy(Permission.EXPENSES_MANAGE),
    "delete_expense_endpoint": _policy(Permission.EXPENSES_MANAGE),
    # Purchasing
    "add_purchase_order": _policy(Permission.PURCHASING_MANAGE),
    "get_purchase_orders": _policy(Permission.PURCHASING_VIEW),
    "get_single_purchase_order": _policy(Permission.PURCHASING_VIEW),
    "edit_purchase_order": _policy(Permission.PURCHASING_MANAGE),
    "cancel_single_purchase_order": _policy(Permission.PURCHASING_MANAGE),
    "receive_purchase_order": _policy(Permission.PURCHASING_RECEIVE),
    "get_purchase_order_receipts": _policy(Permission.PURCHASING_VIEW),
    "get_return_eligibility": _policy(Permission.PURCHASING_VIEW),
    "return_purchase_order_goods": _policy(Permission.PURCHASING_RETURN),
    "get_purchase_order_returns": _policy(Permission.PURCHASING_VIEW),
    # Vendors and payables
    "get_vendors": _policy(Permission.VENDORS_VIEW),
    "add_vendor": _policy(Permission.VENDORS_MANAGE),
    "vendor_stats": _policy(Permission.VENDORS_VIEW),
    "get_single_vendor": _policy(Permission.VENDORS_VIEW),
    "edit_vendor": _policy(Permission.VENDORS_MANAGE),
    "remove_vendor": _policy(Permission.VENDORS_MANAGE),
    "vendor_summary": _policy(Permission.VENDORS_VIEW),
    "get_vendor_credits": _policy(Permission.PAYABLES_VIEW),
    "get_bills_for_vendor": _policy(Permission.PAYABLES_VIEW),
    "add_bill_for_vendor": _policy(Permission.PAYABLES_MANAGE),
    "get_single_bill": _policy(Permission.PAYABLES_VIEW),
    "edit_bill": _policy(Permission.PAYABLES_MANAGE),
    "get_bill_payments": _policy(Permission.PAYABLES_VIEW),
    "add_payment_to_bill": _policy(Permission.PAYABLES_PAYMENT),
    # Reports
    "get_reports_summary": _policy(Permission.REPORTS_VIEW),
    "get_reports_sales_profit": _policy(Permission.REPORTS_VIEW),
    "get_reports_cashflow": _policy(Permission.REPORTS_VIEW),
    "get_reports_category_performance": _policy(Permission.REPORTS_VIEW),
    "get_reports_customer_insights": _policy(Permission.REPORTS_VIEW),
    "get_reports_payment_insights": _policy(Permission.REPORTS_VIEW),
    # Shop settings
    "get_shop_endpoint": _policy(Permission.SETTINGS_VIEW),
    "update_shop_endpoint": _policy(Permission.SETTINGS_MANAGE),
    # Subscription recovery intentionally bypasses commercial entitlement only.
    "get_my_subscription": _policy(Permission.SUBSCRIPTION_VIEW, entitlement=False),
    "list_available_plans": _policy(Permission.SUBSCRIPTION_VIEW, entitlement=False),
    "create_checkout_session": _policy(Permission.SUBSCRIPTION_MANAGE, entitlement=False),
    "verify_razorpay_payment": _policy(Permission.SUBSCRIPTION_MANAGE, entitlement=False),
    "submit_upi_payment_reference": _policy(Permission.SUBSCRIPTION_MANAGE, entitlement=False),
}


# Deliberate non-tenant policies used by the endpoint coverage test.
PUBLIC_ENDPOINTS = frozenset(
    {
        "register",
        "login",
        "forgot_password",
        "validate_reset_password_token",
        "reset_password_endpoint",
        "razorpay_webhook",
    }
)
AUTHENTICATION_ONLY_ENDPOINTS = frozenset(
    {
        "me",
        "get_profile_endpoint",
        "update_profile_endpoint",
        "change_password_endpoint",
    }
)

