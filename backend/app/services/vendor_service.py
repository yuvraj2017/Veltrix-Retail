import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_bill import VendorBill
from app.models.vendor_bill_payment import VendorBillPayment
from app.models.purchase import PurchaseOrder, PurchaseReturn, VendorCredit
from app.models.business_audit_log import BusinessAuditAction
from app.schemas.vendor import (
    VendorBillCreate,
    VendorBillPaymentCreate,
    VendorBillUpdate,
    VendorCreate,
    VendorStatsResponse,
    VendorSummaryResponse,
    VendorUpdate,
)
from app.services.entitlement_service import ensure_can_create
from app.services.business_audit_service import record_business_audit


VALID_BILL_STATUSES = {"pending", "partial", "completed", "overdue"}
MONEY = Decimal("0.01")
LEGACY_BILL_INTEGRITY_ERROR = (
    "Legacy vendor bill financial state requires remediation before payment "
    "history can be used"
)


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _payment_fingerprint(*, payment_date, amount, payment_mode, reference_number, notes) -> str:
    data = {
        "payment_date": payment_date.isoformat(),
        "amount": str(_to_decimal(amount)),
        "payment_mode": payment_mode,
        "reference_number": reference_number,
        "notes": notes,
    }
    encoded = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


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


def _get_bill_payments_total(bill_id: int, db: Session) -> Decimal:
    payments_total = (
        db.query(func.coalesce(func.sum(VendorBillPayment.amount), 0))
        .filter(VendorBillPayment.vendor_bill_id == bill_id)
        .scalar()
    )
    return _to_decimal(payments_total)


