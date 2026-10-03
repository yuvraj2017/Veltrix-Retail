from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class ShopResponse(BaseModel):
    id: int
    organization_id: int
    is_default_branch: bool
    name: str
    category: str
    email: EmailStr
    phone: str
    whatsapp_number: str | None = None
    address: str | None = None
    logo_url: str | None = None
    gst_enabled: bool = False
    gstin: str | None = None
    state: str | None = None
    gst_state_code: str | None = None
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
    gst_enabled: bool = False
    gstin: str | None = Field(default=None, max_length=15)
    state: str | None = Field(default=None, max_length=100)
    gst_state_code: str | None = Field(default=None, max_length=2)

    @field_validator("gstin", "state", "gst_state_code", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value
