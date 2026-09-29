from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.customer import (
    CustomerAnalyticsDetailResponse,
    CustomerChartsResponse,
    CustomerCreate,
    CustomerDirectoryResponse,
    CustomerInsightResponse,
    CustomerResponse,
    CustomerSearchResponse,
    CustomerSummaryResponse,
    CustomerUpdate,
)
from app.services.customer_service import (
    create_customer,
    get_customer,
    get_customer_analytics,
    get_customer_charts,
    get_customer_insights,
    get_customer_summary,
    list_customers,
    search_customers,
    update_customer,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/search", response_model=list[CustomerSearchResponse])
def search_existing_customers(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return search_customers(query, db, current_user)


@router.get("", response_model=CustomerDirectoryResponse)
def get_customer_directory(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    sort_by: str | None = Query(default="recent"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_customers(
        db=db,
        current_user=current_user,
        search=search,
        status_filter=status,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=CustomerSummaryResponse)
def get_customer_summary_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_customer_summary(db, current_user)


@router.get("/charts", response_model=CustomerChartsResponse)
def get_customer_charts_endpoint(
    months: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_customer_charts(db, current_user, month_count=months)


@router.get("/insights", response_model=CustomerInsightResponse)
def get_customer_insights_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_customer_insights(db, current_user)


@router.post("", response_model=CustomerResponse, status_code=201)
def add_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return create_customer(payload, db, current_user)


@router.get("/{customer_id}/analytics", response_model=CustomerAnalyticsDetailResponse)
def get_single_customer_analytics(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_customer_analytics(customer_id, db, current_user)


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_single_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_customer(customer_id, db, current_user)


@router.put("/{customer_id}", response_model=CustomerResponse)
def edit_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return update_customer(customer_id, payload, db, current_user)
