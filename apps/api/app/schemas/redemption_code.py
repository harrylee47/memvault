from pydantic import BaseModel
from datetime import datetime


class RedemptionCodeCreate(BaseModel):
    plan_id: str
    duration_days: int
    count: int = 1
    prefix: str = "MV"
    max_uses: int = 1
    expires_at: datetime | None = None
    note: str | None = None


class RedemptionCodeUpdate(BaseModel):
    is_active: bool | None = None
    note: str | None = None
    max_uses: int | None = None
    expires_at: datetime | None = None


class RedemptionCodeResponse(BaseModel):
    id: str
    code: str
    plan_id: str
    plan_name: str | None = None
    plan_slug: str | None = None
    duration_days: int
    max_uses: int
    used_count: int
    is_active: bool
    expires_at: datetime | None = None
    note: str | None = None
    created_by: str | None = None
    created_at: datetime


class RedemptionLogResponse(BaseModel):
    id: str
    code_id: str
    org_id: str
    user_id: str | None = None
    plan_slug: str
    duration_days: int
    activated_at: datetime
    expires_at: datetime


class RedeemRequest(BaseModel):
    code: str
