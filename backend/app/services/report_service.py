from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.product_sales_analytics import ProductSalesAnalytics
from app.models.user import User
from app.models.vendor_bill import VendorBill
from app.schemas.report import (
    CashflowReportResponse,
    CategoryPerformanceItem,
    CategoryPerformanceReportResponse,
    CustomerInsightPoint,
    CustomerInsightsReportResponse,
    PaymentInsightsReportResponse,
    PaymentStatusItem,
    ReportPeriod,
    ReportSummaryResponse,
    SalesProfitReportResponse,
    TrendPoint,
)

ACTIVE_CUSTOMER_WINDOW_DAYS = 90
OVERDUE_WINDOW_DAYS = 30


@dataclass(frozen=True)
class Bucket:
    label: str
    start: date
    end: date


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _month_bounds(anchor: date) -> tuple[date, date]:
    start = anchor.replace(day=1)
    end = anchor.replace(day=monthrange(anchor.year, anchor.month)[1])
    return start, end


def _week_bounds(anchor: date) -> tuple[date, date]:
    start = anchor - timedelta(days=anchor.weekday())
    end = start + timedelta(days=6)
    return start, end


def _quarter_bounds(anchor: date) -> tuple[date, date]:
    quarter_start_month = ((anchor.month - 1) // 3) * 3 + 1
    start = date(anchor.year, quarter_start_month, 1)
    end_month = quarter_start_month + 2
    end = date(anchor.year, end_month, monthrange(anchor.year, end_month)[1])
    return start, end


def _year_bounds(anchor: date) -> tuple[date, date]:
    return date(anchor.year, 1, 1), date(anchor.year, 12, 31)


def _period_bounds(period: ReportPeriod, anchor: date | None = None) -> tuple[date, date]:
    anchor = anchor or date.today()
    if period == "weekly":
        return _week_bounds(anchor)
    if period == "monthly":
        return _month_bounds(anchor)
    if period == "quarterly":
        return _quarter_bounds(anchor)
    return _year_bounds(anchor)


def _add_months(anchor: date, months: int) -> date:
    month = anchor.month - 1 + months
    year = anchor.year + month // 12
    month = month % 12 + 1
    day = min(anchor.day, monthrange(year, month)[1])
    return date(year, month, day)


def _build_buckets(period: ReportPeriod, anchor: date | None = None) -> list[Bucket]:
    anchor = anchor or date.today()
    range_start, range_end = _period_bounds(period, anchor)

    if period == "weekly":
        return [
            Bucket(
                label=(range_start + timedelta(days=offset)).strftime("%a").upper()[:3],
                start=range_start + timedelta(days=offset),
                end=range_start + timedelta(days=offset),
            )
            for offset in range(7)
        ]

    if period == "monthly":
        buckets: list[Bucket] = []
        cursor = range_start
        index = 1
        while cursor <= range_end:
            bucket_end = min(cursor + timedelta(days=6), range_end)
            buckets.append(Bucket(label=f"W{index}", start=cursor, end=bucket_end))
            cursor = bucket_end + timedelta(days=1)
            index += 1
        return buckets

    if period == "quarterly":
        return [
            Bucket(
                label=_add_months(range_start, offset).strftime("%b").upper(),
                start=_add_months(range_start, offset).replace(day=1),
                end=_month_bounds(_add_months(range_start, offset))[1],
            )
            for offset in range(3)
        ]

    return [
        Bucket(
            label=date(range_start.year, month, 1).strftime("%b").upper(),
            start=date(range_start.year, month, 1),
            end=date(range_start.year, month, monthrange(range_start.year, month)[1]),
        )
        for month in range(1, 13)
    ]


def _bucket_index_for(target: date, buckets: list[Bucket]) -> int | None:
    for index, bucket in enumerate(buckets):
        if bucket.start <= target <= bucket.end:
            return index
    return None


def _safe_percent(part: Decimal, whole: Decimal) -> float:
    if whole <= Decimal("0.00"):
        return 0.0
    return round(float((part / whole) * Decimal("100")), 2)


def _payment_bucket(invoice_date: date, payment_status: str | None, remaining_amount: Decimal) -> str:
    remaining_amount = _to_decimal(remaining_amount)
    if remaining_amount > Decimal("0.00") and invoice_date <= date.today() - timedelta(days=OVERDUE_WINDOW_DAYS):
        return "OVERDUE"

    normalized = (payment_status or "pending").strip().lower()
    if normalized == "paid":
        return "PAID"
    if normalized == "partial":
        return "PARTIAL"
    return "PENDING"


def get_report_summary(db: Session, current_user: User) -> ReportSummaryResponse:
    shop_id = current_user.shop_id
    today = date.today()
    active_cutoff = today - timedelta(days=ACTIVE_CUSTOMER_WINDOW_DAYS)

    totals = (
        db.query(
            func.coalesce(func.sum(Invoice.final_amount), 0).label("revenue"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("profit"),
            func.coalesce(func.sum(Invoice.paid_amount), 0).label("collected"),
            func.coalesce(func.sum(Invoice.remaining_amount), 0).label("receivables"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .filter(Invoice.shop_id == shop_id)
        .one()
    )

    expense_total = _to_decimal(
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.shop_id == shop_id)
        .scalar()
    )

    payables_total = _to_decimal(
        db.query(func.coalesce(func.sum(VendorBill.remaining_amount), 0))
        .filter(VendorBill.shop_id == shop_id)
        .scalar()
    )

    total_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.shop_id == shop_id)
        .scalar()
    ) or 0

    active_customers = (
        db.query(func.count(func.distinct(Invoice.customer_id)))
        .filter(
            Invoice.shop_id == shop_id,
            Invoice.customer_id.isnot(None),
            Invoice.invoice_date >= active_cutoff,
        )
        .scalar()
    ) or 0

    total_revenue = _to_decimal(totals.revenue)
    total_profit = _to_decimal(totals.profit)
    total_collected = _to_decimal(totals.collected)
    outstanding_receivables = _to_decimal(totals.receivables)
    invoice_count = int(totals.invoice_count or 0)
    average_order_value = total_revenue / invoice_count if invoice_count else Decimal("0.00")

    return ReportSummaryResponse(
        total_revenue=float(total_revenue),
        total_profit=float(total_profit),
        total_expenses=float(expense_total),
        net_profit=float(total_profit - expense_total),
        collection_rate=_safe_percent(total_collected, total_revenue),
        outstanding_receivables=float(outstanding_receivables),
        outstanding_payables=float(payables_total),
        average_order_value=float(average_order_value),
        active_customers=int(active_customers),
        total_customers=int(total_customers),
    )


def get_sales_profit_report(
    db: Session,
    current_user: User,
    period: ReportPeriod = "monthly",
) -> SalesProfitReportResponse:
    buckets = _build_buckets(period)
    range_start, range_end = _period_bounds(period)
    points = [TrendPoint(label=bucket.label) for bucket in buckets]

    invoice_rows = (
        db.query(Invoice.invoice_date, Invoice.final_amount, Invoice.total_profit)
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.invoice_date >= range_start,
            Invoice.invoice_date <= range_end,
        )
        .all()
    )

    total_revenue = Decimal("0.00")
    total_profit = Decimal("0.00")

    for invoice_date, final_amount, profit_amount in invoice_rows:
        bucket_index = _bucket_index_for(invoice_date, buckets)
        if bucket_index is None:
            continue

        revenue = _to_decimal(final_amount)
        profit = _to_decimal(profit_amount)
        points[bucket_index].revenue += float(revenue)
        points[bucket_index].profit += float(profit)
        total_revenue += revenue
        total_profit += profit

    return SalesProfitReportResponse(
        period=period,
        points=points,
        total_revenue=float(total_revenue),
        total_profit=float(total_profit),
        profit_margin=_safe_percent(total_profit, total_revenue),
    )


