from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_bill import VendorBill
from app.models.vendor_bill_payment import VendorBillPayment
from app.schemas.vendor import (
    VendorBillCreate,
    VendorBillPaymentCreate,
    VendorBillUpdate,
    VendorCreate,
    VendorStatsResponse,
    VendorSummaryResponse,
    VendorUpdate,
)


VALID_BILL_STATUSES = {"pending", "partial", "completed", "overdue"}


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _calculate_bill_status(total_amount: Decimal, paid_amount: Decimal, due_date_value):
    total_amount = _to_decimal(total_amount)
    paid_amount = _to_decimal(paid_amount)
    remaining_amount = total_amount - paid_amount

    if remaining_amount < Decimal("0.00"):
        remaining_amount = Decimal("0.00")

    today = date.today()

    if remaining_amount == Decimal("0.00"):
        return remaining_amount, "completed"

    if due_date_value and due_date_value < today:
        return remaining_amount, "overdue"

    if paid_amount > Decimal("0.00") and remaining_amount > Decimal("0.00"):
        return remaining_amount, "partial"

    return remaining_amount, "pending"


def _ensure_vendor_belongs_to_shop(vendor: Vendor, shop_id: int):
    if not vendor or vendor.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )


def _ensure_bill_belongs_to_shop(bill: VendorBill, shop_id: int):
    if not bill or bill.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bill not found",
        )


def list_vendors(db: Session, current_user: User):
    return (
        db.query(Vendor)
        .filter(Vendor.shop_id == current_user.shop_id)
        .order_by(Vendor.vendor_name.asc())
        .all()
    )


def create_vendor(payload: VendorCreate, db: Session, current_user: User):
    vendor = Vendor(
        shop_id=current_user.shop_id,
        vendor_name=payload.vendor_name,
        company_name=payload.company_name,
        email=payload.email,
        phone=payload.phone,
        alternate_phone=payload.alternate_phone,
        tax_number=payload.tax_number,
        address_line_1=payload.address_line_1,
        address_line_2=payload.address_line_2,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
        country=payload.country,
        payment_terms=payload.payment_terms,
        default_reminder_days=payload.default_reminder_days,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def get_vendor(vendor_id: int, db: Session, current_user: User):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id, Vendor.shop_id == current_user.shop_id)
        .first()
    )
    _ensure_vendor_belongs_to_shop(vendor, current_user.shop_id)
    return vendor


def update_vendor(vendor_id: int, payload: VendorUpdate, db: Session, current_user: User):
    vendor = get_vendor(vendor_id, db, current_user)

    for field, value in payload.model_dump().items():
        setattr(vendor, field, value)

    db.commit()
    db.refresh(vendor)
    return vendor


def delete_vendor(vendor_id: int, db: Session, current_user: User):
    vendor = get_vendor(vendor_id, db, current_user)
    db.delete(vendor)
    db.commit()
    return {"message": "Vendor deleted successfully"}


def get_vendor_summary(vendor_id: int, db: Session, current_user: User):
    vendor = get_vendor(vendor_id, db, current_user)

    bills = (
        db.query(VendorBill)
        .filter(VendorBill.vendor_id == vendor.id, VendorBill.shop_id == current_user.shop_id)
        .all()
    )

    total_bills = len(bills)
    total_bill_amount = sum((_to_decimal(b.total_amount) for b in bills), Decimal("0.00"))
    total_paid_amount = sum((_to_decimal(b.paid_amount) for b in bills), Decimal("0.00"))
    total_remaining_amount = sum((_to_decimal(b.remaining_amount) for b in bills), Decimal("0.00"))

    today = date.today()
    overdue_bills_count = 0
    due_soon_bills_count = 0

    for bill in bills:
        if bill.status == "overdue":
            overdue_bills_count += 1
        elif bill.due_date and bill.remaining_amount > 0:
            days_left = (bill.due_date - today).days
            if 0 <= days_left <= (bill.reminder_days_before or 7):
                due_soon_bills_count += 1

    return VendorSummaryResponse(
        vendor_id=vendor.id,
        total_bills=total_bills,
        total_bill_amount=total_bill_amount,
        total_paid_amount=total_paid_amount,
        total_remaining_amount=total_remaining_amount,
        overdue_bills_count=overdue_bills_count,
        due_soon_bills_count=due_soon_bills_count,
    )


def list_vendor_bills(
    vendor_id: int,
    db: Session,
    current_user: User,
    search: str | None = None,
    status_filter: str | None = None,
    overdue_only: bool = False,
    due_in_days: int | None = None,
):
    vendor = get_vendor(vendor_id, db, current_user)

    query = db.query(VendorBill).filter(
        VendorBill.vendor_id == vendor.id,
        VendorBill.shop_id == current_user.shop_id,
    )

    if search:
        query = query.filter(VendorBill.bill_number.ilike(f"%{search}%"))

    if status_filter and status_filter in VALID_BILL_STATUSES:
        query = query.filter(VendorBill.status == status_filter)

    today = date.today()

    if overdue_only:
        query = query.filter(
            VendorBill.due_date < today,
            VendorBill.remaining_amount > 0,
        )

    if due_in_days is not None:
        end_date = today + timedelta(days=due_in_days)
        query = query.filter(
            VendorBill.due_date >= today,
            VendorBill.due_date <= end_date,
            VendorBill.remaining_amount > 0,
        )

    return query.order_by(VendorBill.created_at.desc()).all()


