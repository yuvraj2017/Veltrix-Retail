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

    phone: Optional[str] = Field(default=None, max_length=20)
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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        if value is None:
            return value

        if len(value) < 5:
            raise ValueError("phone must be at least 5 characters when provided")

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
    hsn_sac: Optional[str] = None

    mrp: Decimal
    buying_price: Decimal
    selling_price: Decimal
    available_stock: Decimal
    gst_rate: Decimal

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
    hsn_sac_snapshot: Optional[str] = None
    gst_rate: Decimal
    taxable_value: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal

    total_buy_cost: Decimal
    profit_per_unit: Decimal
    total_profit: Decimal

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


PAYMENT_METHODS = {"cash", "upi", "card", "bank_transfer", "other"}


class InvoicePaymentInput(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str
    payment_reference: Optional[str] = Field(default=None, max_length=150)
    notes: Optional[str] = None
    received_at: Optional[datetime] = None

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, value):
        if value not in PAYMENT_METHODS:
            raise ValueError("payment_method must be cash, upi, card, bank_transfer, or other")
        return value

    @field_validator("payment_reference", "notes", mode="before")
    @classmethod
    def strip_payment_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class InvoicePaymentCreate(InvoicePaymentInput):
    client_request_id: str = Field(..., min_length=8, max_length=100)

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_client_request_id(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value


class InvoicePaymentResponse(BaseModel):
    id: int
    shop_id: int
    invoice_id: int
    amount: Decimal
    payment_method: str
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    received_at: datetime
    created_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceReturnItemCreate(BaseModel):
    invoice_item_id: int
    quantity: Decimal = Field(..., gt=0)


class InvoiceReturnCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    reason: str = Field(..., min_length=3, max_length=200)
    notes: Optional[str] = None
    items: list[InvoiceReturnItemCreate] = Field(..., min_length=1)

    @field_validator("client_request_id", "reason", "notes", mode="before")
    @classmethod
    def strip_return_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class InvoiceCancelPayload(BaseModel):
    client_request_id: Optional[str] = Field(default=None, min_length=8, max_length=100)
    reason: str = Field(default="Invoice cancellation", min_length=3, max_length=200)
    notes: Optional[str] = None

    @field_validator("client_request_id", "reason", "notes", mode="before")
    @classmethod
    def strip_cancel_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class InvoiceRefundCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    amount: Decimal = Field(..., gt=0)
    refund_method: str
    reference: Optional[str] = Field(default=None, max_length=150)
    notes: Optional[str] = None
    refunded_at: Optional[datetime] = None

    @field_validator("refund_method")
    @classmethod
    def validate_refund_method(cls, value):
        if value not in PAYMENT_METHODS:
            raise ValueError("refund_method must be cash, upi, card, bank_transfer, or other")
        return value

    @field_validator("client_request_id", "reference", "notes", mode="before")
    @classmethod
    def strip_refund_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class InvoiceRefundResponse(BaseModel):
    id: int
    shop_id: int
    invoice_id: int
    return_id: int
    amount: Decimal
    refund_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    refunded_at: datetime
    created_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceReturnItemResponse(BaseModel):
    id: int
    shop_id: int
    return_id: int
    invoice_item_id: int
    product_id: Optional[int] = None
    product_code: str
    product_name_snapshot: str
    hsn_sac_snapshot: Optional[str] = None
    quantity: Decimal
    unit_taxable_value: Decimal
    gst_rate: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    igst_rate: Decimal
    taxable_value: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal
    total_amount: Decimal
    total_buy_cost: Decimal = Field(default=0)
    total_profit: Decimal = Field(default=0)
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceReturnResponse(BaseModel):
    id: int
    shop_id: int
    invoice_id: int
    return_number: str
    credit_note_number: str
    status: str
    reason: str
    notes: Optional[str] = None
    subtotal_amount: Decimal
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal
    total_amount: Decimal
    total_buy_cost: Decimal = Field(default=0)
    total_profit: Decimal = Field(default=0)
    applied_to_outstanding_amount: Decimal
    refundable_amount: Decimal
    created_by: Optional[int] = None
    completed_at: datetime
    created_at: datetime
    items: list[InvoiceReturnItemResponse] = []
    refunds: list[InvoiceRefundResponse] = []

    model_config = {"from_attributes": True}


# =========================================================
# INVOICE CREATE / UPDATE
# =========================================================

class InvoiceCreate(BaseModel):
    client_request_id: Optional[str] = Field(default=None, min_length=8, max_length=100)
    customer: InvoiceCustomerPayload

    items: list[InvoiceItemCreate] = Field(..., min_length=1)

    invoice_date: Optional[date] = None

    payment_status: str = Field(default="pending")
    payment_mode: Optional[str] = None
    paid_amount: Decimal = Field(default=0, ge=0)
    payments: Optional[list[InvoicePaymentInput]] = None
    total_payable_amount: Optional[Decimal] = Field(default=None, ge=0)

    total_tax_amount: Decimal = Field(default=0, ge=0)

    invoice_status: str = Field(default="saved")
    notes: Optional[str] = None

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_client_request_id(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

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

        allowed = {"cash", "upi", "card", "bank_transfer", "other", "mixed"}
        if value not in allowed:
            raise ValueError("payment_mode must be cash, upi, card, bank_transfer, other, or mixed")
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

        allowed = {"cash", "upi", "card", "bank_transfer", "other", "mixed"}
        if value not in allowed:
            raise ValueError("payment_mode must be cash, upi, card, bank_transfer, other, or mixed")
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
    customer_state_code_snapshot: Optional[str] = None
    customer_pincode_snapshot: Optional[str] = None
    customer_gst_number_snapshot: Optional[str] = None
    seller_gst_number_snapshot: Optional[str] = None
    seller_state_snapshot: Optional[str] = None
    seller_state_code_snapshot: Optional[str] = None
    tax_treatment: str

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
    finalized_at: Optional[datetime] = None

    notes: Optional[str] = None

    created_by: Optional[int] = None

    created_at: datetime
    updated_at: datetime

    items: list[InvoiceItemResponse] = []
    payments: list[InvoicePaymentResponse] = []
    returns: list[InvoiceReturnResponse] = []

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
    finalized_at: Optional[datetime] = None

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
