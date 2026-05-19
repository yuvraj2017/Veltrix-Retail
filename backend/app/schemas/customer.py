from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


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

    @field_validator("first_name", "last_name", "phone", "city", "state", "pincode", "gst_number", mode="before")
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

    @field_validator("first_name", "last_name", "phone", "city", "state", "pincode", "gst_number", mode="before")
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


class CustomerMessageResponse(BaseModel):
    message: str