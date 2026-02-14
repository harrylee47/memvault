import re
from typing import Literal
from pydantic import BaseModel, field_validator
from datetime import datetime


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    agent_type: Literal["api", "mcp", "webhook", "openclaw"] = "api"
    agent_id: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 100):
            raise ValueError("Agent 名称长度需在 1-100 字符之间")
        return v

    @field_validator("agent_id")
    @classmethod
    def validate_agent_id(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 64):
            raise ValueError("Agent ID 长度需在 1-64 字符之间")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Agent ID 只能包含字母、数字、下划线和连字符")
        return v


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not (1 <= len(v) <= 100):
                raise ValueError("Agent 名称长度需在 1-100 字符之间")
        return v


class AgentResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    agent_type: str
    agent_id: str
    last_active: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True
