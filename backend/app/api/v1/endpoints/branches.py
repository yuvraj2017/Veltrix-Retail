from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_tenant_authorization_context,
    require_active_shop_access,
)
from app.core.membership import MembershipStatus
from app.core.shop_status import ShopStatus
from app.models.membership import BranchMembership
from app.models.shop import Shop
from app.schemas.branch import (
    AccessibleBranchListResponse,
    BranchCreateRequest,
    BranchDirectoryResponse,
    BranchResponse,
    BranchUpdateRequest,
    CommercialSourceReassignmentRequest,
    OrganizationCommercialSourceResponse,
)
from app.services.authorization_service import TenantAuthorizationContext
from app.services.branch_service import (
    activate_branch,
    create_branch,
    deactivate_branch,
    get_organization_branch,
    list_organization_branches,
    make_default_branch,
    update_branch,
)
from app.services.organization_entitlement_service import (
    commercial_source_response,
    reassign_commercial_source_as_owner,
)

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.get("", response_model=AccessibleBranchListResponse)
def list_accessible_branches(
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Shop)
        .join(
            BranchMembership,
            (BranchMembership.shop_id == Shop.id)
            & (BranchMembership.organization_id == Shop.organization_id),
        )
        .filter(
            Shop.organization_id == context.organization.id,
            BranchMembership.organization_membership_id
            == context.organization_membership.id,
            BranchMembership.status == MembershipStatus.ACTIVE,
            Shop.status == ShopStatus.ACTIVE,
        )
        .order_by(Shop.is_default_branch.desc(), Shop.name.asc(), Shop.id.asc())
        .all()
    )
    return {
        "items": [
            {
                "id": shop.id,
                "name": shop.name,
                "status": shop.status,
                "is_default_branch": shop.is_default_branch,
                "is_preferred": shop.id == context.user.shop_id,
            }
            for shop in rows
        ]
    }


@router.get("/directory", response_model=BranchDirectoryResponse)
def list_organization_branch_directory(
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return {"items": list_organization_branches(db, context)}


@router.post(
    "/commercial-source",
    response_model=OrganizationCommercialSourceResponse,
)
def reassign_current_organization_commercial_source(
    payload: CommercialSourceReassignmentRequest,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    source = reassign_commercial_source_as_owner(
        db,
        context,
        target_shop_id=payload.shop_id,
        reason=payload.reason,
    )
    return commercial_source_response(source)


@router.get("/{branch_id}", response_model=BranchResponse)
def get_organization_branch_detail(
    branch_id: int,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return get_organization_branch(db, context, branch_id)


@router.post("", response_model=BranchResponse, status_code=201)
def create_organization_branch(
    payload: BranchCreateRequest,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return create_branch(db, context, payload)


@router.patch("/{branch_id}", response_model=BranchResponse)
def update_organization_branch(
    branch_id: int,
    payload: BranchUpdateRequest,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return update_branch(db, context, branch_id, payload)


@router.post("/{branch_id}/activate", response_model=BranchResponse)
def activate_organization_branch(
    branch_id: int,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return activate_branch(db, context, branch_id)


@router.post("/{branch_id}/deactivate", response_model=BranchResponse)
def deactivate_organization_branch(
    branch_id: int,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return deactivate_branch(db, context, branch_id)


@router.post("/{branch_id}/make-default", response_model=BranchResponse)
def make_organization_branch_default(
    branch_id: int,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    _authorized_user=Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return make_default_branch(db, context, branch_id)