def get_cashflow_report(
    db: Session,
    current_user: User,
    period: ReportPeriod = "monthly",
) -> CashflowReportResponse:
    buckets = _build_buckets(period)
    range_start, range_end = _period_bounds(period)
    points = [TrendPoint(label=bucket.label) for bucket in buckets]

    invoice_rows = (
        db.query(Invoice.invoice_date, Invoice.paid_amount, Invoice.remaining_amount)
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.invoice_date >= range_start,
            Invoice.invoice_date <= range_end,
        )
        .all()
    )

    expense_rows = (
        db.query(Expense.expense_date, Expense.amount)
        .filter(
            Expense.shop_id == current_user.shop_id,
            Expense.expense_date >= range_start,
            Expense.expense_date <= range_end,
        )
        .all()
    )

    total_collections = Decimal("0.00")
    total_expenses = Decimal("0.00")
    outstanding_receivables = Decimal("0.00")

    for invoice_date, paid_amount, remaining_amount in invoice_rows:
        bucket_index = _bucket_index_for(invoice_date, buckets)
        if bucket_index is None:
            continue

        collections = _to_decimal(paid_amount)
        outstanding = _to_decimal(remaining_amount)
        points[bucket_index].collections += float(collections)
        points[bucket_index].outstanding += float(outstanding)
        total_collections += collections
        outstanding_receivables += outstanding

    for expense_date, amount in expense_rows:
        bucket_index = _bucket_index_for(expense_date, buckets)
        if bucket_index is None:
            continue

        expense_amount = _to_decimal(amount)
        points[bucket_index].expenses += float(expense_amount)
        total_expenses += expense_amount

    for point in points:
        point.net = round(point.collections - point.expenses, 2)

    return CashflowReportResponse(
        period=period,
        points=points,
        total_collections=float(total_collections),
        total_expenses=float(total_expenses),
        net_cashflow=float(total_collections - total_expenses),
        outstanding_receivables=float(outstanding_receivables),
    )


