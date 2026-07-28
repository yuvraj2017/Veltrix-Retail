from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

CustomerStatus = Literal["VIP", "ACTIVE", "INACTIVE"]


class CustomerBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)

    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    gst_number: Optional[str] = Field(default=None, max_length=50)

    @field_validator(
        "first_name",
        "last_name",
        "phone",
        "city",
        "state",
        "pincode",
        "gst_number",
        mode="before",
    )
    @classmethod
    def strip_text_fields(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("address", mode="before")
    @classmethod
    def strip_address(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)

    phone: Optional[str] = Field(default=None, min_length=5, max_length=20)
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    gst_number: Optional[str] = Field(default=None, max_length=50)

    @field_validator(
        "first_name",
        "last_name",
        "phone",
        "city",
        "state",
        "pincode",
        "gst_number",
        mode="before",
    )
    @classmethod
    def strip_text_fields(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("address", mode="before")
    @classmethod
    def strip_address(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class CustomerResponse(BaseModel):
    id: int
    shop_id: int

    first_name: str
    last_name: Optional[str] = None
    full_name: str

    phone: str
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None

    total_orders: int
    total_spent: Decimal

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerSearchResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerDirectoryItemResponse(BaseModel):
    customer_id: int
    full_name: str
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    state: Optional[str] = None
    total_orders: int
    total_spent: Decimal
    outstanding_amount: Decimal
    average_order_value: Decimal
    first_invoice_date: Optional[date] = None
    last_invoice_date: Optional[date] = None
    status: CustomerStatus


class CustomerDirectoryResponse(BaseModel):
    items: list[CustomerDirectoryItemResponse]
    total: int
    page: int
    page_size: int


class CustomerSummaryResponse(BaseModel):
    total_customers: int
    billed_customers: int
    active_customers: int
    inactive_customers: int
    vip_customers: int
    total_revenue: Decimal
    average_lifetime_value: Decimal
    repeat_customer_rate: Decimal
    outstanding_amount: Decimal


class CustomerRevenueTrendPoint(BaseModel):
    label: str
    revenue: Decimal
    collected_amount: Decimal
    invoice_count: int


class CustomerGrowthPoint(BaseModel):
    label: str
    new_customers: int
    returning_customers: int


class CustomerStatusBreakdownItem(BaseModel):
    status: CustomerStatus
    count: int


class CustomerTopCustomerItem(BaseModel):
    customer_id: int
    customer_name: str
    total_spent: Decimal
    total_orders: int
    outstanding_amount: Decimal
    status: CustomerStatus


class CustomerChartsResponse(BaseModel):
    revenue_trend: list[CustomerRevenueTrendPoint]
    customer_growth: list[CustomerGrowthPoint]
    status_breakdown: list[CustomerStatusBreakdownItem]
    top_customers: list[CustomerTopCustomerItem]


class CustomerInsightResponse(BaseModel):
    vip_customers: int
    active_customers: int
    inactive_customers: int
    repeat_customer_rate: Decimal
    retention_message: str
    top_customers: list[CustomerTopCustomerItem]


class CustomerInvoiceHistoryItem(BaseModel):
    invoice_id: int
    invoice_number: str
    invoice_date: date
    final_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    total_profit: Decimal
    payment_status: str
    invoice_status: str


class CustomerPurchasedProductItem(BaseModel):
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    product_name: str
    category: Optional[str] = None
    total_quantity: Decimal
    total_sales: Decimal
    total_profit: Decimal


class CustomerSpendTrendPoint(BaseModel):
    label: str
    total_spend: Decimal
    collected_amount: Decimal


class CustomerAnalyticsDetailResponse(BaseModel):
    customer_id: int
    full_name: str
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None
    total_orders: int
    total_spent: Decimal
    outstanding_amount: Decimal
    average_order_value: Decimal
    total_profit: Decimal
    first_invoice_date: Optional[date] = None
    last_invoice_date: Optional[date] = None
    status: CustomerStatus
    invoices: list[CustomerInvoiceHistoryItem]
    products: list[CustomerPurchasedProductItem]
    spend_trend: list[CustomerSpendTrendPoint]


class CustomerMessageResponse(BaseModel):
    message: str
