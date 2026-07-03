from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.customer import CustomerResponse


# =========================================================
# CUSTOMER PAYLOAD USED WHILE CREATING INVOICE
# =========================================================

class InvoiceCustomerPayload(BaseModel):
    id: Optional[int] = None

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)

    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    gst_number: Optional[str] = Field(default=None, max_length=50)

    @field_validator("first_name", "last_name", "phone", "address", "city", "state", "pincode", "gst_number", mode="before")
    @classmethod
    def strip_text_fields(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


# =========================================================
# PRODUCT SEARCH / BILLING PRODUCT RESPONSE
# =========================================================

class BillingProductResponse(BaseModel):
    id: int
    name: str
    product_code: str
    sku: Optional[str] = None
    barcode: Optional[str] = None

    category: Optional[str] = None
    unit: Optional[str] = None

    mrp: Decimal
    buying_price: Decimal
    selling_price: Decimal
    available_stock: Decimal

    is_active: bool

    model_config = {"from_attributes": True}


# =========================================================
# INVOICE ITEM PAYLOAD
# =========================================================

class InvoiceItemCreate(BaseModel):
    product_id: int
    product_code: str = Field(..., min_length=1, max_length=100)

    quantity: Decimal = Field(..., gt=0)

    discount_percentage: Decimal = Field(default=0, ge=0, le=100)
    discount_amount_per_unit: Optional[Decimal] = Field(default=None, ge=0)

    selling_price_per_unit: Optional[Decimal] = Field(default=None, ge=0)

    @field_validator("product_code", mode="before")
    @classmethod
    def strip_product_code(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value


class InvoiceItemResponse(BaseModel):
    id: int
    shop_id: int

    invoice_id: int
    product_id: Optional[int] = None

    product_code: str
    product_name_snapshot: str
    category_snapshot: Optional[str] = None
    unit_snapshot: Optional[str] = None

    mrp: Decimal
    buy_price: Decimal
    quantity: Decimal

    discount_percentage: Decimal
    discount_amount_per_unit: Decimal
    total_discount_amount: Decimal

    selling_price_per_unit: Decimal
    total_selling_price: Decimal

    total_buy_cost: Decimal
    profit_per_unit: Decimal
    total_profit: Decimal

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# =========================================================
# INVOICE CREATE / UPDATE
# =========================================================

class InvoiceCreate(BaseModel):
    customer: InvoiceCustomerPayload

    items: list[InvoiceItemCreate] = Field(..., min_length=1)

    invoice_date: Optional[date] = None

    payment_status: str = Field(default="pending")
    payment_mode: Optional[str] = None
    paid_amount: Decimal = Field(default=0, ge=0)
    total_payable_amount: Optional[Decimal] = Field(default=None, ge=0)

    total_tax_amount: Decimal = Field(default=0, ge=0)

    invoice_status: str = Field(default="saved")
    notes: Optional[str] = None

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value):
        allowed = {"pending", "paid", "partial"}
        if value not in allowed:
            raise ValueError("payment_status must be pending, paid, or partial")
        return value

    @field_validator("payment_mode")
    @classmethod
    def validate_payment_mode(cls, value):
        if value is None:
            return value

        allowed = {"cash", "upi", "card", "bank_transfer", "other"}
        if value not in allowed:
            raise ValueError("payment_mode must be cash, upi, card, bank_transfer, or other")
        return value

    @field_validator("invoice_status")
    @classmethod
    def validate_invoice_status(cls, value):
        allowed = {"draft", "saved", "cancelled"}
        if value not in allowed:
            raise ValueError("invoice_status must be draft, saved, or cancelled")
        return value


# class InvoiceUpdate(BaseModel):
#     payment_status: Optional[str] = None
#     payment_mode: Optional[str] = None
#     paid_amount: Optional[Decimal] = Field(default=None, ge=0)
#     invoice_status: Optional[str] = None
#     notes: Optional[str] = None

#     @field_validator("payment_status")
#     @classmethod
#     def validate_payment_status(cls, value):
#         if value is None:
#             return value

#         allowed = {"pending", "paid", "partial"}
#         if value not in allowed:
#             raise ValueError("payment_status must be pending, paid, or partial")
#         return value

#     @field_validator("payment_mode")
#     @classmethod
#     def validate_payment_mode(cls, value):
#         if value is None:
#             return value

#         allowed = {"cash", "upi", "card", "bank_transfer", "other"}
#         if value not in allowed:
#             raise ValueError("payment_mode must be cash, upi, card, bank_transfer, or other")
#         return value

#     @field_validator("invoice_status")
#     @classmethod
#     def validate_invoice_status(cls, value):
#         if value is None:
#             return value

#         allowed = {"draft", "saved", "cancelled"}
#         if value not in allowed:
#             raise ValueError("invoice_status must be draft, saved, or cancelled")
#         return value


class InvoiceUpdate(BaseModel):
    customer: Optional[InvoiceCustomerPayload] = None
    items: Optional[list[InvoiceItemCreate]] = None

    invoice_date: Optional[date] = None

    payment_status: Optional[str] = None
    payment_mode: Optional[str] = None
    paid_amount: Optional[Decimal] = Field(default=None, ge=0)
    total_payable_amount: Optional[Decimal] = Field(default=None, ge=0)

    total_tax_amount: Optional[Decimal] = Field(default=None, ge=0)

    invoice_status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value):
        if value is None:
            return value

        allowed = {"pending", "paid", "partial"}
        if value not in allowed:
            raise ValueError("payment_status must be pending, paid, or partial")
        return value

    @field_validator("payment_mode")
    @classmethod
    def validate_payment_mode(cls, value):
        if value is None:
            return value

        allowed = {"cash", "upi", "card", "bank_transfer", "other"}
        if value not in allowed:
            raise ValueError("payment_mode must be cash, upi, card, bank_transfer, or other")
        return value

    @field_validator("invoice_status")
    @classmethod
    def validate_invoice_status(cls, value):
        if value is None:
            return value

        allowed = {"draft", "saved", "cancelled"}
        if value not in allowed:
            raise ValueError("invoice_status must be draft, saved, or cancelled")
        return value



