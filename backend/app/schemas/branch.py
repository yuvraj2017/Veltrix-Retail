from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class AccessibleBranchResponse(BaseModel):
    id: int
    name: str
    status: str
    is_default_branch: bool
    is_preferred: bool


class AccessibleBranchListResponse(BaseModel):
    items: list[AccessibleBranchResponse]


class BranchCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    category: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=20)
    whatsapp_number: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=255)
    gst_enabled: bool = False
    gstin: str | None = Field(default=None, max_length=15)
    state: str | None = Field(default=None, max_length=100)
    gst_state_code: str | None = Field(default=None, max_length=2)

    @field_validator("name", "category", "phone", mode="before")
    @classmethod
    def strip_required_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Value cannot be blank")
        return value

    @field_validator(
        "whatsapp_number",
        "address",
        "logo_url",
        "gstin",
        "state",
        "gst_state_code",
        mode="before",
    )
    @classmethod
    def strip_optional_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class BranchUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=150)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=20)
    whatsapp_number: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=255)
    gst_enabled: bool | None = None
    gstin: str | None = Field(default=None, max_length=15)
    state: str | None = Field(default=None, max_length=100)
    gst_state_code: str | None = Field(default=None, max_length=2)

    @field_validator("name", "category", "phone", mode="before")
    @classmethod
    def strip_required_update_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Value cannot be blank")
        return value

    @field_validator(
        "whatsapp_number",
        "address",
        "logo_url",
        "gstin",
        "state",
        "gst_state_code",
        mode="before",
    )
    @classmethod
    def strip_optional_update_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one branch field is required")
        return self


class BranchResponse(BaseModel):
    id: int
    organization_id: int
    is_default_branch: bool
    status: str
    name: str
    category: str
    email: EmailStr
    phone: str
    whatsapp_number: str | None = None
    address: str | None = None
    logo_url: str | None = None
    gst_enabled: bool
    gstin: str | None = None
    state: str | None = None
    gst_state_code: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BranchDirectoryResponse(BaseModel):
    items: list[BranchResponse]


class CommercialSourceReassignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shop_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason", mode="before")
    @classmethod
    def strip_reason(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value


class OrganizationCommercialSourceResponse(BaseModel):
    organization_id: int
    commercial_source_shop_id: int
    shop_name: str
    shop_status: str

