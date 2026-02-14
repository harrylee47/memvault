import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse

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
    return agent


@router.delete("/{agent_db_id}", status_code=204)
async def delete_agent(
    agent_db_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 Agent"""
    result = await db.execute(select(Agent).where(Agent.id == agent_db_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
