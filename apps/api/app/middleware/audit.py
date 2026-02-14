"""审计日志中间件"""
import uuid
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def log_audit(
    db: AsyncSession,
    project_id: str,
    user_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
):
    """记录审计日志"""
    try:
        audit = AuditLog(
            id=str(uuid.uuid4()),
            project_id=project_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            created_at=datetime.utcnow(),
        )
        db.add(audit)
    except Exception as e:
        logger.warning(f"Failed to log audit: {e}")