def get_category_performance_report(
    db: Session,
    current_user: User,
    period: ReportPeriod = "monthly",
) -> CategoryPerformanceReportResponse:
    range_start, range_end = _period_bounds(period)

    rows = (
        db.query(
            ProductSalesAnalytics.category,
            func.coalesce(func.sum(ProductSalesAnalytics.total_selling_price), 0).label("revenue"),
            func.coalesce(func.sum(ProductSalesAnalytics.total_profit), 0).label("profit"),
            func.coalesce(func.sum(ProductSalesAnalytics.quantity), 0).label("quantity"),
            func.count(func.distinct(ProductSalesAnalytics.invoice_id)).label("orders"),
        )
        .filter(
            ProductSalesAnalytics.shop_id == current_user.shop_id,
            ProductSalesAnalytics.invoice_date >= range_start,
            ProductSalesAnalytics.invoice_date <= range_end,
        )
        .group_by(ProductSalesAnalytics.category)
        .order_by(func.coalesce(func.sum(ProductSalesAnalytics.total_selling_price), 0).desc())
        .limit(6)
        .all()
    )

    items = [
        CategoryPerformanceItem(
            category=row.category or "Uncategorized",
            revenue=float(_to_decimal(row.revenue)),
            profit=float(_to_decimal(row.profit)),
            quantity=float(_to_decimal(row.quantity)),
            orders=int(row.orders or 0),
        )
        for row in rows
    ]

    return CategoryPerformanceReportResponse(
        period=period,
        items=items,
        top_category=items[0].category if items else None,
    )


