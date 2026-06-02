from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.profile import ChangePasswordRequest, ProfileUpdateRequest


def _split_full_name(full_name: str | None):
    safe_name = (full_name or "").strip()
    if not safe_name:
        return "", ""

    parts = safe_name.split()
    first_name = parts[0] if parts else ""
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first_name, last_name


def _safe_full_name(user: User):
    if user.full_name and user.full_name.strip():
        return user.full_name.strip()

    combined = f"{user.first_name or ''} {user.last_name or ''}".strip()
    if combined:
        return combined

    if user.email:
        return user.email.split("@")[0]

    return "User"


def get_my_profile(current_user: User, db: Session):
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    safe_full_name = _safe_full_name(user)
    first_name, last_name = _split_full_name(safe_full_name)

    if not user.first_name:
        user.first_name = first_name or None
    if not user.last_name:
        user.last_name = last_name or None
    if not user.full_name:
        user.full_name = safe_full_name
    if not user.language:
        user.language = "English (US)"

    db.commit()
    db.refresh(user)
    return user


def update_my_profile(payload: ProfileUpdateRequest, current_user: User, db: Session):
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.phone = payload.phone
    user.profile_image_url = payload.profile_image_url
    user.timezone = payload.timezone
    user.language = payload.language or "English (US)"
    user.two_factor_enabled = bool(payload.two_factor_enabled)

    safe_full_name = (payload.full_name or "").strip()
    if not safe_full_name:
        safe_full_name = f"{payload.first_name or ''} {payload.last_name or ''}".strip()

    if not safe_full_name:
        safe_full_name = user.email.split("@")[0] if user.email else "User"

    user.full_name = safe_full_name

    db.commit()
    db.refresh(user)
    return user


def change_my_password(payload: ChangePasswordRequest, current_user: User, db: Session):
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(user)

    return {"message": "Password changed successfully"}