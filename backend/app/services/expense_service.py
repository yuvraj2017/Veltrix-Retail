from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import (
    ExpenseAnalyticsResponse,
    ExpenseCategoryBreakdownItem,
    ExpenseCreate,
    ExpenseRange,
    ExpenseTrendPoint,
    ExpenseUpdate,
)


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value.quantize(Decimal("0.01"))
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _month_bounds(anchor: date) -> tuple[date, date]:
    start = anchor.replace(day=1)
    end = anchor.replace(day=monthrange(anchor.year, anchor.month)[1])
    return start, end


def _week_bounds(anchor: date) -> tuple[date, date]:
    start = anchor - timedelta(days=anchor.weekday())
    end = start + timedelta(days=6)
    return start, end


def _get_range_bounds(range_key: ExpenseRange, anchor: date | None = None) -> tuple[date | None, date | None]:
    anchor = anchor or date.today()

    if range_key == "week":
        return _week_bounds(anchor)

    if range_key == "month":
        return _month_bounds(anchor)

    return None, None


def _apply_expense_filters(
    query,
    current_user: User,
    range_key: ExpenseRange = "all",
    search: str | None = None,
    category: str | None = None,
    payment_mode: str | None = None,
):
    query = query.filter(Expense.user_id == current_user.id)

    start_date, end_date = _get_range_bounds(range_key)
    if start_date and end_date:
        query = query.filter(Expense.expense_date >= start_date, Expense.expense_date <= end_date)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            Expense.title.ilike(search_term)
            | Expense.category.ilike(search_term)
            | Expense.payment_mode.ilike(search_term)
            | Expense.notes.ilike(search_term)
        )

    if category:
        query = query.filter(Expense.category == category)

    if payment_mode:
        query = query.filter(Expense.payment_mode == payment_mode)

    return query


def _recent_month_trend_window() -> tuple[date, date]:
    today = date.today()
    current_month_start, current_month_end = _month_bounds(today)
    oldest_visible_month = current_month_start
    for _ in range(5):
        month = oldest_visible_month.month - 1
        year = oldest_visible_month.year
        if month == 0:
            month = 12
            year -= 1
        oldest_visible_month = date(year, month, 1)
    return oldest_visible_month, current_month_end


def _build_trend_points(expenses: list[Expense], range_key: ExpenseRange) -> list[ExpenseTrendPoint]:
    today = date.today()

    if range_key == "week":
        start_date, end_date = _week_bounds(today)
        totals: dict[date, float] = {}
        for expense in expenses:
            totals[expense.expense_date] = totals.get(expense.expense_date, 0.0) + float(_to_decimal(expense.amount))

        points: list[ExpenseTrendPoint] = []
        for offset in range((end_date - start_date).days + 1):
            current_day = start_date + timedelta(days=offset)
            points.append(
                ExpenseTrendPoint(
                    label=current_day.strftime("%a").upper()[:3],
                    total=round(totals.get(current_day, 0.0), 2),
                )
            )
        return points

    if range_key == "month":
        start_date, end_date = _month_bounds(today)
        totals: dict[date, float] = {}
        for expense in expenses:
            totals[expense.expense_date] = totals.get(expense.expense_date, 0.0) + float(_to_decimal(expense.amount))

        points: list[ExpenseTrendPoint] = []
        for offset in range((end_date - start_date).days + 1):
            current_day = start_date + timedelta(days=offset)
            points.append(
                ExpenseTrendPoint(
                    label=current_day.strftime("%d"),
                    total=round(totals.get(current_day, 0.0), 2),
                )
            )
        return points

    trend_start, _ = _recent_month_trend_window()
    month_starts: list[date] = []
    for index in range(5, -1, -1):
        year = date.today().year
        month = date.today().month - index
        while month <= 0:
            month += 12
            year -= 1
        month_starts.append(date(year, month, 1))

    totals_by_month: dict[tuple[int, int], float] = {}
    for expense in expenses:
        if expense.expense_date < trend_start:
            continue
        key = (expense.expense_date.year, expense.expense_date.month)
        totals_by_month[key] = totals_by_month.get(key, 0.0) + float(_to_decimal(expense.amount))

    return [
        ExpenseTrendPoint(
            label=month_start.strftime("%b").upper(),
            total=round(totals_by_month.get((month_start.year, month_start.month), 0.0), 2),
        )
        for month_start in month_starts
    ]


