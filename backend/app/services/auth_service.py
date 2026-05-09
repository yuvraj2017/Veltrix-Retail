from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.shop import Shop
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse, RegisterResponse


def _split_name(full_name: str | None):
    safe_name = (full_name or "").strip()
    if not safe_name:
        return "", ""

    parts = safe_name.split()
    first_name = parts[0] if parts else ""
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first_name, last_name


def register_shop_owner(
    shop_name: str,
    owner_name: str,
    email: str,
    category: str,
    phone: str,
    password: str,
    logo_url: str | None,
    db: Session,
):
    normalized_email = email.strip().lower()

    existing_shop = db.query(Shop).filter(Shop.email == normalized_email).first()
    if existing_shop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shop with this email already exists",
        )

    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    shop = Shop(
        name=shop_name.strip(),
        owner_name=owner_name.strip(),
        email=normalized_email,
        phone=phone.strip(),
        category=category.strip(),
        logo_url=logo_url,
        is_active=True,
    )
    db.add(shop)
    db.flush()

    first_name, last_name = _split_name(owner_name)

    user = User(
        shop_id=shop.id,
        full_name=owner_name.strip() if owner_name else "User",
        first_name=first_name or None,
        last_name=last_name or None,
        email=normalized_email,
        phone=phone.strip(),
        role="owner",
        password_hash=hash_password(password),
        profile_image_url=None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(shop)

    access_token = create_access_token(subject=str(user.id))

    return RegisterResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name or "User",
        role=user.role,
        shop_id=user.shop_id,
        shop_name=shop.name,
        shop_logo_url=shop.logo_url,
    )


def login_user(payload: LoginRequest, db: Session):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive",
        )

    shop = db.query(Shop).filter(Shop.id == user.shop_id).first()

    access_token = create_access_token(subject=str(user.id))

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name or "User",
        role=user.role,
        shop_id=user.shop_id,
        shop_name=shop.name if shop else None,
        shop_logo_url=shop.logo_url if shop else None,
    )


def get_me(current_user: User, db: Session):
    shop = db.query(Shop).filter(Shop.id == current_user.shop_id).first()

    return MeResponse(
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name or "User",
        role=current_user.role,
        shop_id=current_user.shop_id,
        shop_name=shop.name if shop else None,
        shop_logo_url=shop.logo_url if shop else None,
    )