# =========================================================
# INVOICE RESPONSE
# =========================================================

class InvoiceResponse(BaseModel):
    id: int
    shop_id: int

    invoice_number: str

    customer_id: Optional[int] = None

    customer_name_snapshot: str
    customer_phone_snapshot: str
    customer_email_snapshot: Optional[EmailStr] = None
    customer_address_snapshot: Optional[str] = None
    customer_city_snapshot: Optional[str] = None
    customer_state_snapshot: Optional[str] = None
    customer_pincode_snapshot: Optional[str] = None
    customer_gst_number_snapshot: Optional[str] = None

    invoice_date: date

    subtotal_amount: Decimal
    total_discount_amount: Decimal
    total_tax_amount: Decimal
    billed_amount: Decimal
    extra_discount_amount: Decimal
    final_amount: Decimal

    paid_amount: Decimal
    remaining_amount: Decimal

    total_buy_cost: Decimal
    total_profit: Decimal

    payment_status: str
    payment_mode: Optional[str] = None
    invoice_status: str

    notes: Optional[str] = None

    created_by: Optional[int] = None

    created_at: datetime
    updated_at: datetime

    items: list[InvoiceItemResponse] = []

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    id: int
    invoice_number: str

    customer_id: Optional[int] = None
    customer_name_snapshot: str
    customer_phone_snapshot: str

    invoice_date: date

    subtotal_amount: Decimal
    total_discount_amount: Decimal
    total_tax_amount: Decimal
    billed_amount: Decimal
    extra_discount_amount: Decimal
    final_amount: Decimal

    paid_amount: Decimal
    remaining_amount: Decimal

    total_profit: Decimal

    payment_status: str
    payment_mode: Optional[str] = None
    invoice_status: str

    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListPaginatedResponse(BaseModel):
    items: list[InvoiceListResponse]
    total: int
    page: int
    page_size: int


# =========================================================
# STATS RESPONSE
# =========================================================

class InvoiceStatsResponse(BaseModel):
    total_invoices: int

    total_sales_amount: Decimal
    total_discount_given: Decimal
    total_profit: Decimal

    today_sales: Decimal
    monthly_sales: Decimal

    pending_amount: Decimal
    paid_amount: Decimal

    paid_invoices: int
    pending_invoices: int
    partial_invoices: int


# =========================================================
# PREVIEW / MESSAGE / SHARE
# =========================================================

class InvoicePreviewResponse(BaseModel):
    invoice: InvoiceResponse
    customer: Optional[CustomerResponse] = None


class InvoiceMessageResponse(BaseModel):
    message: str


class InvoiceSharePayload(BaseModel):
    phone: Optional[str] = None
    message: Optional[str] = None


class InvoiceShareResponse(BaseModel):
    message: str
    whatsapp_url: Optional[str] = None
