import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)  # ADD, SEARCH, GET_ALL, DELETE, etc.
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=200)
    has_results: Mapped[bool] = mapped_column(Boolean, default=True)
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    request_body: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    response_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
