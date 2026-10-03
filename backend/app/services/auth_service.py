import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.core.user_status import (
    UserRole,
    UserStatus,
    can_login,
    derive_is_active,
    login_refusal_message,
)
from app.models.admin_audit_log import AdminAuditLog, AuditAction
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.shop import Shop
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
from app.services.subscription_service import ensure_legacy_subscription_for_shop

PASSWORD_RESET_NEUTRAL_MESSAGE = (
    "If an account exists for this email, a password reset link has been sent."
)
PASSWORD_RESET_INVALID_MESSAGE = "This password reset link is invalid or has expired."


@dataclass
class PasswordResetEmailPayload:
    recipient_email: str
    recipient_name: str
    reset_link: str


def _split_name(full_name: str | None):
    safe_name = (full_name or "").strip()
    if not safe_name:
        return "", ""

    parts = safe_name.split()
    first_name = parts[0] if parts else ""
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first_name, last_name


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _build_password_reset_link(token: str) -> str:
    base_url = settings.frontend_base_url.rstrip("/")
    return f"{base_url}/reset-password?token={token}"


def _find_reset_record(token: str, db: Session) -> PasswordResetToken | None:
    token_hash = _hash_reset_token(token)
    return db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()


def _is_reset_record_valid(reset_record: PasswordResetToken) -> bool:
    if reset_record.used_at is not None:
        return False

    expires_at = _as_utc(reset_record.expires_at)
    if expires_at is None:
        return False

    return expires_at > _utcnow()


def register_shop_owner(
    shop_name: str,
    owner_name: str,
    email: str,
    category: str,
    phone: str,
    whatsapp_number: str | None,
    shop_address: str | None,
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

    try:
        organization = Organization(name=shop_name.strip(), status="active")
        db.add(organization)
        db.flush()

        shop = Shop(
            organization_id=organization.id,
            is_default_branch=True,
            name=shop_name.strip(),
            email=normalized_email,
            phone=phone.strip(),
            whatsapp_number=whatsapp_number.strip() if whatsapp_number else None,
            address=shop_address.strip() if shop_address else None,
            category=category.strip(),
            logo_url=logo_url,
        )
        db.add(shop)
        db.flush()

        first_name, last_name = _split_name(owner_name)

        # New registrations land in PENDING and are issued no access token. A
        # super admin has to approve the account before it can authenticate.
        user = User(
            shop_id=shop.id,
            full_name=owner_name.strip() if owner_name else "User",
            first_name=first_name or None,
            last_name=last_name or None,
            email=normalized_email,
            phone=phone.strip(),
            role=UserRole.OWNER,
            password_hash=hash_password(password),
            profile_image_url=None,
            status=UserStatus.PENDING,
            is_active=derive_is_active(UserStatus.PENDING),
            status_changed_at=_utcnow(),
        )
        db.add(user)
        db.flush()

        # Commercial ownership remains shop-scoped during the compatibility
        # period. Organization-level entitlement migration is intentionally
        # deferred.
        ensure_legacy_subscription_for_shop(db=db, shop_id=shop.id)

        db.add(
            AdminAuditLog(
                actor_user_id=user.id,
                actor_email=user.email,
                action=AuditAction.USER_REGISTERED,
                target_user_id=user.id,
                target_email=user.email,
                new_value=UserStatus.PENDING,
                reason="Self-registration awaiting approval",
            )
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(user)
    db.refresh(shop)
    db.refresh(organization)

    return RegisterResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name or "User",
        role=user.role,
        status=user.status,
        shop_id=user.shop_id,
        shop_name=shop.name,
        organization_id=organization.id,
        organization_name=organization.name,
        message=(
            "Registration received. Your account is awaiting administrator "
            "approval and you will be able to sign in once it has been reviewed."
        ),
    )


def login_user(payload: LoginRequest, db: Session):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found for this email address",
        )

    # The password is verified BEFORE the account status is disclosed, so this
    # endpoint cannot be used to enumerate which addresses are pending or
    # suspended without also knowing the password.
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
        )

    # First of the two backend gates: no token is minted for an account that is
    # not ACTIVE. `is_active` is consulted as well because it is the legacy
    # mirror and may have been set by hand.
    if not can_login(user.status) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=login_refusal_message(user.status),
        )

    # A super admin has no shop, so there is nothing to look up.
    shop = (
        db.query(Shop).filter(Shop.id == user.shop_id).first()
        if user.shop_id
        else None
    )

    access_token = create_access_token(subject=str(user.id))

    user.last_login_at = _utcnow()
    db.commit()

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name or "User",
        role=user.role,
        status=user.status,
        shop_id=user.shop_id,
        shop_name=shop.name if shop else None,
        shop_logo_url=shop.logo_url if shop else None,
        organization_id=shop.organization_id if shop else None,
        organization_name=shop.organization.name if shop else None,
    )


