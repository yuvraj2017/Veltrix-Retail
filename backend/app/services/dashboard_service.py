from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.invoice_return import InvoiceReturn
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


def _active_invoice_filters(shop_id: int):
    return (
        Invoice.shop_id == shop_id,
        Invoice.invoice_status != "cancelled",
    )


def _return_totals(db: Session, shop_id: int, start_date: date | None = None, end_date: date | None = None):
    filters = [
        InvoiceReturn.shop_id == shop_id,
        InvoiceReturn.status == "completed",
        Invoice.invoice_status != "cancelled",
    ]
    if start_date is not None:
        filters.append(Invoice.invoice_date >= start_date)
    if end_date is not None:
        filters.append(Invoice.invoice_date <= end_date)
    row = (
        db.query(
            func.coalesce(func.sum(InvoiceReturn.total_amount), 0).label("amount"),
            func.coalesce(func.sum(InvoiceReturn.total_profit), 0).label("profit"),
        )
        .join(Invoice, Invoice.id == InvoiceReturn.invoice_id)
        .filter(*filters)
        .one()
    )
    return _to_decimal(row.amount), _to_decimal(row.profit)


def get_dashboard_overview(db: Session, current_user: User) -> DashboardOverviewResponse:
    shop_id = current_user.shop_id
    today = date.today()
    last_7_start = today - timedelta(days=6)
    previous_7_start = today - timedelta(days=13)
    previous_7_end = today - timedelta(days=7)

    # -----------------------------
    # SALES / REVENUE / PROFIT
    # -----------------------------
    # One pass over this shop's invoices produces every scalar figure below.
    # Postgres FILTER clauses let each SUM apply its own date predicate, which
    # replaces what used to be seven separate round trips.
    #
    totals_row = (
        db.query(
            func.coalesce(
                func.sum(Invoice.final_amount).filter(Invoice.invoice_date == today), 0
            ).label("today_sales"),
            func.coalesce(
                func.sum(Invoice.final_amount).filter(
                    Invoice.invoice_date >= last_7_start,
                    Invoice.invoice_date <= today,
                ),
                0,
            ).label("weekly_sales"),
            func.coalesce(
                func.sum(Invoice.final_amount).filter(
                    Invoice.invoice_date >= previous_7_start,
                    Invoice.invoice_date <= previous_7_end,
                ),
                0,
            ).label("previous_week_sales"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("total_revenue"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("total_profit"),
            func.coalesce(
                func.sum(Invoice.final_amount).filter(
                    Invoice.invoice_date < last_7_start
                ),
                0,
            ).label("previous_total_revenue"),
            func.coalesce(
                func.sum(Invoice.total_profit).filter(
                    Invoice.invoice_date < last_7_start
                ),
                0,
            ).label("previous_total_profit"),
        )
        .filter(*_active_invoice_filters(shop_id))
        .one()
    )

    today_return, today_return_profit = _return_totals(db, shop_id, today, today)
    weekly_return, weekly_return_profit = _return_totals(db, shop_id, last_7_start, today)
    previous_week_return, _previous_week_return_profit = _return_totals(db, shop_id, previous_7_start, previous_7_end)
    total_return, total_return_profit = _return_totals(db, shop_id)
    previous_total_return, previous_total_return_profit = _return_totals(db, shop_id, None, last_7_start - timedelta(days=1))

    today_sales = max(_to_decimal(totals_row.today_sales) - today_return, Decimal("0.00"))
    weekly_sales = max(_to_decimal(totals_row.weekly_sales) - weekly_return, Decimal("0.00"))
    previous_week_sales = max(_to_decimal(totals_row.previous_week_sales) - previous_week_return, Decimal("0.00"))
    total_revenue = max(_to_decimal(totals_row.total_revenue) - total_return, Decimal("0.00"))
    total_profit = _to_decimal(totals_row.total_profit) - total_return_profit
    previous_total_revenue = max(_to_decimal(totals_row.previous_total_revenue) - previous_total_return, Decimal("0.00"))
    previous_total_profit = _to_decimal(totals_row.previous_total_profit) - previous_total_return_profit

    today_change, today_positive = _format_change(today_sales, previous_week_sales / Decimal("7") if previous_week_sales > 0 else Decimal("0"))
    weekly_change, weekly_positive = _format_change(weekly_sales, previous_week_sales)
    revenue_change, revenue_positive = _format_change(total_revenue, previous_total_revenue)
    profit_change, profit_positive = _format_change(total_profit, previous_total_profit)

    # -----------------------------
    # LOW STOCK
    # -----------------------------
    # COUNT(*) OVER () is evaluated before LIMIT, so the same query yields both
    # the top 5 rows and the total number of low-stock products.
    low_stock_rows = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Product.stock_quantity,
            Product.main_image_url,
            func.count().over().label("total_count"),
        )
        .filter(
            Product.shop_id == shop_id,
            Product.is_active == True,  # noqa: E712
            Product.stock_quantity <= Product.low_stock_threshold,
        )
        .order_by(Product.stock_quantity.asc(), Product.name.asc())
        .limit(5)
        .all()
    )

    low_stock_count = low_stock_rows[0].total_count if low_stock_rows else 0

    # -----------------------------
    # SALES TRENDS - LAST 7 DAYS
    # -----------------------------
    trend_rows = (
        db.query(
            Invoice.invoice_date,
            func.coalesce(func.sum(Invoice.final_amount), 0).label("total"),
        )
        .filter(
            *_active_invoice_filters(shop_id),
            Invoice.invoice_date >= last_7_start,
            Invoice.invoice_date <= today,
        )
        .group_by(Invoice.invoice_date)
        .order_by(Invoice.invoice_date.asc())
        .all()
    )

    trend_map = {row.invoice_date: _to_decimal(row.total) for row in trend_rows}
    return_trend_rows = (
        db.query(
            Invoice.invoice_date,
            func.coalesce(func.sum(InvoiceReturn.total_amount), 0).label("total"),
        )
        .join(Invoice, Invoice.id == InvoiceReturn.invoice_id)
        .filter(
            InvoiceReturn.shop_id == shop_id,
            InvoiceReturn.status == "completed",
            Invoice.invoice_status != "cancelled",
            Invoice.invoice_date >= last_7_start,
            Invoice.invoice_date <= today,
        )
        .group_by(Invoice.invoice_date)
        .all()
    )
    for row in return_trend_rows:
        trend_map[row.invoice_date] = max(
            trend_map.get(row.invoice_date, Decimal("0.00")) - _to_decimal(row.total),
            Decimal("0.00"),
        )

    sales_trends: list[SalesTrendPoint] = []
    for i in range(7):
        day = last_7_start + timedelta(days=i)
        sales_trends.append(
            SalesTrendPoint(
                label=day.strftime("%a").upper()[:3],
                value=float(trend_map.get(day, Decimal("0.00"))),
            )
        )

    # -----------------------------
    # REVENUE VS PROFIT - QUARTERS + YTD
    # -----------------------------
    # A single GROUP BY over the calendar year replaces eight separate
    # per-quarter aggregate queries. Quarters with no invoices are filled with
    # zeros so the response always carries Q1-Q4 plus YTD, as before.
    year_start = date(today.year, 1, 1)
    year_end = date(today.year, 12, 31)

    quarter_rows = (
        db.query(
            func.extract("quarter", Invoice.invoice_date).label("quarter"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("revenue"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("profit"),
        )
        .filter(
            *_active_invoice_filters(shop_id),
            Invoice.invoice_date >= year_start,
            Invoice.invoice_date <= year_end,
        )
        .group_by(func.extract("quarter", Invoice.invoice_date))
        .all()
    )

    quarter_totals = {
        int(row.quarter): (_to_decimal(row.revenue), _to_decimal(row.profit))
        for row in quarter_rows
    }
    quarter_return_rows = (
        db.query(
            func.extract("quarter", Invoice.invoice_date).label("quarter"),
            func.coalesce(func.sum(InvoiceReturn.total_amount), 0).label("revenue"),
            func.coalesce(func.sum(InvoiceReturn.total_profit), 0).label("profit"),
        )
        .join(Invoice, Invoice.id == InvoiceReturn.invoice_id)
        .filter(
            InvoiceReturn.shop_id == shop_id,
            InvoiceReturn.status == "completed",
            Invoice.invoice_status != "cancelled",
            Invoice.invoice_date >= year_start,
            Invoice.invoice_date <= year_end,
        )
        .group_by(func.extract("quarter", Invoice.invoice_date))
        .all()
    )
    for row in quarter_return_rows:
        quarter = int(row.quarter)
        revenue, profit = quarter_totals.get(quarter, (Decimal("0.00"), Decimal("0.00")))
        quarter_totals[quarter] = (
            max(revenue - _to_decimal(row.revenue), Decimal("0.00")),
            profit - _to_decimal(row.profit),
        )

    revenue_profit_points: list[RevenueProfitPoint] = []
    ytd_revenue = Decimal("0.00")
    ytd_profit = Decimal("0.00")

    for quarter_number in (1, 2, 3, 4):
        revenue, profit = quarter_totals.get(
            quarter_number, (Decimal("0.00"), Decimal("0.00"))
        )

        ytd_revenue += revenue
        ytd_profit += profit

        revenue_profit_points.append(
            RevenueProfitPoint(
                label=f"Q{quarter_number}",
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
        for product in low_stock_rows
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
