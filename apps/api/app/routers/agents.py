"""Agent 管理路由"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.agent import Agent
from app.models.memory import Memory, MemoryState
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.middleware.audit import log_audit

router = APIRouter(prefix="/agents", tags=["Agent"])


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目的所有 Agent"""
    result = await db.execute(
        select(Agent).where(Agent.project_id == project_id).order_by(Agent.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    data: AgentCreate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 Agent"""
    agent = Agent(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=data.name,
        description=data.description,
        agent_type=data.agent_type,
        agent_id=data.agent_id,
    )
    db.add(agent)
    await db.flush()
    await log_audit(db, project_id, auth.user_id, "create", "agent", agent.id)
    return agent


@router.get("/{agent_db_id}", response_model=AgentResponse)
async def get_agent(
    agent_db_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取 Agent 详情"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_db_id}", response_model=AgentResponse)
async def update_agent(
    agent_db_id: str,
    data: AgentUpdate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新 Agent"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if data.name is not None:
        agent.name = data.name
    if data.description is not None:
        agent.description = data.description
    await log_audit(db, project_id, auth.user_id, "update", "agent", agent_db_id)
    return agent


@router.delete("/{agent_db_id}", status_code=204)
async def delete_agent(
    agent_db_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 Agent"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await log_audit(db, project_id, auth.user_id, "delete", "agent", agent_db_id)


@router.get("/{agent_db_id}/memories")
async def get_agent_memories(
    agent_db_id: str,
    project_id: str = Query(..., description="项目 ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取 Agent 创建的记忆"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    count_query = select(func.count()).select_from(Memory).where(
        Memory.project_id == project_id,
        Memory.agent_id == agent.agent_id,
        Memory.state == MemoryState.ACTIVE,
    )
    total = (await db.execute(count_query)).scalar()

    query = (
        select(Memory)
        .where(
            Memory.project_id == project_id,
            Memory.agent_id == agent.agent_id,
            Memory.state == MemoryState.ACTIVE,
        )
        .order_by(Memory.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    memories = (await db.execute(query)).scalars().all()

    return {
        "memories": [
            {
                "id": m.id,
                "content": m.content,
                "memory_type": m.memory_type,
                "user_id": m.user_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in memories
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_db_id}/stats")
async def get_agent_stats(
    agent_db_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取 Agent 统计信息"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 记忆总数
    total_result = await db.execute(
        select(func.count()).select_from(Memory).where(
            Memory.project_id == project_id,
            Memory.agent_id == agent.agent_id,
            Memory.state == MemoryState.ACTIVE,
        )
    )
    total_memories = total_result.scalar()

    # 按类型统计
    type_result = await db.execute(
        select(Memory.memory_type, func.count()).where(
            Memory.project_id == project_id,
            Memory.agent_id == agent.agent_id,
            Memory.state == MemoryState.ACTIVE,
        ).group_by(Memory.memory_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # 唯一用户数
    user_result = await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(
            Memory.project_id == project_id,
            Memory.agent_id == agent.agent_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.user_id.isnot(None),
        )
    )
    unique_users = user_result.scalar()

    # 最近 7 天趋势
    from datetime import timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_result = await db.execute(
        select(func.date(Memory.created_at), func.count()).where(
            Memory.project_id == project_id,
            Memory.agent_id == agent.agent_id,
            Memory.created_at >= seven_days_ago,
        ).group_by(func.date(Memory.created_at)).order_by(func.date(Memory.created_at))
    )
    daily_trend = [{"date": str(row[0]), "count": row[1]} for row in daily_result.all()]

    return {
        "agent_id": agent.agent_id,
        "agent_name": agent.name,
        "total_memories": total_memories,
        "by_type": by_type,
        "unique_users": unique_users,
        "daily_trend": daily_trend,
        "last_active": agent.last_active.isoformat() if agent.last_active else None,
    }
