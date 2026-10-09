"""Super Admin endpoints.

Every route in this router depends on ``require_super_admin``, which itself
depends on ``get_current_user``. That chain gives each request:

    authenticate -> verify account status -> verify role -> validate -> act

There is no route here that a non-super-admin can reach. The frontend hiding
navigation is UX layering only; this is the security boundary.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_super_admin
from app.core.user_status import UserStatus
from app.models.admin_audit_log import AuditAction
from app.models.shop import Shop
from app.models.user import User
from app.schemas.admin import (
    AdminActionResponse,
    AdminAuditLogResponse,
    AdminRoleChangeRequest,
    AdminStatsResponse,
    AdminStatusActionRequest,
    AdminUserDetailResponse,
    AdminUserListResponse,
)
from app.schemas.subscription import (
    EntitlementDefinitionCreateRequest,
    EntitlementDefinitionResponse,
    EntitlementDefinitionUpdateRequest,
    EntitlementValuePayload,
    LicenseResponse,
    LicenseReplacementRequest,
    LicenseStatusUpdateRequest,
    PaymentCreateRequest,
    PaymentGatewayConfigRequest,
    PaymentGatewayConfigResponse,
    PaymentResponse,
    PaymentVerificationResponse,
    PlanCreateRequest,
    PlanCatalogPublishRequest,
    PlanCatalogVersionResponse,
    PlanEntitlementResponse,
    PlanResponse,
    PlanUpdateRequest,
    ShopOverrideCreateRequest,
    ShopOverrideResponse,
    ShopSubscriptionOverviewResponse,
    SubscriptionAssignRequest,
    SubscriptionResponse,
    SubscriptionStatusUpdateRequest,
    UpiPaymentReviewRequest,
)
from app.services import admin_service, audit_service, commercial_service
from app.services.admin_service import (
    DEFAULT_ADMIN_PAGE_SIZE,
    MAX_ADMIN_PAGE_SIZE,
)

router = APIRouter(prefix="/admin", tags=["Super Admin"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return admin_service.get_admin_stats(db)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(
        default=DEFAULT_ADMIN_PAGE_SIZE, ge=1, le=MAX_ADMIN_PAGE_SIZE
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Paginated user directory across all shops.

    Search, filtering, sorting and paging are all applied in SQL -- the browser
    never receives the full table.
    """
    return admin_service.list_users(
        db,
        search=search,
        status_filter=status,
        role_filter=role,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return admin_service.get_user_detail(user_id, db, current_user)


# ---------------------------------------------------------------------------
# Status transitions
#
# One endpoint per action rather than a single "set status" route: the verbs
# are what an administrator actually intends, and each one maps to a distinct
# audit event. The service re-validates the transition against the target's
# current state, so a repeated call is a 409 rather than a silent no-op.
# ---------------------------------------------------------------------------

@router.post("/users/{user_id}/approve", response_model=AdminActionResponse)
def approve_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """PENDING -> ACTIVE. The account can sign in immediately afterwards."""
    return admin_service.change_user_status(
        user_id,
        UserStatus.ACTIVE,
        db,
        current_user,
        ip_address=_client_ip(request),
    )


@router.post("/users/{user_id}/reject", response_model=AdminActionResponse)
def reject_user(
    user_id: int,
    request: Request,
    payload: AdminStatusActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """PENDING -> REJECTED. Terminal."""
    return admin_service.change_user_status(
        user_id,
        UserStatus.REJECTED,
        db,
        current_user,
        reason=payload.reason if payload else None,
        ip_address=_client_ip(request),
    )


@router.post("/users/{user_id}/suspend", response_model=AdminActionResponse)
def suspend_user(
    user_id: int,
    request: Request,
    payload: AdminStatusActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """ACTIVE -> SUSPENDED. Reversible.

    Takes effect on the target's very next request: get_current_user re-reads
    the user row every time, so an already-issued token stops working without
    any token revocation machinery.
    """
    return admin_service.change_user_status(
        user_id,
        UserStatus.SUSPENDED,
        db,
        current_user,
        reason=payload.reason if payload else None,
        ip_address=_client_ip(request),
    )


@router.post("/users/{user_id}/reactivate", response_model=AdminActionResponse)
def reactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """SUSPENDED -> ACTIVE."""
    return admin_service.change_user_status(
        user_id,
        UserStatus.ACTIVE,
        db,
        current_user,
        ip_address=_client_ip(request),
    )


@router.post("/users/{user_id}/disable", response_model=AdminActionResponse)
def disable_user(
    user_id: int,
    request: Request,
    payload: AdminStatusActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """{ACTIVE, SUSPENDED} -> DISABLED. Terminal."""
    return admin_service.change_user_status(
        user_id,
        UserStatus.DISABLED,
        db,
        current_user,
        reason=payload.reason if payload else None,
        ip_address=_client_ip(request),
    )


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}/role", response_model=AdminActionResponse)
def change_user_role(
    user_id: int,
    payload: AdminRoleChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Assign a role.

    Self-promotion is impossible: a regular user is refused at the dependency,
    and a super admin cannot target their own account.
    """
    return admin_service.change_user_role(
        user_id,
        payload.role,
        db,
        current_user,
        ip_address=_client_ip(request),
    )


# ---------------------------------------------------------------------------
# Commercial plans, entitlements, subscriptions and licenses
# ---------------------------------------------------------------------------

@router.get("/plans", response_model=list[PlanResponse])
def list_plans(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.list_plans(db, include_archived=include_archived)


@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.create_plan(
        db,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.patch("/plans/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: int,
    payload: PlanUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.update_plan(
        db,
        plan_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.post(
    "/plans/{plan_id}/catalog-versions",
    response_model=PlanCatalogVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def publish_plan_catalog_version(
    plan_id: int,
    payload: PlanCatalogPublishRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.publish_plan_catalog_version(
        db,
        plan_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.get("/plans/{plan_id}/entitlements", response_model=list[PlanEntitlementResponse])
def list_plan_entitlements(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.list_plan_entitlements(db, plan_id)


@router.put(
    "/plans/{plan_id}/entitlements/{entitlement_id}",
    response_model=PlanEntitlementResponse,
)
def upsert_plan_entitlement(
    plan_id: int,
    entitlement_id: int,
    payload: EntitlementValuePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.upsert_plan_entitlement(
        db,
        plan_id,
        entitlement_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.get("/entitlements", response_model=list[EntitlementDefinitionResponse])
def list_entitlement_definitions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.list_entitlement_definitions(db)


@router.post(
    "/entitlements",
    response_model=EntitlementDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_entitlement_definition(
    payload: EntitlementDefinitionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.create_entitlement_definition(
        db,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.patch("/entitlements/{entitlement_id}", response_model=EntitlementDefinitionResponse)
def update_entitlement_definition(
    entitlement_id: int,
    payload: EntitlementDefinitionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.update_entitlement_definition(
        db,
        entitlement_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.get("/shops")
def list_shops(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    rows = (
        db.query(Shop)
        .order_by(Shop.created_at.desc(), Shop.id.desc())
        .limit(500)
        .all()
    )
    return [
        {
            "id": shop.id,
            "name": shop.name,
            "category": shop.category,
            "email": shop.email,
            "phone": shop.phone,
            "created_at": shop.created_at,
        }
        for shop in rows
    ]


@router.get(
    "/shops/{shop_id}/subscription",
    response_model=ShopSubscriptionOverviewResponse,
)
def get_shop_subscription_overview(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.build_shop_subscription_overview(db, shop_id)


@router.post("/shops/{shop_id}/subscription", response_model=SubscriptionResponse)
def assign_shop_subscription(
    shop_id: int,
    payload: SubscriptionAssignRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.assign_shop_subscription(
        db,
        shop_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.patch("/subscriptions/{subscription_id}/status", response_model=SubscriptionResponse)
def update_subscription_status(
    subscription_id: int,
    payload: SubscriptionStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.update_subscription_status(
        db,
        subscription_id,
        payload.status,
        current_user,
        reason=payload.reason,
        ip_address=_client_ip(request),
    )


@router.patch("/licenses/{license_id}/status", response_model=LicenseResponse)
def update_license_status(
    license_id: int,
    payload: LicenseStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.update_license_status(
        db,
        license_id,
        payload.status,
        current_user,
        reason=payload.reason,
        ip_address=_client_ip(request),
    )


@router.post(
    "/subscriptions/{subscription_id}/licenses/replacement",
    response_model=LicenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_replacement_license(
    subscription_id: int,
    payload: LicenseReplacementRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.issue_replacement_license(
        db,
        subscription_id,
        current_user,
        reason=payload.reason,
        ip_address=_client_ip(request),
    )


@router.get("/shops/{shop_id}/overrides", response_model=list[ShopOverrideResponse])
def list_shop_overrides(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.list_shop_overrides(db, shop_id)


@router.post(
    "/shops/{shop_id}/overrides",
    response_model=ShopOverrideResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shop_override(
    shop_id: int,
    payload: ShopOverrideCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.create_shop_override(
        db,
        shop_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.post("/overrides/{override_id}/expire", response_model=ShopOverrideResponse)
def expire_shop_override(
    override_id: int,
    request: Request,
    payload: AdminStatusActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.expire_shop_override(
        db,
        override_id,
        current_user,
        reason=payload.reason if payload else None,
        ip_address=_client_ip(request),
    )


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.record_payment(
        db,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.get("/payments", response_model=list[PaymentResponse])
def list_payments(
    shop_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.list_payments(db, shop_id=shop_id)


@router.post("/payments/{payment_id}/upi-review", response_model=PaymentVerificationResponse)
def review_upi_payment(
    payment_id: int,
    payload: UpiPaymentReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.review_upi_payment(
        db,
        payment_id,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


@router.get("/payment-gateways", response_model=list[PaymentGatewayConfigResponse])
def list_payment_gateways(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.get_payment_gateway_configs(db)


@router.post("/payment-gateways", response_model=PaymentGatewayConfigResponse)
def save_payment_gateway(
    payload: PaymentGatewayConfigRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return commercial_service.save_payment_gateway_config(
        db,
        payload,
        current_user,
        ip_address=_client_ip(request),
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=AdminAuditLogResponse)
def list_audit_logs(
    action: Optional[str] = Query(default=None),
    actor_id: Optional[int] = Query(default=None),
    target_user_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Administrative activity, newest first. Super-admin only, like everything
    else in this router -- the audit trail is itself protected."""
    if action and action not in AuditAction.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"action must be one of: {', '.join(AuditAction.ALL)}",
        )

    return audit_service.list_audit_logs(
        db,
        action=action,
        actor_id=actor_id,
        target_user_id=target_user_id,
        page=page,
        page_size=page_size,
    )
