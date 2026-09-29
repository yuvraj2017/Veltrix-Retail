from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AuthMessageResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RegisterResponse,
    ResetPasswordRequest,
    ResetTokenValidationResponse,
)
from app.services.auth_service import (
    get_me,
    login_user,
    register_shop_owner,
    request_password_reset,
    reset_password,
    validate_password_reset_token,
)
from app.services.email_service import send_password_reset_email
from app.services.image_service import ImageProcessingError, save_optimized_image

router = APIRouter(prefix="/auth", tags=["Auth"])

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    shop_name: str = Form(...),
    owner_name: str = Form(...),
    email: str = Form(...),
    category: str = Form(...),
    phone: str = Form(...),
    whatsapp_number: str | None = Form(None),
    shop_address: str | None = Form(None),
    password: str = Form(...),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    logo_url = None

    if logo:
        if logo.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only png, jpg, jpeg, and webp files are allowed",
            )

        try:
            # Logos render at 40-48 px in the sidebar and header, so the
            # original upload is downscaled and re-encoded rather than stored
            # as-is. The thumbnail variant is written for future use by the
            # avatar slots; logo_url keeps pointing at the full-size file.
            logo_url, _logo_thumbnail_url = save_optimized_image(logo, "logos")
        except ImageProcessingError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return register_shop_owner(
        shop_name=shop_name,
        owner_name=owner_name,
        email=email,
        category=category,
        phone=phone,
        whatsapp_number=whatsapp_number,
        shop_address=shop_address,
        password=password,
        logo_url=logo_url,
        db=db,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return login_user(payload, db)


@router.post("/forgot-password", response_model=AuthMessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    response, email_payload = request_password_reset(
        payload,
        db,
        requested_from_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    if email_payload:
        background_tasks.add_task(
            send_password_reset_email,
            recipient_email=email_payload.recipient_email,
            recipient_name=email_payload.recipient_name,
            reset_link=email_payload.reset_link,
        )

    return response


@router.get("/reset-password/validate", response_model=ResetTokenValidationResponse)
def validate_reset_password_token(
    token: str = Query(..., min_length=32),
    db: Session = Depends(get_db),
):
    return validate_password_reset_token(token, db)


@router.post("/reset-password", response_model=AuthMessageResponse)
def reset_password_endpoint(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    return reset_password(payload, db)


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_me(current_user, db)
