from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ShopResponse(BaseModel):
    id: int
    name: str
    category: str
    email: EmailStr
    phone: str
    whatsapp_number: str | None = None
    address: str | None = None
    logo_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShopUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    category: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=20)
    whatsapp_number: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=255)
