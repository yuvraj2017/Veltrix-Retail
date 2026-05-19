from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.product import Product
from app.models.user import User
from app.schemas.dashboard import (
    DashboardOverviewResponse,
    DashboardStat,
    LowStockProductItem,
    RecentBillItem,
    RevenueProfitPoint,
    SalesTrendPoint,
)


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _format_currency(value: Decimal) -> str:
    value = _to_decimal(value)
    return f"₹{value:,.0f}" if value == value.quantize(Decimal("1")) else f"₹{value:,.2f}"


def _format_change(current: Decimal, previous: Decimal) -> tuple[str, bool]:
    current = _to_decimal(current)
    previous = _to_decimal(previous)

    if previous <= Decimal("0.00"):
        if current > Decimal("0.00"):
            return "+100.0%", True
        return "0.0%", True

    change_pct = ((current - previous) / previous) * Decimal("100")
    positive = change_pct >= Decimal("0.00")
    sign = "+" if positive else ""
    return f"{sign}{change_pct.quantize(Decimal('0.1'))}%", positive


def _format_bill_status(status: str | None) -> str:
    mapping = {
        "paid": "PAID",
        "pending": "PENDING",
        "partial": "PARTIAL",
        "overdue": "OVERDUE",
    }
    if not status:
        return "PENDING"
    return mapping.get(status.lower(), status.upper())


def _get_greeting_name(current_user: User) -> str:
    if getattr(current_user, "first_name", None):
        return current_user.first_name
    if getattr(current_user, "full_name", None):
        return current_user.full_name.split()[0]
    return "Merchant"


