from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PurchaseOrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    ordered_quantity: int = Field(..., gt=0)
    unit_cost: Decimal = Field(..., ge=0, max_digits=14, decimal_places=2)


class PurchaseOrderCreate(BaseModel):
    vendor_id: int = Field(..., gt=0)
    order_date: date
    expected_date: date | None = None
    status: Literal["draft", "ordered"] = "draft"
    notes: str | None = Field(default=None, max_length=2000)
    tax_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    items: list[PurchaseOrderItemCreate] = Field(..., min_length=1)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_order(self):
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Each product may appear only once in a purchase order")
        if self.expected_date and self.expected_date < self.order_date:
            raise ValueError("expected_date cannot be before order_date")
        return self


class PurchaseOrderUpdate(BaseModel):
    vendor_id: int | None = Field(default=None, gt=0)
    order_date: date | None = None
    expected_date: date | None = None
    status: Literal["draft", "ordered"] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    tax_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    items: list[PurchaseOrderItemCreate] | None = Field(default=None, min_length=1)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_items(self):
        if self.items is not None:
            product_ids = [item.product_id for item in self.items]
            if len(product_ids) != len(set(product_ids)):
                raise ValueError("Each product may appear only once in a purchase order")
        return self


class PurchaseOrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    ordered_quantity: int
    received_quantity: int
    unit_cost: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PurchaseOrderResponse(BaseModel):
    id: int
    shop_id: int
    vendor_id: int
    purchase_order_number: str
    order_date: date
    expected_date: date | None
    status: str
    notes: str | None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseOrderItemResponse]

    model_config = {"from_attributes": True}


class PurchaseOrderListResponse(BaseModel):
    items: list[PurchaseOrderResponse]
    total: int
    page: int
    page_size: int


class GoodsReceiptItemCreate(BaseModel):
    purchase_order_item_id: int = Field(..., gt=0)
    received_quantity: int = Field(..., gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class GoodsReceiptCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    received_date: date
    notes: str | None = Field(default=None, max_length=2000)
    items: list[GoodsReceiptItemCreate] = Field(..., min_length=1)

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_request_id(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_items(self):
        item_ids = [item.purchase_order_item_id for item in self.items]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("Each purchase order item may appear only once in a receipt")
        return self


class GoodsReceiptItemResponse(BaseModel):
    id: int
    purchase_order_item_id: int
    product_id: int
    received_quantity: int
    unit_cost: Decimal

    model_config = {"from_attributes": True}


class GoodsReceiptResponse(BaseModel):
    id: int
    shop_id: int
    purchase_order_id: int
    receipt_number: str
    received_date: date
    client_request_id: str
    notes: str | None
    received_by: int | None
    created_at: datetime
    items: list[GoodsReceiptItemResponse]

    model_config = {"from_attributes": True}


PurchaseReturnReason = Literal[
    "damaged", "defective", "wrong_item", "excess_quantity", "quality_issue", "other"
]


class PurchaseReturnItemCreate(BaseModel):
    goods_receipt_item_id: int = Field(..., gt=0)
    returned_quantity: int = Field(..., gt=0)


class PurchaseReturnCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    return_date: date
    reason: PurchaseReturnReason
    notes: str | None = Field(default=None, max_length=2000)
    items: list[PurchaseReturnItemCreate] = Field(..., min_length=1)

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_request_id(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("notes", mode="before")
    @classmethod
    def strip_return_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_return(self):
        ids = [item.goods_receipt_item_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each goods receipt item may appear only once in a purchase return")
        if self.reason == "other" and not self.notes:
            raise ValueError("notes are required when reason is other")
        return self


class PurchaseReturnItemResponse(BaseModel):
    id: int
    product_id: int
    goods_receipt_item_id: int
    returned_quantity: int
    unit_cost: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class VendorCreditResponse(BaseModel):
    id: int
    shop_id: int
    vendor_id: int
    purchase_return_id: int
    vendor_bill_id: int | None
    amount: Decimal
    applied_amount: Decimal
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PurchaseReturnResponse(BaseModel):
    id: int
    shop_id: int
    vendor_id: int
    purchase_order_id: int
    goods_receipt_id: int | None
    return_number: str
    return_date: date
    reason: str
    notes: str | None
    client_request_id: str
    total_amount: Decimal
    created_by: int | None
    created_at: datetime
    items: list[PurchaseReturnItemResponse]
    credit: VendorCreditResponse | None = None

    model_config = {"from_attributes": True}


class PurchaseReturnEligibilityItem(BaseModel):
    goods_receipt_item_id: int
    goods_receipt_id: int
    receipt_number: str
    product_id: int
    product_name: str
    product_sku: str
    ordered_quantity: int
    received_quantity: int
    already_returned_quantity: int
    remaining_returnable_quantity: int
    current_stock_quantity: int
    unit_cost: Decimal
