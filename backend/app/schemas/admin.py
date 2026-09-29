from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.core.user_status import UserRole


class ShopPerformance(BaseModel):
    """Trading figures for one shop.

    Cancelled invoices are excluded, matching the shop owner's own reports, so
    the two views agree. All zeros for a super admin, who owns no shop.
    """

    invoice_count: int = 0
    total_revenue: Decimal = Decimal("0.00")
    total_profit: Decimal = Decimal("0.00")
    collected_amount: Decimal = Decimal("0.00")
    outstanding_amount: Decimal = Decimal("0.00")
    product_count: int = 0
    customer_count: int = 0
    last_invoice_date: date | None = None


class AdminUserListItem(ShopPerformance):
    """One row of the shop-owner list.

    Carries no credential material: no password hash, no tokens, no secrets.
    """

    id: int
    full_name: str
    email: EmailStr
    phone: str | None = None
    role: str
    status: str

    # None for a super admin, who operates the platform rather than a shop.
    shop_id: int | None = None
    shop_name: str | None = None
    has_shop: bool = True

    created_at: datetime
    last_login_at: datetime | None = None

    # The states this account may legally move to, computed server-side from
    # the transition table so the UI cannot invent an option that the API would
    # then refuse.
    allowed_transitions: list[str] = []

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int


class AdminUserAuditItem(BaseModel):
    id: int
    action: str
    actor_email: str
    actor_user_id: int | None = None
    target_email: str | None = None
    target_user_id: int | None = None
    target_entity_type: str | None = None
    target_entity_id: int | None = None
    previous_value: str | None = None
    new_value: str | None = None
    reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserDetailResponse(ShopPerformance):
    id: int
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    role: str
    status: str
    status_reason: str | None = None
    status_changed_at: datetime | None = None
    profile_image_url: str | None = None
    timezone: str | None = None
    language: str | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None

    shop_id: int | None = None
    shop_name: str | None = None
    shop_category: str | None = None
    shop_email: str | None = None
    shop_phone: str | None = None
    shop_address: str | None = None
    has_shop: bool = True

    allowed_transitions: list[str] = []
    can_change_role: bool = False

    audit_trail: list[AdminUserAuditItem] = []


class AdminStatusActionRequest(BaseModel):
    """Payload for approve / reject / suspend / reactivate / disable.

    `reason` is administrator-only context. It is stored on the account and
    surfaced in the audit trail, and is never returned to the account holder.
    """

    reason: str | None = Field(default=None, max_length=1000)


class AdminRoleChangeRequest(BaseModel):
    role: str

    model_config = {"json_schema_extra": {"example": {"role": UserRole.SUPER_ADMIN}}}


class AdminActionResponse(BaseModel):
    message: str
    user: AdminUserListItem


class AdminRecentRegistrationPoint(BaseModel):
    label: str
    day: date
    count: int


class AdminTopShopItem(BaseModel):
    """A shop ranked by revenue, named by its owner."""

    shop_id: int
    shop_name: str | None = None
    owner_user_id: int | None = None
    owner_name: str | None = None
    owner_email: EmailStr | None = None
    invoice_count: int
    total_revenue: Decimal
    total_profit: Decimal


class AdminStatsResponse(BaseModel):
    # Accounts
    total_users: int
    shop_owner_count: int
    super_admin_count: int
    pending_users: int
    active_users: int
    suspended_users: int
    rejected_users: int
    disabled_users: int
    total_shops: int

    # Signups
    registrations_last_7_days: int
    recent_registrations: list[AdminRecentRegistrationPoint]

    # Trading across every shop on the platform
    platform_invoice_count: int
    platform_revenue: Decimal
    platform_profit: Decimal
    platform_collected: Decimal
    platform_outstanding: Decimal
    platform_revenue_last_7_days: Decimal
    top_shops: list[AdminTopShopItem]

    # Administrative activity
    admin_actions_last_7_days: int
    recent_activity: list[AdminUserAuditItem]


class AdminAuditLogResponse(BaseModel):
    items: list[AdminUserAuditItem]
    total: int
    page: int
    page_size: int
