from pydantic import BaseModel
from datetime import datetime


class OrgCreate(BaseModel):
    name: str
    slug: str


class OrgUpdate(BaseModel):
    name: str | None = None


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrgMemberResponse(BaseModel):
    id: str
    user_id: str
    role: str
    user_name: str | None = None
    user_email: str | None = None
    created_at: datetime


class OrgMemberAdd(BaseModel):
    email: str
    role: str = "member"
