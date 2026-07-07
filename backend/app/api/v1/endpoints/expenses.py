from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.expense import ExpenseAnalyticsResponse, ExpenseCreate, ExpenseListResponse, ExpenseResponse, ExpenseUpdate
from app.services.expense_service import create_expense, delete_expense, get_expense_analytics, list_expenses, update_expense

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense_endpoint(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_expense(payload, current_user, db)


@router.get("", response_model=ExpenseListResponse)
def list_expenses_endpoint(
    range: Literal["all", "week", "month"] = Query(default="all"),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_expenses(
        current_user,
        db,
        range_key=range,
        search=search,
        category=category,
        payment_mode=payment_mode,
    )


@router.get("/analytics", response_model=ExpenseAnalyticsResponse)
def expense_analytics_endpoint(
    range: Literal["all", "week", "month"] = Query(default="all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_expense_analytics(current_user, db, range_key=range)


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense_endpoint(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_expense(expense_id, payload, current_user, db)


@router.delete("/{expense_id}")
def delete_expense_endpoint(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_expense(expense_id, current_user, db)