from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductImageResponse(BaseModel):
    id: int
    image_url: str
    sort_order: int
    is_main: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    sku: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., min_length=2, max_length=100)
    description: str | None = None

    buying_price: Decimal = Field(default=0)
    mrp: Decimal = Field(default=0)
    selling_price: Decimal = Field(default=0)

    stock_quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)

    unit: str = Field(default="pcs", min_length=1, max_length=50)
    barcode: str | None = None
    is_active: bool = True
    main_image_url: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    sku: str | None = Field(default=None, min_length=2, max_length=100)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None

    buying_price: Decimal | None = None
    mrp: Decimal | None = None
    selling_price: Decimal | None = None

    stock_quantity: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)

    unit: str | None = Field(default=None, min_length=1, max_length=50)
    barcode: str | None = None
    is_active: bool | None = None
    main_image_url: str | None = None


class ProductResponse(BaseModel):
    id: int
    shop_id: int

    name: str
    sku: str
    category: str
    description: str | None

    buying_price: Decimal
    mrp: Decimal
    selling_price: Decimal

    stock_quantity: int
    low_stock_threshold: int

    unit: str
    barcode: str | None
    is_active: bool
    main_image_url: str | None

    total_units_sold: int
    total_sales_amount: Decimal
    total_profit_amount: Decimal
    last_sold_at: datetime | None
    last_restocked_at: datetime | None

    created_at: datetime
    updated_at: datetime

    images: list[ProductImageResponse] = []

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int


class ProductStatsResponse(BaseModel):
    total_items: int
    out_of_stock: int
    low_stock_count: int
    inventory_value: Decimal