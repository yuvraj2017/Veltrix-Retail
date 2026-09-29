from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.business_audit_log import BusinessAuditAction
from app.models.user import User
from app.schemas.business_audit import BusinessAuditLogResponse
from app.services.business_audit_service import list_business_audit_logs


router = APIRouter(prefix="/audit-logs", tags=["Business Audit"])


@router.get("", response_model=BusinessAuditLogResponse)
def list_my_business_audit_logs(
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    if action and action not in BusinessAuditAction.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"action must be one of: {', '.join(BusinessAuditAction.ALL)}",
        )

    return list_business_audit_logs(
        db,
        shop_id=current_user.shop_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        page=page,
        page_size=page_size,
    )
