from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


StaffRole = Literal[
    "admin",
    "manager",
    "cashier",
    "inventory_manager",
    "purchasing_manager",
    "report_viewer",
]
MembershipState = Literal["active", "inactive"]


class StaffCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    initial_password: str = Field(..., min_length=8, max_length=128)
    role: StaffRole
    branch_ids: list[int] = Field(..., min_length=1)
    default_shop_id: int


class StaffUpdate(BaseModel):
    role: StaffRole | None = None
    status: MembershipState | None = None

    @model_validator(mode="after")
    def require_change(self):
        if self.role is None and self.status is None:
            raise ValueError("At least one of role or status is required")
        return self


class StaffBranchAccess(BaseModel):
    shop_id: int
    shop_name: str
    status: str
    is_current: bool


class StaffResponse(BaseModel):
    membership_id: int
    user_id: int
    full_name: str
    email: EmailStr
    role: str
    membership_status: str
    account_status: str
    active_shop_id: int | None
    branches: list[StaffBranchAccess]
    created_at: datetime
    updated_at: datetime


class OwnershipTransferRequest(BaseModel):
    target_membership_id: int


class OwnershipTransferResponse(BaseModel):
    previous_owner: StaffResponse
    new_owner: StaffResponse