def _ensure_payment_history_backfilled(bill: VendorBill, db: Session):
    total_amount = _to_decimal(bill.total_amount)
    paid_amount = _to_decimal(bill.paid_amount)
    remaining_amount = _to_decimal(bill.remaining_amount)
    expected_remaining = _to_decimal(total_amount - paid_amount)

    if (
        total_amount < Decimal("0.00")
        or paid_amount < Decimal("0.00")
        or paid_amount > total_amount
        or remaining_amount < Decimal("0.00")
        or remaining_amount != expected_remaining
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=LEGACY_BILL_INTEGRITY_ERROR,
        )

    existing_payments_count, existing_payments_total = (
        db.query(
            func.count(VendorBillPayment.id),
            func.coalesce(func.sum(VendorBillPayment.amount), 0),
        )
        .filter(VendorBillPayment.vendor_bill_id == bill.id)
        .one()
    )

    if existing_payments_count:
        if _to_decimal(existing_payments_total) != paid_amount:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=LEGACY_BILL_INTEGRITY_ERROR,
            )
        return

    if paid_amount == Decimal("0.00"):
        return

    payment = VendorBillPayment(
            shop_id=bill.shop_id,
            vendor_bill_id=bill.id,
            payment_date=bill.bill_date,
            amount=paid_amount,
            payment_mode=bill.payment_mode,
            reference_number=bill.payment_reference,
            notes="Imported from validated legacy vendor bill paid balance",
            client_request_id=f"legacy-vendor-bill-{bill.id}",
        )
    payment.request_fingerprint = _payment_fingerprint(
        payment_date=payment.payment_date,
        amount=payment.amount,
        payment_mode=payment.payment_mode,
        reference_number=payment.reference_number,
        notes=payment.notes,
    )
    db.add(payment)
    db.flush()


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
    ensure_can_create(current_user.shop_id, "vendors", db)

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
    has_purchase_history = (
        db.query(PurchaseOrder.id)
        .filter(
            PurchaseOrder.vendor_id == vendor.id,
            PurchaseOrder.shop_id == current_user.shop_id,
        )
        .first()
        is not None
    )
    has_financial_history = (
        db.query(VendorBill.id)
        .filter(VendorBill.vendor_id == vendor.id, VendorBill.shop_id == current_user.shop_id)
        .first()
        is not None
    )
    has_return_history = (
        db.query(PurchaseReturn.id)
        .filter(PurchaseReturn.vendor_id == vendor.id, PurchaseReturn.shop_id == current_user.shop_id)
        .first()
        is not None
    )
    if has_purchase_history or has_financial_history or has_return_history:
        vendor.is_active = False
        db.commit()
        return {"message": "Vendor deactivated to preserve commercial history"}
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
    total_amount = _to_decimal(payload.total_amount)
    initial_paid = _to_decimal(payload.paid_amount)
    if initial_paid > total_amount:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Initial payment cannot exceed the bill total",
        )
    if db.query(VendorBill.id).filter(
        VendorBill.shop_id == current_user.shop_id,
        VendorBill.bill_number == payload.bill_number,
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bill number already exists for this shop",
        )

    remaining_amount, bill_status = _calculate_bill_status(
        total_amount,
        initial_paid,
        payload.due_date,
    )

    bill = VendorBill(
        shop_id=current_user.shop_id,
        vendor_id=vendor.id,
        bill_number=payload.bill_number,
        bill_date=payload.bill_date,
        due_date=payload.due_date,
        total_amount=total_amount,
        paid_amount=initial_paid,
        remaining_amount=remaining_amount,
        status=bill_status,
        payment_mode=payload.payment_mode,
        payment_reference=payload.payment_reference,
        reminder_days_before=payload.reminder_days_before,
        attachment_url=payload.attachment_url,
        notes=payload.notes,
    )
    db.add(bill)
    db.flush()

    if initial_paid > Decimal("0.00"):
        payment = VendorBillPayment(
                shop_id=current_user.shop_id,
                vendor_bill_id=bill.id,
                payment_date=payload.bill_date,
                amount=initial_paid,
                payment_mode=payload.payment_mode,
                reference_number=payload.payment_reference,
                notes="Initial payment recorded during bill creation",
                client_request_id=f"vendor-bill-initial-{bill.id}",
            )
        payment.request_fingerprint = _payment_fingerprint(
            payment_date=payment.payment_date,
            amount=payment.amount,
            payment_mode=payment.payment_mode,
            reference_number=payment.reference_number,
            notes=payment.notes,
        )
        db.add(payment)
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.VENDOR_BILL_CREATED,
        entity_type="vendor_bill",
        entity_id=bill.id,
        summary=f"Vendor bill {bill.bill_number} created",
        after_data={
            "vendor_id": vendor.id,
            "total_amount": bill.total_amount,
            "paid_amount": bill.paid_amount,
            "remaining_amount": bill.remaining_amount,
            "status": bill.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bill number already exists for this shop",
        ) from exc
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
    bill = (
        db.query(VendorBill)
        .filter(VendorBill.id == bill_id, VendorBill.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    _ensure_bill_belongs_to_shop(bill, current_user.shop_id)
    _ensure_payment_history_backfilled(bill, db)
    before = {
        "bill_number": bill.bill_number,
        "total_amount": bill.total_amount,
        "paid_amount": bill.paid_amount,
        "remaining_amount": bill.remaining_amount,
        "status": bill.status,
    }

    data = payload.model_dump(exclude_unset=True)

    if "bill_number" in data and db.query(VendorBill.id).filter(
        VendorBill.shop_id == current_user.shop_id,
        VendorBill.bill_number == data["bill_number"],
        VendorBill.id != bill.id,
    ).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bill number already exists for this shop")
    paid_total = _get_bill_payments_total(bill.id, db)
    if "total_amount" in data and _to_decimal(data["total_amount"]) < paid_total:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bill total cannot be lower than recorded payments",
        )
    for field, value in data.items():
        setattr(bill, field, value)

    bill.paid_amount = _get_bill_payments_total(bill.id, db)
    bill.remaining_amount, bill.status = _calculate_bill_status(
        bill.total_amount,
        bill.paid_amount,
        bill.due_date,
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.VENDOR_BILL_UPDATED,
        entity_type="vendor_bill",
        entity_id=bill.id,
        summary=f"Vendor bill {bill.bill_number} updated",
        before_data=before,
        after_data={
            "bill_number": bill.bill_number,
            "total_amount": bill.total_amount,
            "paid_amount": bill.paid_amount,
            "remaining_amount": bill.remaining_amount,
            "status": bill.status,
        },
    )

    db.commit()
    db.refresh(bill)
    return bill


def list_bill_payments(bill_id: int, db: Session, current_user: User):
    bill = get_vendor_bill(bill_id, db, current_user)
    _ensure_payment_history_backfilled(bill, db)
    db.commit()

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
    bill = (
        db.query(VendorBill)
        .filter(VendorBill.id == bill_id, VendorBill.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    _ensure_bill_belongs_to_shop(bill, current_user.shop_id)
    _ensure_payment_history_backfilled(bill, db)

    fingerprint = _payment_fingerprint(
        payment_date=payload.payment_date,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_number=payload.reference_number,
        notes=payload.notes,
    )
    existing = db.query(VendorBillPayment).filter(
        VendorBillPayment.shop_id == current_user.shop_id,
        VendorBillPayment.vendor_bill_id == bill.id,
        VendorBillPayment.client_request_id == payload.client_request_id,
    ).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This vendor payment request key was already used with different data",
            )
        return existing

    paid_before = _get_bill_payments_total(bill.id, db)
    remaining_before = _to_decimal(bill.total_amount) - paid_before
    amount = _to_decimal(payload.amount)
    if amount > remaining_before:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment exceeds the remaining bill amount of {remaining_before}",
        )

    payment = VendorBillPayment(
        shop_id=current_user.shop_id,
        vendor_bill_id=bill.id,
        payment_date=payload.payment_date,
        amount=amount,
        payment_mode=payload.payment_mode,
        reference_number=payload.reference_number,
        notes=payload.notes,
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
    )
    db.add(payment)
    db.flush()

    bill.paid_amount = _get_bill_payments_total(bill.id, db)
    bill.remaining_amount, bill.status = _calculate_bill_status(
        bill.total_amount,
        bill.paid_amount,
        bill.due_date,
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.VENDOR_PAYMENT_CREATED,
        entity_type="vendor_bill_payment",
        entity_id=payment.id,
        summary=f"Payment recorded for vendor bill {bill.bill_number}",
        after_data={
            "vendor_bill_id": bill.id,
            "vendor_id": bill.vendor_id,
            "amount": payment.amount,
            "payment_mode": payment.payment_mode,
            "paid_amount": bill.paid_amount,
            "remaining_amount": bill.remaining_amount,
            "status": bill.status,
        },
    )

    db.commit()
    db.refresh(payment)
    return payment


def list_vendor_credits(vendor_id: int, db: Session, current_user: User):
    get_vendor(vendor_id, db, current_user)
    return (
        db.query(VendorCredit)
        .filter(VendorCredit.shop_id == current_user.shop_id, VendorCredit.vendor_id == vendor_id)
        .order_by(VendorCredit.created_at.desc(), VendorCredit.id.desc())
        .all()
    )



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
