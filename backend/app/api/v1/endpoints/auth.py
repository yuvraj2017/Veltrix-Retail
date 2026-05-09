import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse, RegisterResponse
from app.services.auth_service import get_me, login_user, register_shop_owner

router = APIRouter(prefix="/auth", tags=["Auth"])

UPLOAD_DIR = "uploads/logos"
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    shop_name: str = Form(...),
    owner_name: str = Form(...),
    email: str = Form(...),
    category: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    logo_url = None

    if logo:
        if logo.content_type not in ALLOWED_IMAGE_TYPES:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only png, jpg, jpeg, and webp files are allowed",
            )

        os.makedirs(UPLOAD_DIR, exist_ok=True)

        ext = os.path.splitext(logo.filename or "")[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

        logo_url = f"/uploads/logos/{filename}"

    return register_shop_owner(
        shop_name=shop_name,
        owner_name=owner_name,
        email=email,
        category=category,
        phone=phone,
        password=password,
        logo_url=logo_url,
        db=db,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return login_user(payload, db)


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_me(current_user, db)