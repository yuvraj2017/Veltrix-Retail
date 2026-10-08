from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class EntitlementValuePayload(BaseModel):
    limit_value: Decimal | None = Field(default=None, ge=0)
    is_unlimited: bool = False
    feature_enabled: bool | None = None


class PlanCreateRequest(BaseModel):
    code: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    monthly_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    annual_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    trial_days: int = Field(default=0, ge=0)
    grace_period_days: int = Field(default=0, ge=0)
    is_active: bool = True
    display_order: int = 0


class PlanUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = None
    monthly_price: Decimal | None = Field(default=None, ge=0)
    annual_price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    trial_days: int | None = Field(default=None, ge=0)
    grace_period_days: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    is_archived: bool | None = None
    display_order: int | None = None


class PlanResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    monthly_price: Decimal
    annual_price: Decimal
    currency: str
    trial_days: int
    grace_period_days: int
    is_active: bool
    is_archived: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EntitlementDefinitionCreateRequest(BaseModel):
    key: str = Field(min_length=3, max_length=120)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    kind: str
    value_type: str
    resource_key: str | None = Field(default=None, max_length=100)
    is_active: bool = True


class EntitlementDefinitionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = None
    is_active: bool | None = None


class EntitlementDefinitionResponse(BaseModel):
    id: int
    key: str
    name: str
    description: str | None = None
    kind: str
    value_type: str
    resource_key: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanEntitlementResponse(BaseModel):
    id: int
    plan_id: int
    entitlement_id: int
    entitlement_key: str
    entitlement_name: str
    kind: str
    resource_key: str | None = None
    limit_value: Decimal | None = None
    is_unlimited: bool
    feature_enabled: bool | None = None
    created_at: datetime
    updated_at: datetime


class ShopOverrideCreateRequest(EntitlementValuePayload):
    entitlement_id: int
    reason: str | None = Field(default=None, max_length=2000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class ShopOverrideResponse(BaseModel):
    id: int
    shop_id: int
    entitlement_id: int
    entitlement_key: str
    kind: str
    resource_key: str | None = None
    limit_value: Decimal | None = None
    is_unlimited: bool
    feature_enabled: bool | None = None
    reason: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    created_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime


class SubscriptionAssignRequest(BaseModel):
    plan_id: int
    status: str = "active"
    billing_interval: str = "monthly"
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    reason: str | None = Field(default=None, max_length=2000)


class SubscriptionStatusUpdateRequest(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=2000)


class LicenseStatusUpdateRequest(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=2000)


class LicenseReplacementRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class LicenseResponse(BaseModel):
    id: int
    shop_id: int
    subscription_id: int
    masked_key: str
    status: str
    issued_at: datetime
    activated_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id: int
    shop_id: int
    plan_id: int
    plan: PlanResponse | None = None
    status: str
    billing_interval: str
    trial_start_at: datetime | None = None
    trial_end_at: datetime | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at: datetime | None = None
    cancelled_at: datetime | None = None
    provider: str | None = None
    provider_customer_id: str | None = None
    provider_subscription_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsageLimitResponse(BaseModel):
    key: str
    resource_key: str | None
    configured: bool
    source: str | None = None
    is_unlimited: bool
    limit_value: Decimal | None = None
    used: int | None = None
    remaining: Decimal | None = None
    usage_supported: bool
    over_limit: bool = False
    code: str | None = None
    message: str | None = None


class FeatureEntitlementResponse(BaseModel):
    key: str
    enabled: bool
    configured: bool
    source: str | None = None


class ShopSubscriptionOverviewResponse(BaseModel):
    shop_id: int
    plan: PlanResponse | None = None
    subscription: SubscriptionResponse | None = None
    license: LicenseResponse | None = None
    limits: list[UsageLimitResponse]
    features: list[FeatureEntitlementResponse]
    access_allowed: bool
    access_code: str | None = None
    access_message: str | None = None


class PaymentCreateRequest(BaseModel):
    shop_id: int
    plan_id: int
    amount: Decimal = Field(ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    billing_interval: str = "monthly"
    provider: str = "manual"
    provider_payment_id: str
    provider_order_id: str | None = None
    provider_event_id: str | None = None
    status: str = "succeeded"
    reason: str | None = Field(default=None, max_length=2000)


class PaymentResponse(BaseModel):
    id: int
    shop_id: int
    subscription_id: int | None = None
    provider: str
    provider_payment_id: str
    provider_order_id: str | None = None
    provider_event_id: str | None = None
    status: str
    amount: Decimal
    currency: str
    billing_interval: str | None = None
    paid_at: datetime | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    customer_reference: str | None = None
    reviewed_by_user_id: int | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CheckoutSessionRequest(BaseModel):
    plan_id: int
    billing_interval: str = "monthly"


class CheckoutSessionResponse(BaseModel):
    provider: str
    status: str
    message: str
    checkout_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PublicPlanResponse(PlanResponse):
    entitlements: list[PlanEntitlementResponse] = Field(default_factory=list)


class PaymentGatewayConfigRequest(BaseModel):
    provider: str = "razorpay"
    display_name: str = Field(default="Razorpay", min_length=2, max_length=120)
    key_id: str | None = Field(default=None, max_length=150)
    key_secret: str | None = Field(default=None, max_length=500)
    webhook_secret: str | None = Field(default=None, max_length=500)
    settings: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    is_test_mode: bool = True


class PaymentGatewayConfigResponse(BaseModel):
    id: int
    provider: str
    display_name: str
    key_id: str | None = None
    key_secret_masked: str | None = None
    webhook_secret_masked: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    is_active: bool
    is_test_mode: bool
    created_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime


class RazorpayVerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class UpiPaymentReferenceRequest(BaseModel):
    payment_id: str = Field(min_length=10, max_length=150)
    customer_reference: str = Field(min_length=6, max_length=100)

    @field_validator("customer_reference")
    @classmethod
    def normalize_reference(cls, value: str) -> str:
        normalized = "".join(value.strip().upper().split())
        if not normalized.isalnum():
            raise ValueError("Payment reference must contain only letters and numbers")
        return normalized


class UpiPaymentReviewRequest(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=2000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"succeeded", "failed"}:
            raise ValueError("status must be succeeded or failed")
        return normalized


class PaymentVerificationResponse(BaseModel):
    status: str
    message: str
    subscription: SubscriptionResponse | None = None
    payment: PaymentResponse | None = None
