from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.invoice import BillingProductResponse
from app.services.billing_service import (
    get_billing_product_by_code,
    search_billing_products,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/products/search", response_model=list[BillingProductResponse])
def search_products_for_billing(
    code: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_billing_products(code, db, current_user)


@router.get("/products/{product_code}", response_model=BillingProductResponse)
def get_product_for_billing_by_code(
    product_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_billing_product_by_code(product_code, db, current_user)