def get_dashboard_overview(db: Session, current_user: User) -> DashboardOverviewResponse:
    shop_id = current_user.shop_id
    today = date.today()
    last_7_start = today - timedelta(days=6)
    previous_7_start = today - timedelta(days=13)
    previous_7_end = today - timedelta(days=7)

    # -----------------------------
    # SALES / REVENUE / PROFIT
    # -----------------------------
    today_sales = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date == today,
        )
        .scalar()
    )

    weekly_sales = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date >= last_7_start,
            Invoice.invoice_date <= today,
        )
        .scalar()
    )

    previous_week_sales = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date >= previous_7_start,
            Invoice.invoice_date <= previous_7_end,
        )
        .scalar()
    )

    total_revenue = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
        .filter(Invoice.shop_id == shop_id)
        .scalar()
    )

    total_profit = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.total_profit), 0))
        .filter(Invoice.shop_id == shop_id)
        .scalar()
    )

    previous_total_revenue = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date < last_7_start,
        )
        .scalar()
    )

    previous_total_profit = _to_decimal(
        db.query(func.coalesce(func.sum(Invoice.total_profit), 0))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date < last_7_start,
        )
        .scalar()
    )

    today_change, today_positive = _format_change(today_sales, previous_week_sales / Decimal("7") if previous_week_sales > 0 else Decimal("0"))
    weekly_change, weekly_positive = _format_change(weekly_sales, previous_week_sales)
    revenue_change, revenue_positive = _format_change(total_revenue, previous_total_revenue)
    profit_change, profit_positive = _format_change(total_profit, previous_total_profit)

    # -----------------------------
    # LOW STOCK
    # -----------------------------
    low_stock_products = (
        db.query(Product)
        .filter(
            Product.shop_id == shop_id,
            Product.is_active == True,  # noqa: E712
            Product.stock_quantity <= Product.low_stock_threshold,
        )
        .order_by(Product.stock_quantity.asc(), Product.name.asc())
        .limit(5)
        .all()
    )

    low_stock_count = (
        db.query(func.count(Product.id))
        .filter(
            Product.shop_id == shop_id,
            Product.is_active == True,  # noqa: E712
            Product.stock_quantity <= Product.low_stock_threshold,
        )
        .scalar()
    ) or 0

    # -----------------------------
    # SALES TRENDS - LAST 7 DAYS
    # -----------------------------
    trend_rows = (
        db.query(
            Invoice.invoice_date,
            func.coalesce(func.sum(Invoice.final_amount), 0).label("total"),
        )
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_date >= last_7_start,
            Invoice.invoice_date <= today,
        )
        .group_by(Invoice.invoice_date)
        .order_by(Invoice.invoice_date.asc())
        .all()
    )

    trend_map = {row.invoice_date: float(_to_decimal(row.total)) for row in trend_rows}

    sales_trends: list[SalesTrendPoint] = []
    for i in range(7):
        day = last_7_start + timedelta(days=i)
        sales_trends.append(
            SalesTrendPoint(
                label=day.strftime("%a").upper()[:3],
                value=trend_map.get(day, 0.0),
            )
        )

    # -----------------------------
    # REVENUE VS PROFIT - QUARTERS + YTD
    # -----------------------------
    year_start = date(today.year, 1, 1)
    quarter_ranges = [
        ("Q1", date(today.year, 1, 1), date(today.year, 3, 31)),
        ("Q2", date(today.year, 4, 1), date(today.year, 6, 30)),
        ("Q3", date(today.year, 7, 1), date(today.year, 9, 30)),
        ("Q4", date(today.year, 10, 1), date(today.year, 12, 31)),
    ]

    revenue_profit_points: list[RevenueProfitPoint] = []

    ytd_revenue = Decimal("0.00")
    ytd_profit = Decimal("0.00")

    for label, start_date, end_date in quarter_ranges:
        revenue = _to_decimal(
            db.query(func.coalesce(func.sum(Invoice.final_amount), 0))
            .filter(
                Invoice.shop_id == shop_id,
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
            )
            .scalar()
        )

        profit = _to_decimal(
            db.query(func.coalesce(func.sum(Invoice.total_profit), 0))
            .filter(
                Invoice.shop_id == shop_id,
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
            )
            .scalar()
        )

        ytd_revenue += revenue
        ytd_profit += profit

        revenue_profit_points.append(
            RevenueProfitPoint(
                label=label,
                revenue=float(revenue),
                profit=float(profit),
            )
        )

    revenue_profit_points.append(
        RevenueProfitPoint(
            label="YTD",
            revenue=float(ytd_revenue),
            profit=float(ytd_profit),
        )
    )

    # -----------------------------
    # RECENT BILLS / INVOICES
    # -----------------------------
    recent_invoice_rows = (
        db.query(Invoice)
        .filter(Invoice.shop_id == shop_id)
        .order_by(Invoice.created_at.desc())
        .limit(6)
        .all()
    )

    recent_bills = [
        RecentBillItem(
            id=invoice.invoice_number,
            date=invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "-",
            amount=_format_currency(_to_decimal(invoice.final_amount)),
            status=_format_bill_status(invoice.payment_status),
        )
        for invoice in recent_invoice_rows
    ]

    # -----------------------------
    # LOW STOCK LIST RESPONSE
    # -----------------------------
    low_stock_list = [
        LowStockProductItem(
            id=str(product.id),
            name=product.name,
            sku=product.sku,
            left=int(product.stock_quantity or 0),
            image=product.main_image_url,
        )
        for product in low_stock_products
    ]

    # -----------------------------
    # PERFORMANCE LABEL
    # -----------------------------
    if previous_week_sales > 0:
        performance_pct = ((weekly_sales / previous_week_sales) * Decimal("100")).quantize(Decimal("0.1"))
        performance_label = f"Your store is performing at {performance_pct}% this week."
    elif weekly_sales > 0:
        performance_label = "Your store has started generating live sales activity this week."
    else:
        performance_label = "Your store insights will appear here as soon as invoices and products are active."

    stats = [
        DashboardStat(
            title="TODAY SALES",
            value=_format_currency(today_sales),
            change=today_change,
            positive=today_positive,
        ),
        DashboardStat(
            title="WEEKLY SALES",
            value=_format_currency(weekly_sales),
            change=weekly_change,
            positive=weekly_positive,
        ),
        DashboardStat(
            title="REVENUE",
            value=_format_currency(total_revenue),
            change=revenue_change,
            positive=revenue_positive,
        ),
        DashboardStat(
            title="PROFIT",
            value=_format_currency(total_profit),
            change=profit_change,
            positive=profit_positive,
        ),
        DashboardStat(
            title="LOW STOCK",
            value=f"{low_stock_count} Items",
            change="Requires reorder" if low_stock_count > 0 else "Inventory healthy",
            positive=False,
            highlight=low_stock_count > 0,
            warning_label="WARNING" if low_stock_count > 0 else None,
        ),
    ]

    return DashboardOverviewResponse(
        greeting_name=_get_greeting_name(current_user),
        performance_label=performance_label,
        stats=stats,
        sales_trends=sales_trends,
        revenue_profit=revenue_profit_points,
        recent_bills=recent_bills,
        low_stock_products=low_stock_list,
    )