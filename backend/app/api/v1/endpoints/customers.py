from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerSearchResponse,
    CustomerUpdate,
)
from app.services.customer_service import (
    create_customer,
    get_customer,
    search_customers,
    update_customer,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/search", response_model=list[CustomerSearchResponse])
def search_existing_customers(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_customers(query, db, current_user)


@router.post("", response_model=CustomerResponse, status_code=201)
def add_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_customer(payload, db, current_user)


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_single_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_customer(customer_id, db, current_user)


@router.put("/{customer_id}", response_model=CustomerResponse)
def edit_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_customer(customer_id, payload, db, current_user)