def get_me(current_user: User, db: Session):
    shop = (
        db.query(Shop).filter(Shop.id == current_user.shop_id).first()
        if current_user.shop_id
        else None
    )

    return MeResponse(
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name or "User",
        role=current_user.role,
        status=current_user.status,
        shop_id=current_user.shop_id,
        shop_name=shop.name if shop else None,
        shop_logo_url=shop.logo_url if shop else None,
        organization_id=shop.organization_id if shop else None,
        organization_name=shop.organization.name if shop else None,
    )


def request_password_reset(
    payload: ForgotPasswordRequest,
    db: Session,
    requested_from_ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[AuthMessageResponse, PasswordResetEmailPayload | None]:
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    neutral_response = AuthMessageResponse(message=PASSWORD_RESET_NEUTRAL_MESSAGE)

    # Only ACTIVE accounts get a reset link -- a pending, rejected, suspended
    # or disabled account has no route back in through password recovery. The
    # response is identical either way, so this discloses nothing.
    if not user or not can_login(user.status) or not user.is_active:
        return neutral_response, None

    now = _utcnow()
    latest_request = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )

    if latest_request and latest_request.created_at:
        latest_created_at = _as_utc(latest_request.created_at)
        if latest_created_at and (now - latest_created_at).total_seconds() < settings.password_reset_request_cooldown_seconds:
            return neutral_response, None

    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .update({PasswordResetToken.used_at: now}, synchronize_session=False)
    )

    raw_token = secrets.token_urlsafe(48)
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=now + timedelta(minutes=settings.password_reset_token_expire_minutes),
        requested_from_ip=requested_from_ip,
        user_agent=(user_agent or "")[:1000] or None,
    )
    db.add(reset_record)
    db.commit()

    return neutral_response, PasswordResetEmailPayload(
        recipient_email=user.email,
        recipient_name=user.full_name or user.email,
        reset_link=_build_password_reset_link(raw_token),
    )


def validate_password_reset_token(token: str, db: Session) -> ResetTokenValidationResponse:
    reset_record = _find_reset_record(token, db)
    if not reset_record or not _is_reset_record_valid(reset_record):
        return ResetTokenValidationResponse(
            valid=False,
            message=PASSWORD_RESET_INVALID_MESSAGE,
        )

    return ResetTokenValidationResponse(
        valid=True,
        message="This password reset link is valid.",
    )


def reset_password(payload: ResetPasswordRequest, db: Session) -> AuthMessageResponse:
    reset_record = _find_reset_record(payload.token, db)

    if not reset_record or not _is_reset_record_valid(reset_record):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=PASSWORD_RESET_INVALID_MESSAGE,
        )

    user = db.query(User).filter(User.id == reset_record.user_id).first()
    if not user or not can_login(user.status) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=PASSWORD_RESET_INVALID_MESSAGE,
        )

    now = _utcnow()
    user.password_hash = hash_password(payload.new_password)

    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .update({PasswordResetToken.used_at: now}, synchronize_session=False)
    )

    reset_record.used_at = now
    db.add(user)
    db.add(reset_record)
    db.commit()

    return AuthMessageResponse(message="Your password has been reset successfully. You can now sign in.")
