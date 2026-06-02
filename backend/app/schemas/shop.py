from datetime import datetime

from pydantic import BaseModel, EmailStr


class ShopResponse(BaseModel):
    id: int
    name: str
    category: str
    email: EmailStr
    phone: str
    address: str | None = None
    logo_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}