def create_vendor_bill(vendor_id: int, payload: VendorBillCreate, db: Session, current_user: User):
    vendor = get_vendor(vendor_id, db, current_user)

    remaining_amount, bill_status = _calculate_bill_status(
        payload.total_amount,
        payload.paid_amount,
        payload.due_date,
    )

    bill = VendorBill(
        shop_id=current_user.shop_id,
        vendor_id=vendor.id,
        bill_number=payload.bill_number,
        bill_date=payload.bill_date,
        due_date=payload.due_date,
        total_amount=payload.total_amount,
        paid_amount=payload.paid_amount,
        remaining_amount=remaining_amount,
        status=bill_status,
        payment_mode=payload.payment_mode,
        payment_reference=payload.payment_reference,
        reminder_days_before=payload.reminder_days_before,
        attachment_url=payload.attachment_url,
        notes=payload.notes,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def get_vendor_bill(bill_id: int, db: Session, current_user: User):
    bill = (
        db.query(VendorBill)
        .filter(VendorBill.id == bill_id, VendorBill.shop_id == current_user.shop_id)
        .first()
    )
    _ensure_bill_belongs_to_shop(bill, current_user.shop_id)
    return bill


def update_vendor_bill(bill_id: int, payload: VendorBillUpdate, db: Session, current_user: User):
    bill = get_vendor_bill(bill_id, db, current_user)

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(bill, field, value)

    payments_total = (
        db.query(func.coalesce(func.sum(VendorBillPayment.amount), 0))
        .filter(VendorBillPayment.vendor_bill_id == bill.id)
        .scalar()
    )

    bill.paid_amount = _to_decimal(payments_total)
    bill.remaining_amount, bill.status = _calculate_bill_status(
        bill.total_amount,
        bill.paid_amount,
        bill.due_date,
    )

    db.commit()
    db.refresh(bill)
    return bill


def list_bill_payments(bill_id: int, db: Session, current_user: User):
    bill = get_vendor_bill(bill_id, db, current_user)

    return (
        db.query(VendorBillPayment)
        .filter(
            VendorBillPayment.vendor_bill_id == bill.id,
            VendorBillPayment.shop_id == current_user.shop_id,
        )
        .order_by(VendorBillPayment.payment_date.desc(), VendorBillPayment.created_at.desc())
        .all()
    )


def add_bill_payment(bill_id: int, payload: VendorBillPaymentCreate, db: Session, current_user: User):
    bill = get_vendor_bill(bill_id, db, current_user)

    payment = VendorBillPayment(
        shop_id=current_user.shop_id,
        vendor_bill_id=bill.id,
        payment_date=payload.payment_date,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_number=payload.reference_number,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()

    payments_total = (
        db.query(func.coalesce(func.sum(VendorBillPayment.amount), 0))
        .filter(VendorBillPayment.vendor_bill_id == bill.id)
        .scalar()
    )

    bill.paid_amount = _to_decimal(payments_total)
    bill.remaining_amount, bill.status = _calculate_bill_status(
        bill.total_amount,
        bill.paid_amount,
        bill.due_date,
    )

    db.commit()
    db.refresh(payment)
    return payment



def get_vendor_stats(db: Session, current_user: User):
    vendors = (
        db.query(Vendor)
        .filter(Vendor.shop_id == current_user.shop_id)
        .all()
    )

    bills = (
        db.query(VendorBill)
        .filter(VendorBill.shop_id == current_user.shop_id)
        .all()
    )

    total_vendors = len(vendors)
    active_vendors = len([vendor for vendor in vendors if vendor.is_active])
    inactive_vendors = total_vendors - active_vendors

    total_bills = len(bills)
    total_bill_amount = sum(
        (_to_decimal(bill.total_amount) for bill in bills),
        Decimal("0.00"),
    )
    total_paid_amount = sum(
        (_to_decimal(bill.paid_amount) for bill in bills),
        Decimal("0.00"),
    )
    total_remaining_amount = sum(
        (_to_decimal(bill.remaining_amount) for bill in bills),
        Decimal("0.00"),
    )

    pending_bills = len([bill for bill in bills if bill.status == "pending"])
    partial_bills = len([bill for bill in bills if bill.status == "partial"])
    overdue_bills = len([bill for bill in bills if bill.status == "overdue"])
    completed_bills = len([bill for bill in bills if bill.status == "completed"])

    today = date.today()
    due_soon_bills = 0

    for bill in bills:
        if bill.due_date and _to_decimal(bill.remaining_amount) > 0:
            days_left = (bill.due_date - today).days
            reminder_days = bill.reminder_days_before or 7

            if 0 <= days_left <= reminder_days:
                due_soon_bills += 1

    return {
        "total_vendors": total_vendors,
        "active_vendors": active_vendors,
        "inactive_vendors": inactive_vendors,
        "total_bills": total_bills,
        "total_bill_amount": total_bill_amount,
        "total_paid_amount": total_paid_amount,
        "total_remaining_amount": total_remaining_amount,
        "pending_bills": pending_bills,
        "partial_bills": partial_bills,
        "overdue_bills": overdue_bills,
        "completed_bills": completed_bills,
        "due_soon_bills": due_soon_bills,
    }