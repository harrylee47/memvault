from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    org_id: str
    name: str
    slug: str
    description: str | None = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True
