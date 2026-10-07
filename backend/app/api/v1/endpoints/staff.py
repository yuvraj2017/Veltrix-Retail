from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_tenant_authorization_context,
    require_active_shop_access,
)
from app.models.user import User
from app.schemas.staff import (
    OwnershipTransferRequest,
    OwnershipTransferResponse,
    StaffCreate,
    StaffResponse,
    StaffUpdate,
)
from app.services.authorization_service import TenantAuthorizationContext
from app.services.staff_service import (
    create_staff,
    get_staff,
    grant_branch_access,
    list_staff,
    revoke_branch_access,
    transfer_ownership,
    update_staff,
)


router = APIRouter(prefix="/organizations/current/staff", tags=["Staff"])


@router.get("", response_model=list[StaffResponse])
def list_current_organization_staff(
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return list_staff(db, context)


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_current_organization_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return create_staff(db, context, payload)


@router.post("/ownership-transfer", response_model=OwnershipTransferResponse)
def transfer_current_organization_ownership(
    payload: OwnershipTransferRequest,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return transfer_ownership(db, context, payload.target_membership_id)


@router.get("/{membership_id}", response_model=StaffResponse)
def get_current_organization_staff_member(
    membership_id: int,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return get_staff(db, context, membership_id)


@router.patch("/{membership_id}", response_model=StaffResponse)
def update_current_organization_staff_member(
    membership_id: int,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return update_staff(db, context, membership_id, payload)


@router.post("/{membership_id}/branches/{shop_id}", response_model=StaffResponse)
def grant_current_organization_staff_branch(
    membership_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return grant_branch_access(db, context, membership_id, shop_id)


@router.delete("/{membership_id}/branches/{shop_id}", response_model=StaffResponse)
def revoke_current_organization_staff_branch(
    membership_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user: User = Depends(require_active_shop_access),
):
    return revoke_branch_access(db, context, membership_id, shop_id)
