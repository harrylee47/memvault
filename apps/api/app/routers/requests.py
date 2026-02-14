"""请求日志路由 - 查看 API 请求记录"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.request_log import RequestLog
from datetime import datetime, timedelta

router = APIRouter(prefix="/requests", tags=["请求日志"])


@router.get("")
async def list_requests(
    project_id: str = Query(..., description="项目 ID"),
    method: str | None = Query(None, description="请求类型: ADD, SEARCH, GET_ALL"),
    has_results: bool | None = Query(None, description="是否有结果"),
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取请求日志列表"""
    since = datetime.utcnow() - timedelta(days=days)
    query = select(RequestLog).where(
        RequestLog.project_id == project_id,
        RequestLog.created_at >= since,
    )
    count_query = select(func.count()).select_from(RequestLog).where(
        RequestLog.project_id == project_id,
        RequestLog.created_at >= since,
    )

    if method:
        query = query.where(RequestLog.method == method)
        count_query = count_query.where(RequestLog.method == method)
    if has_results is not None:
        query = query.where(RequestLog.has_results == has_results)
        count_query = count_query.where(RequestLog.has_results == has_results)

    total = (await db.execute(count_query)).scalar()
    query = query.order_by(RequestLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "requests": [
            {
                "id": log.id,
                "method": log.method,
                "endpoint": log.endpoint,
                "status_code": log.status_code,
                "has_results": log.has_results,
                "agent_id": log.agent_id,
                "user_id": log.user_id,
                "duration_ms": log.duration_ms,
                "request_body": log.request_body,
                "response_summary": log.response_summary,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
async def request_stats(
    project_id: str = Query(..., description="项目 ID"),
    days: int = Query(30, ge=1, le=365),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取请求统计"""
    since = datetime.utcnow() - timedelta(days=days)

    # 总请求数
    total_result = await db.execute(
        select(func.count()).select_from(RequestLog).where(
            RequestLog.project_id == project_id,
            RequestLog.created_at >= since,
        )
    )
    total = total_result.scalar()

    # 按方法分组统计
    method_result = await db.execute(
        select(RequestLog.method, func.count()).where(
            RequestLog.project_id == project_id,
            RequestLog.created_at >= since,
        ).group_by(RequestLog.method)
    )
    by_method = {row[0]: row[1] for row in method_result.all()}

    # 有结果的请求
    with_results = await db.execute(
        select(func.count()).select_from(RequestLog).where(
            RequestLog.project_id == project_id,
            RequestLog.created_at >= since,
            RequestLog.has_results == True,
        )
    )

    return {
        "total": total,
        "by_method": by_method,
        "with_results": with_results.scalar(),
    }
