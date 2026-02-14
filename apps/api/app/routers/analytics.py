from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.memory import Memory, MemoryState
from app.models.agent import Agent
from app.models.api_key import ApiKey
from app.services.memory_service import get_memory_stats

router = APIRouter(prefix="/analytics", tags=["统计"])


@router.get("/overview")
async def overview(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """概览统计"""
    stats = await get_memory_stats(project_id, db)

    # Agent 数量
    agent_result = await db.execute(
        select(func.count()).select_from(Agent).where(Agent.project_id == project_id)
    )
    agent_count = agent_result.scalar()

    # API Key 数量
    key_result = await db.execute(
        select(func.count()).select_from(ApiKey).where(ApiKey.project_id == project_id, ApiKey.is_active == True)
    )
    key_count = key_result.scalar()

    # 唯一用户数
    user_result = await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.user_id.isnot(None),
        )
    )
    unique_users = user_result.scalar()

    return {
        "total_memories": stats["total"],
        "memories_by_type": stats["by_type"],
        "daily_trend": stats["daily_trend"],
        "agent_count": agent_count,
        "api_key_count": key_count,
        "unique_users": unique_users,
    }
