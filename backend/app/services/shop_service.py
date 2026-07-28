from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.shop import Shop
from app.models.user import User
from app.schemas.shop import ShopUpdateRequest


def get_shop_for_user(shop_id: int, current_user: User, db: Session):
    if shop_id != current_user.shop_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this shop",
        )

    shop = db.query(Shop).filter(Shop.id == current_user.shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found",
        )

    return shop


def update_shop_for_user(
    shop_id: int,
    payload: ShopUpdateRequest,
    current_user: User,
    db: Session,
):
    shop = get_shop_for_user(shop_id, current_user, db)

    shop.name = payload.name.strip()
    shop.category = payload.category.strip()
    shop.email = payload.email.strip().lower()
    shop.phone = payload.phone.strip()
    shop.whatsapp_number = payload.whatsapp_number.strip() if payload.whatsapp_number else None
    shop.address = payload.address.strip() if payload.address else None
    shop.logo_url = payload.logo_url.strip() if payload.logo_url else None

    db.commit()
    db.refresh(shop)
    return shop
