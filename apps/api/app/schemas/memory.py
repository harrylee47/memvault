from pydantic import BaseModel
from datetime import datetime


class MemoryAdd(BaseModel):
    messages: list[dict]  # [{"role": "user", "content": "..."}]
    user_id: str | None = None
    agent_id: str | None = None
    run_id: str | None = None
    metadata: dict | None = None


class MemoryUpdate(BaseModel):
    content: str


class MemorySearch(BaseModel):
    query: str
    user_id: str | None = None
    agent_id: str | None = None
    run_id: str | None = None
    limit: int = 10
    threshold: float | None = None
    rerank: bool = False
    filters: dict | None = None


class MemoryResponse(BaseModel):
    id: str
    mem0_memory_id: str | None = None
    content: str
    user_id: str | None = None
    agent_id: str | None = None
    run_id: str | None = None
    memory_type: str
    state: str
    source_app: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemorySearchResult(BaseModel):
    id: str
    memory: str
    score: float | None = None
    user_id: str | None = None
    agent_id: str | None = None


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int
    page: int
    page_size: int


class MemorySearchResponse(BaseModel):
    results: list[MemorySearchResult]
    total: int


class MemoryHistoryResponse(BaseModel):
    history: list[dict]


class MemoryExport(BaseModel):
    user_id: str | None = None
    agent_id: str | None = None
    format: str = "json"


class MemoryImport(BaseModel):
    memories: list[dict]
    user_id: str | None = None
    agent_id: str | None = None