def create_expense(payload: ExpenseCreate, current_user: User, db: Session):
    expense = Expense(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        title=payload.title.strip(),
        category=payload.category.strip(),
        amount=payload.amount,
        expense_date=payload.expense_date,
        payment_mode=payload.payment_mode.strip() if payload.payment_mode else None,
        notes=payload.notes.strip() if payload.notes else None,
    )

    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def list_expenses(
    current_user: User,
    db: Session,
    range_key: ExpenseRange = "all",
    search: str | None = None,
    category: str | None = None,
    payment_mode: str | None = None,
):
    query = _apply_expense_filters(
        db.query(Expense),
        current_user,
        range_key=range_key,
        search=search,
        category=category,
        payment_mode=payment_mode,
    )

    total = query.count()
    items = query.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).all()

    return {"items": items, "total": total}


def get_expense(expense_id: int, current_user: User, db: Session):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    return expense


def update_expense(expense_id: int, payload: ExpenseUpdate, current_user: User, db: Session):
    expense = get_expense(expense_id, current_user, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(expense_id: int, current_user: User, db: Session):
    expense = get_expense(expense_id, current_user, db)
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}


def get_expense_analytics(current_user: User, db: Session, range_key: ExpenseRange = "all"):
    weekly_query = _apply_expense_filters(db.query(Expense), current_user, range_key="week")
    monthly_query = _apply_expense_filters(db.query(Expense), current_user, range_key="month")
    selected_query = _apply_expense_filters(db.query(Expense), current_user, range_key=range_key)

    weekly_total = _to_decimal(weekly_query.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar())
    weekly_count = weekly_query.count()

    monthly_total = _to_decimal(monthly_query.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar())
    monthly_count = monthly_query.count()

    selected_expenses = selected_query.order_by(Expense.expense_date.asc(), Expense.created_at.asc()).all()
    trend_expenses = selected_expenses

    if range_key == "all":
        trend_start, trend_end = _recent_month_trend_window()
        trend_expenses = [
            expense
            for expense in selected_expenses
            if trend_start <= expense.expense_date <= trend_end
        ]

    range_total = _to_decimal(sum((_to_decimal(expense.amount) for expense in selected_expenses), Decimal("0.00")))
    range_count = len(selected_expenses)
    average_expense = _to_decimal(range_total / range_count) if range_count else Decimal("0.00")

    category_totals: dict[str, Decimal] = {}
    category_counts: dict[str, int] = {}
    for expense in selected_expenses:
        category_name = expense.category or "Uncategorized"
        category_totals[category_name] = category_totals.get(category_name, Decimal("0.00")) + _to_decimal(expense.amount)
        category_counts[category_name] = category_counts.get(category_name, 0) + 1

    categories = [
        ExpenseCategoryBreakdownItem(
            category=category_name,
            total=total,
            count=category_counts[category_name],
            percentage=round(float((total / range_total) * Decimal("100")), 2) if range_total > 0 else 0.0,
        )
        for category_name, total in sorted(
            category_totals.items(),
            key=lambda item: (-item[1], item[0].lower()),
        )
    ]

    trend = _build_trend_points(trend_expenses, range_key)

    return ExpenseAnalyticsResponse(
        selected_range=range_key,
        weekly_total=weekly_total,
        weekly_count=weekly_count,
        monthly_total=monthly_total,
        monthly_count=monthly_count,
        range_total=range_total,
        range_count=range_count,
        average_expense=average_expense,
        categories=categories,
        trend=trend,
    )