def get_customer_insights_report(
    db: Session,
    current_user: User,
    period: ReportPeriod = "monthly",
) -> CustomerInsightsReportResponse:
    buckets = _build_buckets(period)
    range_start, range_end = _period_bounds(period)
    points = [CustomerInsightPoint(label=bucket.label, new_customers=0, repeat_customers=0, repeat_revenue=0.0) for bucket in buckets]

    first_invoice_rows = (
        db.query(Invoice.customer_id, func.min(Invoice.invoice_date).label("first_invoice_date"))
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.customer_id.isnot(None),
        )
        .group_by(Invoice.customer_id)
        .all()
    )
    first_invoice_map = {
        int(row.customer_id): row.first_invoice_date
        for row in first_invoice_rows
        if row.customer_id is not None and row.first_invoice_date is not None
    }

    invoice_rows = (
        db.query(Invoice.customer_id, Invoice.invoice_date, Invoice.final_amount)
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.customer_id.isnot(None),
            Invoice.invoice_date >= range_start,
            Invoice.invoice_date <= range_end,
        )
        .all()
    )

    bucket_new_sets = [set() for _ in buckets]
    bucket_repeat_sets = [set() for _ in buckets]
    overall_new_customers: set[int] = set()
    overall_repeat_customers: set[int] = set()
    repeat_revenue = Decimal("0.00")

    for customer_id, invoice_date, final_amount in invoice_rows:
        if customer_id is None:
            continue

        bucket_index = _bucket_index_for(invoice_date, buckets)
        first_invoice_date = first_invoice_map.get(int(customer_id))
        if bucket_index is None or first_invoice_date is None:
            continue

        amount = _to_decimal(final_amount)
        if range_start <= first_invoice_date <= range_end and buckets[bucket_index].start <= first_invoice_date <= buckets[bucket_index].end:
            bucket_new_sets[bucket_index].add(int(customer_id))
            overall_new_customers.add(int(customer_id))
        elif first_invoice_date < buckets[bucket_index].start:
            bucket_repeat_sets[bucket_index].add(int(customer_id))
            overall_repeat_customers.add(int(customer_id))
            points[bucket_index].repeat_revenue += float(amount)
            repeat_revenue += amount

    for index, point in enumerate(points):
        point.new_customers = len(bucket_new_sets[index])
        point.repeat_customers = len(bucket_repeat_sets[index])
        point.repeat_revenue = round(point.repeat_revenue, 2)

    total_customers = len(overall_new_customers | overall_repeat_customers)

    return CustomerInsightsReportResponse(
        period=period,
        points=points,
        total_new_customers=len(overall_new_customers),
        total_repeat_customers=len(overall_repeat_customers),
        repeat_revenue=float(repeat_revenue),
        repeat_rate=round((len(overall_repeat_customers) / total_customers) * 100, 2) if total_customers else 0.0,
    )


def get_payment_insights_report(
    db: Session,
    current_user: User,
    period: ReportPeriod = "monthly",
) -> PaymentInsightsReportResponse:
    range_start, range_end = _period_bounds(period)

    invoice_rows = (
        db.query(
            Invoice.invoice_date,
            Invoice.payment_status,
            Invoice.final_amount,
            Invoice.paid_amount,
            Invoice.remaining_amount,
        )
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.invoice_date >= range_start,
            Invoice.invoice_date <= range_end,
        )
        .all()
    )

    billed_total = Decimal("0.00")
    collected_amount = Decimal("0.00")
    outstanding_amount = Decimal("0.00")
    overdue_amount = Decimal("0.00")

    status_amounts = {
        "PAID": Decimal("0.00"),
        "PARTIAL": Decimal("0.00"),
        "PENDING": Decimal("0.00"),
        "OVERDUE": Decimal("0.00"),
    }
    status_counts = {key: 0 for key in status_amounts}

    for invoice_date, payment_status, final_amount, paid_amount, remaining_amount in invoice_rows:
        billed = _to_decimal(final_amount)
        paid = _to_decimal(paid_amount)
        remaining = _to_decimal(remaining_amount)
        bucket = _payment_bucket(invoice_date, payment_status, remaining)

        billed_total += billed
        collected_amount += paid
        outstanding_amount += remaining
        if bucket == "OVERDUE":
            overdue_amount += remaining

        status_amounts[bucket] += billed
        status_counts[bucket] += 1

    statuses = [
        PaymentStatusItem(
            status=label,
            count=status_counts[label],
            amount=float(status_amounts[label]),
            percentage=_safe_percent(status_amounts[label], billed_total),
        )
        for label in ["PAID", "PARTIAL", "PENDING", "OVERDUE"]
    ]

    return PaymentInsightsReportResponse(
        period=period,
        statuses=statuses,
        collected_amount=float(collected_amount),
        outstanding_amount=float(outstanding_amount),
        overdue_amount=float(overdue_amount),
    )
