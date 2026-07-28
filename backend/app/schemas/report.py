from typing import Literal

from pydantic import BaseModel


ReportPeriod = Literal["weekly", "monthly", "quarterly", "yearly"]


class ReportSummaryResponse(BaseModel):
    total_revenue: float
    total_profit: float
    total_expenses: float
    net_profit: float
    collection_rate: float
    outstanding_receivables: float
    outstanding_payables: float
    average_order_value: float
    active_customers: int
    total_customers: int


class TrendPoint(BaseModel):
    label: str
    revenue: float = 0.0
    profit: float = 0.0
    expenses: float = 0.0
    collections: float = 0.0
    outstanding: float = 0.0
    net: float = 0.0


class CategoryPerformanceItem(BaseModel):
    category: str
    revenue: float
    profit: float
    quantity: float
    orders: int


class CustomerInsightPoint(BaseModel):
    label: str
    new_customers: int
    repeat_customers: int
    repeat_revenue: float


class PaymentStatusItem(BaseModel):
    status: str
    count: int
    amount: float
    percentage: float


class SalesProfitReportResponse(BaseModel):
    period: ReportPeriod
    points: list[TrendPoint]
    total_revenue: float
    total_profit: float
    profit_margin: float


class CashflowReportResponse(BaseModel):
    period: ReportPeriod
    points: list[TrendPoint]
    total_collections: float
    total_expenses: float
    net_cashflow: float
    outstanding_receivables: float


class CategoryPerformanceReportResponse(BaseModel):
    period: ReportPeriod
    items: list[CategoryPerformanceItem]
    top_category: str | None = None


class CustomerInsightsReportResponse(BaseModel):
    period: ReportPeriod
    points: list[CustomerInsightPoint]
    total_new_customers: int
    total_repeat_customers: int
    repeat_revenue: float
    repeat_rate: float


class PaymentInsightsReportResponse(BaseModel):
    period: ReportPeriod
    statuses: list[PaymentStatusItem]
    collected_amount: float
    outstanding_amount: float
    overdue_amount: float
