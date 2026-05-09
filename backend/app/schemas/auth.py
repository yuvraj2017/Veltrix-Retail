from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    shop_id: int
    shop_name: str | None = None
    shop_logo_url: str | None = None


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    shop_id: int
    shop_name: str | None = None
    shop_logo_url: str | None = None


class MeResponse(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    shop_id: int
    shop_name: str | None = None
    shop_logo_url: str | None = None