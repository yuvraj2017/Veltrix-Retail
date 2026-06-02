from pydantic import BaseModel


class DashboardStat(BaseModel):
    title: str
    value: str
    change: str
    positive: bool = True
    highlight: bool = False
    warning_label: str | None = None


class SalesTrendPoint(BaseModel):
    label: str
    value: float


class RevenueProfitPoint(BaseModel):
    label: str
    revenue: float
    profit: float


class RecentBillItem(BaseModel):
    id: str
    date: str
    amount: str
    status: str


class LowStockProductItem(BaseModel):
    id: str
    name: str
    sku: str
    left: int
    image: str | None = None


class DashboardOverviewResponse(BaseModel):
    greeting_name: str
    performance_label: str
    stats: list[DashboardStat]
    sales_trends: list[SalesTrendPoint]
    revenue_profit: list[RevenueProfitPoint]
    recent_bills: list[RecentBillItem]
    low_stock_products: list[LowStockProductItem]