from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


ExpenseRange = Literal["all", "week", "month"]


class ExpenseBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    category: str = Field(..., min_length=2, max_length=100)
    amount: Decimal = Field(..., gt=0)
    expense_date: date
    payment_mode: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)
    expense_date: date | None = None
    payment_mode: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)


class ExpenseResponse(BaseModel):
    id: int
    user_id: int
    shop_id: int
    title: str
    category: str
    amount: Decimal
    expense_date: date
    payment_mode: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExpenseListResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int


class ExpenseCategoryBreakdownItem(BaseModel):
    category: str
    total: Decimal
    count: int
    percentage: float


class ExpenseTrendPoint(BaseModel):
    label: str
    total: float


class ExpenseAnalyticsResponse(BaseModel):
    selected_range: ExpenseRange
    weekly_total: Decimal
    weekly_count: int
    monthly_total: Decimal
    monthly_count: int
    range_total: Decimal
    range_count: int
    average_expense: Decimal
    categories: list[ExpenseCategoryBreakdownItem]
    trend: list[ExpenseTrendPoint]