import re
from pydantic import BaseModel, field_validator
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 100):
            raise ValueError("项目名称长度需在 1-100 字符之间")
        return v

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not (2 <= len(v) <= 50):
            raise ValueError("Slug 长度需在 2-50 字符之间")
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", v):
            raise ValueError("Slug 只能包含小写字母、数字和连字符，且不能以连字符开头或结尾")
        return v


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not (1 <= len(v) <= 100):
                raise ValueError("项目名称长度需在 1-100 字符之间")
        return v


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
