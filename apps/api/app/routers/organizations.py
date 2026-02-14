"""组织管理路由"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.organization import Organization, OrgMember, OrgRole
from app.models.user import User
from app.schemas.organization import (
    OrgCreate, OrgUpdate, OrgResponse, OrgMemberResponse, OrgMemberAdd,
)
from app.middleware.audit import log_audit

router = APIRouter(prefix="/organizations", tags=["组织"])


@router.get("", response_model=list[OrgResponse])
async def list_organizations(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户所属的所有组织"""
    result = await db.execute(
        select(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .where(OrgMember.user_id == auth.user_id)
    )
    return result.scalars().all()


@router.post("", response_model=OrgResponse, status_code=201)
async def create_organization(
    data: OrgCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建组织"""
    result = await db.execute(select(Organization).where(Organization.slug == data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already exists")

    org = Organization(id=str(uuid.uuid4()), name=data.name, slug=data.slug)
    db.add(org)

    member = OrgMember(id=str(uuid.uuid4()), org_id=org.id, user_id=auth.user_id, role=OrgRole.OWNER)
    db.add(member)
    await db.flush()
    return org


@router.get("/{org_id}", response_model=OrgResponse)
async def get_organization(
    org_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取组织详情"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id)
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    return org


@router.put("/{org_id}", response_model=OrgResponse)
async def update_organization(
    org_id: str,
    data: OrgUpdate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新组织"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if data.name is not None:
        org.name = data.name
    return org


@router.delete("/{org_id}", status_code=204)
async def delete_organization(
    org_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除组织（仅 Owner）"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role == OrgRole.OWNER,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only owner can delete organization")

    await db.delete(org)


# ---- 成员管理 ----

@router.get("/{org_id}/members", response_model=list[OrgMemberResponse])
async def list_members(
    org_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取组织成员列表"""
    result = await db.execute(
        select(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .where(OrgMember.org_id == org_id)
    )
    rows = result.all()
    return [
        OrgMemberResponse(
            id=member.id,
            user_id=member.user_id,
            role=member.role,
            user_name=user.name,
            user_email=user.email,
            created_at=member.created_at,
        )
        for member, user in rows
    ]


@router.post("/{org_id}/members", status_code=201)
async def add_member(
    org_id: str,
    data: OrgMemberAdd,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加组织成员（通过邮箱邀请）"""
    # 验证操作者权限（admin+）
    admin_check = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # 查找用户
    user_result = await db.execute(select(User).where(User.email == data.email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please ask them to register first.")

    # 检查是否已经是成员
    existing = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    member = OrgMember(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=user.id,
        role=data.role or OrgRole.MEMBER,
    )
    db.add(member)
    await db.flush()
    await log_audit(db, org_id, auth.user_id, "add_member", "organization", user.id,
                    details={"email": data.email, "role": member.role})
    return {
        "id": member.id,
        "user_id": user.id,
        "user_name": user.name,
        "user_email": user.email,
        "role": member.role,
    }


@router.put("/{org_id}/members/{member_id}")
async def update_member_role(
    org_id: str,
    member_id: str,
    role: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新成员角色"""
    # 验证操作者权限
    admin_check = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # 查找成员
    result = await db.execute(select(OrgMember).where(OrgMember.id == member_id, OrgMember.org_id == org_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 不能修改 Owner 角色（除非自己是 Owner）
    if member.role == OrgRole.OWNER:
        my_result = await db.execute(
            select(OrgMember).where(
                OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
                OrgMember.role == OrgRole.OWNER,
            )
        )
        if not my_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Cannot modify owner role")

    if role not in [r.value for r in OrgRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    member.role = role
    await log_audit(db, org_id, auth.user_id, "update_member_role", "organization", member_id,
                    details={"new_role": role})
    return {"id": member.id, "role": member.role}


@router.delete("/{org_id}/members/{member_id}", status_code=204)
async def remove_member(
    org_id: str,
    member_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除组织成员"""
    admin_check = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(OrgMember).where(OrgMember.id == member_id, OrgMember.org_id == org_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 不能移除 Owner
    if member.role == OrgRole.OWNER:
        raise HTTPException(status_code=403, detail="Cannot remove organization owner")

    # 不能移除自己
    if member.user_id == auth.user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Use leave instead.")

    await db.delete(member)
    await log_audit(db, org_id, auth.user_id, "remove_member", "organization", member_id)


# ---- 计费 / 计划 ----

PLAN_LIMITS = {
    "free": {"memories": 10000, "requests": 1000, "projects": 1},
    "starter": {"memories": 50000, "requests": 5000, "projects": 3},
    "pro": {"memories": -1, "requests": 50000, "projects": -1},
    "enterprise": {"memories": -1, "requests": -1, "projects": -1},
}


@router.get("/{org_id}/billing")
async def get_billing(
    org_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取计费和用量信息"""
    from app.models.project import Project
    from app.models.memory import Memory, MemoryState
    from app.models.request_log import RequestLog
    from datetime import datetime, timedelta

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # 获取所有项目 ID
    proj_result = await db.execute(select(Project.id).where(Project.org_id == org_id))
    project_ids = [row[0] for row in proj_result.all()]

    # 统计记忆总数
    memory_count = 0
    if project_ids:
        mem_result = await db.execute(
            select(func.count()).select_from(Memory).where(
                Memory.project_id.in_(project_ids),
                Memory.state == MemoryState.ACTIVE,
            )
        )
        memory_count = mem_result.scalar() or 0

    # 当月请求数
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

    plan = org.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    return {
        "plan": plan,
        "billing_period_start": month_start.isoformat(),
        "billing_period_end": (month_start + timedelta(days=32)).replace(day=1).isoformat(),
        "usage": {
            "memories": memory_count,
            "requests": request_count,
            "projects": len(project_ids),
        },
        "limits": limits,
    }


@router.put("/{org_id}/plan")
async def update_plan(
    org_id: str,
    data: dict,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新组织计划（仅 Owner/Admin）"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    new_plan = data.get("plan", "free")
    valid_plans = list(PLAN_LIMITS.keys())
    if new_plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {new_plan}")

    org.plan = new_plan
    return {"plan": org.plan}
