"""系统管理路由 - 仅限管理员"""
import uuid
import secrets
import string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.user import User
from app.models.organization import Organization, OrgMember
from app.models.project import Project
from app.models.memory import Memory, MemoryState
from app.models.agent import Agent
from app.models.request_log import RequestLog
from app.models.plan import Plan
from app.models.redemption_code import RedemptionCode, RedemptionLog
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse
from app.schemas.redemption_code import (
    RedemptionCodeCreate, RedemptionCodeUpdate, RedemptionCodeResponse, RedemptionLogResponse,
)

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


@router.post("/users", status_code=201)
async def admin_create_user(
    data: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员创建用户"""
    from app.middleware.auth import hash_password
    from app.models.organization import Organization, OrgMember, OrgRole
    from app.models.project import Project, ProjectConfig

    email = data.get("email", "").strip()
    name = data.get("name", "").strip()
    password = data.get("password", "")

    if not email or not name:
        raise HTTPException(status_code=400, detail="Email and name are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # 检查邮箱是否已存在
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # 创建用户
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        name=name,
        hashed_password=hash_password(password),
        provider="email",
    )
    db.add(user)

    # 创建默认组织
    slug = email.split("@")[0].lower().replace(".", "-")
    org = Organization(
        id=str(uuid.uuid4()),
        name=f"{name}'s Org",
        slug=f"{slug}-{secrets.token_hex(3)}",
    )
    db.add(org)

    member = OrgMember(
        id=str(uuid.uuid4()),
        org_id=org.id,
        user_id=user.id,
        role=OrgRole.OWNER,
    )
    db.add(member)

    project = Project(
        id=str(uuid.uuid4()),
        org_id=org.id,
        name="Default Project",
        slug="default",
        created_by=user.id,
    )
    db.add(project)

    project_config = ProjectConfig(
        id=str(uuid.uuid4()),
        project_id=project.id,
        mem0_config={},
    )
    db.add(project_config)

    await db.flush()
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
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


@router.delete("/users/{user_id}", status_code=204)
async def admin_delete_user(
    user_id: str,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除用户（管理员不可删除自己）"""
    from app.models.api_key import ApiKey

    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 清除 FK 引用：将该用户创建的项目和 API Key 的 created_by 置空
    await db.execute(
        sa.update(Project).where(Project.created_by == user_id).values(created_by=None)
    )
    await db.execute(
        sa.update(ApiKey).where(ApiKey.created_by == user_id).values(created_by=None)
    )

    await db.delete(user)


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    data: dict,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """重置用户密码"""
    from app.middleware.auth import hash_password

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.provider != "email":
        raise HTTPException(status_code=400, detail="Cannot reset password for OAuth users")

    new_password = data.get("password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = hash_password(new_password)
    return {"message": "Password reset successfully"}


@router.put("/organizations/{org_id}")
async def admin_update_organization(
    org_id: str,
    data: dict,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员更新组织（plan、到期时间等）"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if "plan" in data:
        # 验证 plan slug 存在
        plan_result = await db.execute(select(Plan).where(Plan.slug == data["plan"]))
        if not plan_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Invalid plan: {data['plan']}")
        org.plan = data["plan"]

    if "plan_expires_at" in data:
        if data["plan_expires_at"]:
            org.plan_expires_at = datetime.fromisoformat(data["plan_expires_at"].replace("Z", "+00:00"))
        else:
            org.plan_expires_at = None

    if "plan_activated_at" in data:
        if data["plan_activated_at"]:
            org.plan_activated_at = datetime.fromisoformat(data["plan_activated_at"].replace("Z", "+00:00"))
        else:
            org.plan_activated_at = None

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "plan_expires_at": org.plan_expires_at.isoformat() if org.plan_expires_at else None,
        "plan_activated_at": org.plan_activated_at.isoformat() if org.plan_activated_at else None,
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
            "plan_expires_at": org.plan_expires_at.isoformat() if org.plan_expires_at else None,
            "plan_activated_at": org.plan_activated_at.isoformat() if org.plan_activated_at else None,
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


# ---- Plan 管理 ----

@router.get("/plans", response_model=list[PlanResponse])
async def admin_list_plans(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有 plan（含停用的）"""
    result = await db.execute(select(Plan).order_by(Plan.sort_order.asc()))
    return result.scalars().all()


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def admin_create_plan(
    data: PlanCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """创建 plan"""
    # 检查 slug 唯一性
    existing = await db.execute(select(Plan).where(Plan.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Plan slug already exists")

    plan = Plan(
        id=str(uuid.uuid4()),
        name=data.name,
        slug=data.slug,
        description=data.description,
        price_label=data.price_label,
        limits=data.limits,
        features=data.features,
        sort_order=data.sort_order,
        is_default=data.is_default,
        is_active=data.is_active,
    )
    db.add(plan)
    await db.flush()
    return plan


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def admin_update_plan(
    plan_id: str,
    data: PlanUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新 plan"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if data.name is not None:
        plan.name = data.name
    if data.slug is not None:
        # 检查 slug 唯一性
        existing = await db.execute(select(Plan).where(Plan.slug == data.slug, Plan.id != plan_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Plan slug already exists")
        plan.slug = data.slug
    if data.description is not None:
        plan.description = data.description
    if data.price_label is not None:
        plan.price_label = data.price_label
    if data.limits is not None:
        plan.limits = data.limits
    if data.features is not None:
        plan.features = data.features
    if data.sort_order is not None:
        plan.sort_order = data.sort_order
    if data.is_active is not None:
        plan.is_active = data.is_active

    return plan


@router.delete("/plans/{plan_id}", status_code=204)
async def admin_delete_plan(
    plan_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除 plan（默认 plan 不可删，至少保留一个）"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default plan")

    # 检查是否只剩一个 plan
    plan_count = (await db.execute(select(func.count()).select_from(Plan))).scalar() or 0
    if plan_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete last plan. At least one plan is required.")

    await db.delete(plan)


# ---- 兑换码管理 ----

def _generate_code(prefix: str = "MV") -> str:
    """生成格式如 MV-A3F2-K9X1-P7M4 的兑换码"""
    chars = string.ascii_uppercase + string.digits
    segments = [
        ''.join(secrets.choice(chars) for _ in range(4))
        for _ in range(3)
    ]
    return f"{prefix}-{'-'.join(segments)}"


@router.get("/redemption-codes")
async def admin_list_redemption_codes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    plan_id: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取兑换码列表（分页）"""
    query = select(RedemptionCode)
    count_query = select(func.count()).select_from(RedemptionCode)

    if plan_id:
        query = query.where(RedemptionCode.plan_id == plan_id)
        count_query = count_query.where(RedemptionCode.plan_id == plan_id)

    total = (await db.execute(count_query)).scalar()
    query = query.order_by(RedemptionCode.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    codes = result.scalars().all()

    # 获取关联 plan 信息
    plan_ids = list(set(c.plan_id for c in codes))
    plans_map = {}
    if plan_ids:
        plans_result = await db.execute(select(Plan).where(Plan.id.in_(plan_ids)))
        for p in plans_result.scalars().all():
            plans_map[p.id] = p

    items = []
    for c in codes:
        p = plans_map.get(c.plan_id)
        items.append(RedemptionCodeResponse(
            id=c.id,
            code=c.code,
            plan_id=c.plan_id,
            plan_name=p.name if p else None,
            plan_slug=p.slug if p else None,
            duration_days=c.duration_days,
            max_uses=c.max_uses,
            used_count=c.used_count,
            is_active=c.is_active,
            expires_at=c.expires_at,
            note=c.note,
            created_by=c.created_by,
            created_at=c.created_at,
        ))

    return {
        "codes": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/redemption-codes", status_code=201)
async def admin_create_redemption_codes(
    data: RedemptionCodeCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """批量生成兑换码"""
    # 验证 plan 存在
    plan_result = await db.execute(select(Plan).where(Plan.id == data.plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    created_codes = []
    for _ in range(data.count):
        # 确保 code 唯一
        for attempt in range(10):
            code = _generate_code(data.prefix)
            existing = await db.execute(select(RedemptionCode).where(RedemptionCode.code == code))
            if not existing.scalar_one_or_none():
                break
        else:
            raise HTTPException(status_code=500, detail="Failed to generate unique code")

        redemption_code = RedemptionCode(
            id=str(uuid.uuid4()),
            code=code,
            plan_id=data.plan_id,
            duration_days=data.duration_days,
            max_uses=data.max_uses,
            expires_at=data.expires_at,
            note=data.note,
            created_by=admin.id,
        )
        db.add(redemption_code)
        created_codes.append({
            "id": redemption_code.id,
            "code": redemption_code.code,
            "plan_id": data.plan_id,
            "plan_name": plan.name,
            "plan_slug": plan.slug,
            "duration_days": data.duration_days,
            "max_uses": data.max_uses,
        })

    await db.flush()
    return {"codes": created_codes, "count": len(created_codes)}


@router.put("/redemption-codes/{code_id}")
async def admin_update_redemption_code(
    code_id: str,
    data: RedemptionCodeUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新兑换码（启用/停用等）"""
    result = await db.execute(select(RedemptionCode).where(RedemptionCode.id == code_id))
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Redemption code not found")

    if data.is_active is not None:
        code.is_active = data.is_active
    if data.note is not None:
        code.note = data.note
    if data.max_uses is not None:
        code.max_uses = data.max_uses
    if data.expires_at is not None:
        code.expires_at = data.expires_at

    return {
        "id": code.id,
        "code": code.code,
        "is_active": code.is_active,
        "max_uses": code.max_uses,
        "note": code.note,
        "expires_at": code.expires_at.isoformat() if code.expires_at else None,
    }


@router.delete("/redemption-codes/{code_id}", status_code=204)
async def admin_delete_redemption_code(
    code_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除兑换码"""
    result = await db.execute(select(RedemptionCode).where(RedemptionCode.id == code_id))
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Redemption code not found")

    await db.delete(code)


@router.get("/redemption-codes/{code_id}/logs")
async def admin_get_redemption_code_logs(
    code_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """查看兑换码使用记录"""
    result = await db.execute(
        select(RedemptionLog)
        .where(RedemptionLog.code_id == code_id)
        .order_by(RedemptionLog.activated_at.desc())
    )
    logs = result.scalars().all()

    return {
        "logs": [
            RedemptionLogResponse(
                id=log.id,
                code_id=log.code_id,
                org_id=log.org_id,
                user_id=log.user_id,
                plan_slug=log.plan_slug,
                duration_days=log.duration_days,
                activated_at=log.activated_at,
                expires_at=log.expires_at,
            ).model_dump()
            for log in logs
        ],
    }
