from pydantic import BaseModel
from datetime import datetime


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    agent_type: str = "api"
    agent_id: str


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


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
