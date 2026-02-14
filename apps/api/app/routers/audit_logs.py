"""审计日志路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.audit_log import AuditLog
from datetime import datetime, timedelta

router = APIRouter(prefix="/audit-logs", tags=["审计日志"])


@router.get("")
async def list_audit_logs(
    project_id: str = Query(...),
    action: str | None = None,
    resource_type: str | None = None,
    user_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    days: int = Query(30, ge=1, le=365),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取审计日志列表"""
    since = datetime.utcnow() - timedelta(days=days)
    query = select(AuditLog).where(
        AuditLog.project_id == project_id,
        AuditLog.created_at >= since,
    )
    count_query = select(func.count()).select_from(AuditLog).where(
        AuditLog.project_id == project_id,
        AuditLog.created_at >= since,
    )

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    total = (await db.execute(count_query)).scalar()
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "user_id": log.user_id,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
