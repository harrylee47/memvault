from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    provider: str
    avatar_url: str | None = None
    is_active: bool
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str
