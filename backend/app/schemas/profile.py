from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class ProfileResponse(BaseModel):
    id: int
    shop_id: int
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    role: str
    profile_image_url: str | None = None
    timezone: str | None = None
    language: str
    two_factor_enabled: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    profile_image_url: str | None = Field(default=None, max_length=255)
    timezone: str | None = Field(default=None, max_length=100)
    language: str = Field(default="English (US)", max_length=50)
    two_factor_enabled: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class MessageResponse(BaseModel):
    message: str