from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.vendor import (
    MessageResponse,
    VendorBillCreate,
    VendorBillPaymentCreate,
    VendorBillPaymentResponse,
    VendorBillResponse,
    VendorBillUpdate,
    VendorCreate,
    VendorResponse,
    VendorStatsResponse,
    VendorSummaryResponse,
    VendorUpdate,
)
from app.services.vendor_service import (
    add_bill_payment,
    create_vendor,
    create_vendor_bill,
    delete_vendor,
    get_vendor,
    get_vendor_bill,
    get_vendor_stats,
    get_vendor_summary,
    list_bill_payments,
    list_vendor_bills,
    list_vendors,
    update_vendor,
    update_vendor_bill,
)

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("", response_model=list[VendorResponse])
def get_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_vendors(db, current_user)


@router.post("", response_model=VendorResponse, status_code=201)
def add_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_vendor(payload, db, current_user)


@router.get("/stats", response_model=VendorStatsResponse)
def vendor_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_vendor_stats(db, current_user)


@router.get("/{vendor_id}", response_model=VendorResponse)
def get_single_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_vendor(vendor_id, db, current_user)


@router.put("/{vendor_id}", response_model=VendorResponse)
def edit_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_vendor(vendor_id, payload, db, current_user)


@router.delete("/{vendor_id}", response_model=MessageResponse)
def remove_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_vendor(vendor_id, db, current_user)


@router.get("/{vendor_id}/summary", response_model=VendorSummaryResponse)
def vendor_summary(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_vendor_summary(vendor_id, db, current_user)


@router.get("/{vendor_id}/bills", response_model=list[VendorBillResponse])
def get_bills_for_vendor(
    vendor_id: int,
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    overdue_only: bool = Query(default=False),
    due_in_days: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_vendor_bills(
        vendor_id=vendor_id,
        db=db,
        current_user=current_user,
        search=search,
        status_filter=status_filter,
        overdue_only=overdue_only,
        due_in_days=due_in_days,
    )


@router.post("/{vendor_id}/bills", response_model=VendorBillResponse, status_code=201)
def add_bill_for_vendor(
    vendor_id: int,
    payload: VendorBillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_vendor_bill(vendor_id, payload, db, current_user)


@router.get("/bills/{bill_id}", response_model=VendorBillResponse)
def get_single_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_vendor_bill(bill_id, db, current_user)


@router.put("/bills/{bill_id}", response_model=VendorBillResponse)
def edit_bill(
    bill_id: int,
    payload: VendorBillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_vendor_bill(bill_id, payload, db, current_user)


@router.get("/bills/{bill_id}/payments", response_model=list[VendorBillPaymentResponse])
def get_bill_payments(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_bill_payments(bill_id, db, current_user)


@router.post(
    "/bills/{bill_id}/payments",
    response_model=VendorBillPaymentResponse,
    status_code=201,
)
def add_payment_to_bill(
    bill_id: int,
    payload: VendorBillPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return add_bill_payment(bill_id, payload, db, current_user)