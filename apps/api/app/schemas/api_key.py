from pydantic import BaseModel
from datetime import datetime


class ApiKeyCreate(BaseModel):
    name: str
    scopes: list[str] = ["memories:read", "memories:write"]
    expires_in_days: int | None = None


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: list[str] | dict
    is_active: bool
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    """只在创建时返回完整 key"""
    full_key: str


class ApiKeyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
