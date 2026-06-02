from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.profile import (
    ChangePasswordRequest,
    MessageResponse,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.profile_service import (
    change_my_password,
    get_my_profile,
    update_my_profile,
)

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/me", response_model=ProfileResponse)
def get_profile_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_profile(current_user, db)


@router.put("/me", response_model=ProfileResponse)
def update_profile_endpoint(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_my_profile(payload, current_user, db)


@router.put("/change-password", response_model=MessageResponse)
def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_my_password(payload, current_user, db)