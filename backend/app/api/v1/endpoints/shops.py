from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.shop import ShopResponse, ShopUpdateRequest
from app.services.shop_service import get_shop_for_user, update_shop_for_user

router = APIRouter(prefix="/shops", tags=["Shops"])


@router.get("/{shop_id}", response_model=ShopResponse)
def get_shop_endpoint(
    shop_id: int,
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return get_shop_for_user(shop_id, current_user, db)


@router.put("/{shop_id}", response_model=ShopResponse)
def update_shop_endpoint(
    shop_id: int,
    payload: ShopUpdateRequest,
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return update_shop_for_user(shop_id, payload, current_user, db)
