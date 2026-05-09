from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class VendorBase(BaseModel):
    vendor_name: str = Field(..., min_length=1, max_length=150)
    company_name: Optional[str] = Field(default=None, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    alternate_phone: Optional[str] = Field(default=None, max_length=20)
    tax_number: Optional[str] = Field(default=None, max_length=100)

    address_line_1: Optional[str] = Field(default=None, max_length=255)
    address_line_2: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    country: Optional[str] = Field(default=None, max_length=100)

    payment_terms: Optional[str] = Field(default=None, max_length=100)
    default_reminder_days: int = 7
    notes: Optional[str] = None
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorUpdate(VendorBase):
    pass


class VendorResponse(VendorBase):
    id: int
    shop_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorSummaryResponse(BaseModel):
    vendor_id: int
    total_bills: int
    total_bill_amount: Decimal
    total_paid_amount: Decimal
    total_remaining_amount: Decimal
    overdue_bills_count: int
    due_soon_bills_count: int


class VendorStatsResponse(BaseModel):
    total_vendors: int
    active_vendors: int
    inactive_vendors: int

    total_bills: int
    total_bill_amount: Decimal
    total_paid_amount: Decimal
    total_remaining_amount: Decimal

    pending_bills: int
    partial_bills: int
    overdue_bills: int
    completed_bills: int
    due_soon_bills: int



class VendorBillBase(BaseModel):
    bill_number: str = Field(..., min_length=1, max_length=100)
    bill_date: date
    due_date: Optional[date] = None

    total_amount: Decimal = Field(..., ge=0)
    payment_mode: Optional[str] = Field(default=None, max_length=50)
    payment_reference: Optional[str] = Field(default=None, max_length=100)
    reminder_days_before: int = 7

    attachment_url: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class VendorBillCreate(VendorBillBase):
    paid_amount: Decimal = Field(default=0, ge=0)


class VendorBillUpdate(BaseModel):
    bill_number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    bill_date: Optional[date] = None
    due_date: Optional[date] = None

    total_amount: Optional[Decimal] = Field(default=None, ge=0)
    payment_mode: Optional[str] = Field(default=None, max_length=50)
    payment_reference: Optional[str] = Field(default=None, max_length=100)
    reminder_days_before: Optional[int] = None

    attachment_url: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class VendorBillResponse(BaseModel):
    id: int
    shop_id: int
    vendor_id: int

    bill_number: str
    bill_date: date
    due_date: Optional[date] = None

    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: str

    payment_mode: Optional[str] = None
    payment_reference: Optional[str] = None
    reminder_days_before: int
    attachment_url: Optional[str] = None
    notes: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorBillPaymentCreate(BaseModel):
    payment_date: date
    amount: Decimal = Field(..., gt=0)
    payment_mode: Optional[str] = Field(default=None, max_length=50)
    reference_number: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None


class VendorBillPaymentResponse(BaseModel):
    id: int
    shop_id: int
    vendor_bill_id: int
    payment_date: date
    amount: Decimal
    payment_mode: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str