"""Plan 限制检查服务"""
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.project import Project
from app.models.memory import Memory, MemoryState
from app.models.request_log import RequestLog

# 默认 free plan 限制（当 plans 表查不到时的兜底）
DEFAULT_FREE_LIMITS = {"memories": 10000, "requests": 1000, "projects": 1}


async def get_org_plan_limits(org_id: str, db: AsyncSession) -> dict:
    """获取组织的 plan limits，过期则回退 free"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan_slug = org.plan or "free"

    # 检查 plan 是否过期
    if plan_slug != "free" and org.plan_expires_at:
        if org.plan_expires_at < datetime.utcnow():
            # 过期回退到 free
            org.plan = "free"
            org.plan_expires_at = None
            org.plan_activated_at = None
            plan_slug = "free"

    # 从 plans 表读取 limits
    plan_result = await db.execute(select(Plan).where(Plan.slug == plan_slug))
    plan = plan_result.scalar_one_or_none()
    if plan:
        return plan.limits
    return DEFAULT_FREE_LIMITS


async def check_memory_limit(org_id: str, project_ids: list[str], db: AsyncSession):
    """检查记忆数量是否超限"""
    limits = await get_org_plan_limits(org_id, db)
    max_memories = limits.get("memories", 10000)

    if max_memories == -1:
        return  # 无限

    memory_count = 0
    if project_ids:
        mem_result = await db.execute(
            select(func.count()).select_from(Memory).where(
                Memory.project_id.in_(project_ids),
                Memory.state == MemoryState.ACTIVE,
            )
        )
        memory_count = mem_result.scalar() or 0

    if memory_count >= max_memories:
        raise HTTPException(
            status_code=403,
            detail=f"Memory limit reached ({memory_count}/{max_memories}). Please upgrade your plan.",
        )


async def check_project_limit(org_id: str, db: AsyncSession):
    """检查项目数量是否超限"""
    limits = await get_org_plan_limits(org_id, db)
    max_projects = limits.get("projects", 1)

    if max_projects == -1:
        return  # 无限

    proj_result = await db.execute(
        select(func.count()).select_from(Project).where(Project.org_id == org_id)
    )
    project_count = proj_result.scalar() or 0

    if project_count >= max_projects:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached ({project_count}/{max_projects}). Please upgrade your plan.",
        )


async def check_request_limit(org_id: str, project_ids: list[str], db: AsyncSession):
    """检查当月请求数是否超限"""
    limits = await get_org_plan_limits(org_id, db)
    max_requests = limits.get("requests", 1000)

    if max_requests == -1:
        return  # 无限

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    request_count = 0
    if project_ids:
        req_result = await db.execute(
            select(func.count()).select_from(RequestLog).where(
                RequestLog.project_id.in_(project_ids),
                RequestLog.created_at >= month_start,
            )
        )
        request_count = req_result.scalar() or 0

    if request_count >= max_requests:
        raise HTTPException(
            status_code=403,
            detail=f"Monthly request limit reached ({request_count}/{max_requests}). Please upgrade your plan.",
        )
