"""系统管理路由 - 仅限管理员"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.user import User
from app.models.organization import Organization, OrgMember
from app.models.project import Project
from app.models.memory import Memory, MemoryState
from app.models.agent import Agent
from app.models.request_log import RequestLog

router = APIRouter(prefix="/admin", tags=["系统管理"])


async def require_admin(auth: AuthContext = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """验证当前用户为系统管理员"""
    if not auth.user:
        raise HTTPException(status_code=401, detail="Authentication required")
    result = await db.execute(select(User).where(User.id == auth.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/stats")
async def admin_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """系统总览统计"""
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar()
    org_count = (await db.execute(select(func.count()).select_from(Organization))).scalar()
    project_count = (await db.execute(select(func.count()).select_from(Project))).scalar()
    memory_count = (await db.execute(
        select(func.count()).select_from(Memory).where(Memory.state == MemoryState.ACTIVE)
    )).scalar()
    agent_count = (await db.execute(select(func.count()).select_from(Agent))).scalar()
    request_count = (await db.execute(select(func.count()).select_from(RequestLog))).scalar()

    # 按计划统计组织
    plan_result = await db.execute(
        select(Organization.plan, func.count()).group_by(Organization.plan)
    )
    orgs_by_plan = {row[0]: row[1] for row in plan_result.all()}

    return {
        "users": user_count,
        "organizations": org_count,
        "projects": project_count,
        "memories": memory_count,
        "agents": agent_count,
        "requests": request_count,
        "orgs_by_plan": orgs_by_plan,
    }


@router.get("/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有用户列表"""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search}%"
        query = query.where((User.email.ilike(pattern)) | (User.name.ilike(pattern)))
        count_query = count_query.where((User.email.ilike(pattern)) | (User.name.ilike(pattern)))

    total = (await db.execute(count_query)).scalar()
    query = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "provider": u.provider,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    data: dict,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新用户（管理员权限）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "is_admin" in data:
        # 防止移除自己的管理员权限
        if user.id == admin_user.id and not data["is_admin"]:
            raise HTTPException(status_code=400, detail="Cannot remove your own admin privilege")
        user.is_admin = bool(data["is_admin"])
    if "name" in data:
        user.name = data["name"]

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
    }


@router.get("/organizations")
async def admin_list_organizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有组织列表"""
    total = (await db.execute(select(func.count()).select_from(Organization))).scalar()
    result = await db.execute(
        select(Organization)
        .order_by(Organization.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    orgs = result.scalars().all()

    org_data = []
    for org in orgs:
        member_count = (await db.execute(
            select(func.count()).select_from(OrgMember).where(OrgMember.org_id == org.id)
        )).scalar()
        project_count = (await db.execute(
            select(func.count()).select_from(Project).where(Project.org_id == org.id)
        )).scalar()
        org_data.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan": org.plan,
            "member_count": member_count,
            "project_count": project_count,
            "created_at": org.created_at.isoformat(),
        })

    return {
        "organizations": org_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
