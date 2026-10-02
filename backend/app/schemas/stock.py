from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ADJUSTMENT_IN_REASONS = {
    "manual_correction",
    "found_stock",
    "return_to_sellable",
    "other",
}
ADJUSTMENT_OUT_REASONS = {
    "damaged",
    "defective",
    "expired",
    "lost",
    "theft_shrinkage",
    "manual_correction",
    "other",
}


class StockAdjustmentCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    direction: Literal["in", "out"]
    quantity: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_client_request_id(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_reason(self):
        allowed = ADJUSTMENT_IN_REASONS if self.direction == "in" else ADJUSTMENT_OUT_REASONS
        if self.reason not in allowed:
            raise ValueError(f"Unsupported {self.direction} adjustment reason")
        if self.reason == "other" and not self.notes:
            raise ValueError("notes are required when reason is other")
        return self


class PhysicalStockCountCreate(BaseModel):
    client_request_id: str = Field(..., min_length=8, max_length=100)
    counted_quantity: int = Field(..., ge=0)
    reason: str = Field(..., min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("client_request_id", mode="before")
    @classmethod
    def strip_client_request_id(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_notes(self):
        if self.reason not in ADJUSTMENT_IN_REASONS | ADJUSTMENT_OUT_REASONS:
            raise ValueError("Unsupported physical count reason")
        if self.reason == "other" and not self.notes:
            raise ValueError("notes are required when reason is other")
        return self


class StockAdjustmentResult(BaseModel):
    id: int
    product_id: int
    operation_type: str
    movement_id: int | None = None
    movement_type: str | None = None
    quantity_before: int
    quantity_delta: int
    quantity_after: int
    reason: str
    notes: str | None = None
    client_request_id: str
    replayed: bool = False


class StockMovementResponse(BaseModel):
    id: int
    shop_id: int
    product_id: int
    movement_type: str
    quantity_delta: int
    quantity_before: int
    quantity_after: int
    reference_type: str
    reference_id: int | None = None
    reference_line_id: int | None = None
    reason: str | None = None
    notes: str | None = None
    created_by: int | None = None
    occurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class StockMovementListResponse(BaseModel):
    items: list[StockMovementResponse]
    total: int
    page: int
    page_size: int


class StockReconciliationItem(BaseModel):
    product_id: int
    sku: str
    product_name: str
    current_balance: int
    ledger_balance: int
    difference: int
    matches: bool


class StockReconciliationResponse(BaseModel):
    items: list[StockReconciliationItem]
    checked_products: int
    mismatch_count: int


class InventorySummaryResponse(BaseModel):
    active_products: int
    total_sellable_units: int
    low_stock_products: int
    out_of_stock_products: int
    current_inventory_value: Decimal
    reconciliation_mismatches: int
    open_purchase_orders: int
    partially_received_purchase_orders: int
    unapplied_vendor_credit: Decimal
    valuation_basis: str


class InventoryProductItem(BaseModel):
    product_id: int
    name: str
    sku: str
    barcode: str | None
    category: str
    is_active: bool
    stock_quantity: int
    low_stock_threshold: int
    stock_status: str
    threshold_gap: int
    buying_price: Decimal
    inventory_value: Decimal
    incoming_quantity: int


class InventoryProductListResponse(BaseModel):
    items: list[InventoryProductItem]
    total: int
    page: int
    page_size: int


class InventoryMovementItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    movement_type: str
    quantity_before: int
    quantity_delta: int
    quantity_after: int
    direction: str
    reason: str | None
    notes: str | None
    reference_type: str
    reference_label: str
    reference_url: str | None
    actor_name: str | None
    occurred_at: datetime


class InventoryMovementListResponse(BaseModel):
    items: list[InventoryMovementItem]
    total: int
    page: int
    page_size: int


class InventoryActivityResponse(BaseModel):
    date_from: date
    date_to: date
    opening_balance_units: int
    units_sold: int
    customer_return_units_restocked: int
    purchase_units_received: int
    purchase_units_returned: int
    adjustment_in_units: int
    adjustment_out_units: int
    draft_reserved_units: int
    draft_released_units: int
    net_movement: int
    current_sellable_units: int


class PurchasingReportItem(BaseModel):
    purchase_order_id: int
    purchase_order_number: str
    vendor_id: int
    vendor_name: str
    order_date: date
    expected_date: date | None
    status: str
    ordered_quantity: int
    received_quantity: int
    remaining_quantity: int
    ordered_value: Decimal
    purchase_return_quantity: int
    purchase_return_value: Decimal
    overdue_expected_receipt: bool


class PurchasingReportResponse(BaseModel):
    items: list[PurchasingReportItem]
    total: int
    page: int
    page_size: int


class VendorPurchasingInsight(BaseModel):
    vendor_id: int
    vendor_name: str
    purchase_order_count: int
    ordered_value: Decimal
    received_value: Decimal
    purchase_return_value: Decimal
    outstanding_vendor_bills: Decimal
    unapplied_vendor_credit: Decimal


class VendorPurchasingInsightResponse(BaseModel):
    items: list[VendorPurchasingInsight]
    total: int
    page: int
    page_size: int


class ProductInventoryDetailResponse(BaseModel):
    product: InventoryProductItem
    reconciliation: StockReconciliationItem
    recent_movements: list[InventoryMovementItem]
    recent_receipts: list[dict]
    recent_purchase_returns: list[dict]
