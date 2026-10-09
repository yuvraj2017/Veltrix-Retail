from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.report import (
    CashflowReportResponse,
    CategoryPerformanceReportResponse,
    CustomerInsightsReportResponse,
    PaymentInsightsReportResponse,
    ReportPeriod,
    ReportSummaryResponse,
    SalesProfitReportResponse,
)
from app.services.report_service import (
    get_cashflow_report,
    get_category_performance_report,
    get_customer_insights_report,
    get_payment_insights_report,
    get_report_summary,
    get_sales_profit_report,
)
from app.services.entitlement_service import ensure_feature_enabled

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary", response_model=ReportSummaryResponse)
def get_reports_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_report_summary(db, current_user)


@router.get("/sales-profit", response_model=SalesProfitReportResponse)
def get_reports_sales_profit(
    period: ReportPeriod = Query(default="monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_sales_profit_report(db, current_user, period=period)


@router.get("/cashflow", response_model=CashflowReportResponse)
def get_reports_cashflow(
    period: ReportPeriod = Query(default="monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_cashflow_report(db, current_user, period=period)


@router.get("/category-performance", response_model=CategoryPerformanceReportResponse)
def get_reports_category_performance(
    period: ReportPeriod = Query(default="monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_category_performance_report(db, current_user, period=period)


@router.get("/customer-insights", response_model=CustomerInsightsReportResponse)
def get_reports_customer_insights(
    period: ReportPeriod = Query(default="monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_customer_insights_report(db, current_user, period=period)


@router.get("/payment-insights", response_model=PaymentInsightsReportResponse)
def get_reports_payment_insights(
    period: ReportPeriod = Query(default="monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    ensure_feature_enabled(current_user.shop_id, "reports.advanced", db)
    return get_payment_insights_report(db, current_user, period=period)
