from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32, max_length=512)
    new_password: str = Field(..., min_length=8, max_length=128)


class AuthMessageResponse(BaseModel):
    message: str


class ResetTokenValidationResponse(BaseModel):
    valid: bool
    message: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    status: str
    # None for a super admin, who operates the platform and owns no shop.
    shop_id: int | None = None
    shop_name: str | None = None
    shop_logo_url: str | None = None
    organization_id: int | None = None
    organization_name: str | None = None


class RegisterResponse(BaseModel):
    """Registration confirmation.

    Deliberately carries NO access token: a new account starts in `pending` and
    cannot authenticate until a super admin approves it, so handing back a
    credential here would be misleading at best.
    """

    user_id: int
    email: EmailStr
    full_name: str
    role: str
    status: str
    shop_id: int | None = None
    shop_name: str | None = None
    organization_id: int | None = None
    organization_name: str | None = None
    message: str


class MeResponse(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    status: str
    shop_id: int | None = None
    shop_name: str | None = None
    shop_logo_url: str | None = None
    organization_id: int | None = None
    organization_name: str | None = None
