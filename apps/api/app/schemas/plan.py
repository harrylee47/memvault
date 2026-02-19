from pydantic import BaseModel
from datetime import datetime


class PlanCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    price_label: str | None = None
    limits: dict = {"memories": 10000, "requests": 1000, "projects": 1}
    features: list[str] = []
    sort_order: int = 0
    is_default: bool = False
    is_active: bool = True


class PlanUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price_label: str | None = None
    limits: dict | None = None
    features: list[str] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class PlanResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    price_label: str | None = None
    limits: dict
    features: list
    sort_order: int
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
