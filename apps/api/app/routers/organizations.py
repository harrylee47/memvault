"""组织管理路由"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.organization import Organization, OrgMember, OrgRole
from app.models.user import User
from app.models.plan import Plan
from app.models.redemption_code import RedemptionCode, RedemptionLog
from app.schemas.organization import (
    OrgCreate, OrgUpdate, OrgResponse, OrgMemberResponse, OrgMemberAdd,
)
from app.schemas.redemption_code import RedeemRequest

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

    # 检查用户是否只剩一个组织
    user_org_count = (await db.execute(
        select(func.count()).select_from(OrgMember).where(OrgMember.user_id == auth.user_id)
    )).scalar() or 0
    if user_org_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete last organization. At least one organization is required.")

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
            role=member.role.value if isinstance(member.role, OrgRole) else str(member.role).lower(),
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

    try:
        member_role = OrgRole(data.role) if data.role else OrgRole.MEMBER
    except ValueError:
        member_role = OrgRole.MEMBER
    member = OrgMember(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=user.id,
        role=member_role,
    )
    db.add(member)
    await db.flush()
    return {
        "id": member.id,
        "user_id": user.id,
        "user_name": user.name,
        "user_email": user.email,
        "role": member_role.value,
    }


@router.put("/{org_id}/members/{member_id}")
async def update_member_role(
    org_id: str,
    member_id: str,
    data: dict,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新成员角色"""
    role = data.get("role", "")

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

    # 验证并转换角色枚举
    try:
        new_role = OrgRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    member.role = new_role
    return {"id": member.id, "role": new_role.value}


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


# ---- 计费 / 计划 ----

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
    from app.services.plan_service import get_org_plan_limits

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

    # 从 plans 表读取 limits
    limits = await get_org_plan_limits(org_id, db)

    return {
        "plan": org.plan or "free",
        "plan_expires_at": org.plan_expires_at.isoformat() if org.plan_expires_at else None,
        "plan_activated_at": org.plan_activated_at.isoformat() if org.plan_activated_at else None,
        "billing_period_start": month_start.isoformat(),
        "billing_period_end": (month_start + timedelta(days=32)).replace(day=1).isoformat(),
        "usage": {
            "memories": memory_count,
            "requests": request_count,
            "projects": len(project_ids),
        },
        "limits": limits,
    }


@router.post("/{org_id}/redeem")
async def redeem_code(
    org_id: str,
    data: RedeemRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """兑换码兑换 plan"""
    # 验证组织成员权限
    member_result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id,
            OrgMember.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # 查找兑换码
    code_result = await db.execute(
        select(RedemptionCode).where(RedemptionCode.code == data.code.strip().upper())
    )
    redemption_code = code_result.scalar_one_or_none()
    if not redemption_code:
        raise HTTPException(status_code=404, detail="Invalid redemption code")

    # 检查兑换码是否有效
    if not redemption_code.is_active:
        raise HTTPException(status_code=400, detail="Redemption code is inactive")

    if redemption_code.expires_at and redemption_code.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Redemption code has expired")

    if redemption_code.used_count >= redemption_code.max_uses:
        raise HTTPException(status_code=400, detail="Redemption code has been fully used")

    # 获取关联的 plan
    plan_result = await db.execute(select(Plan).where(Plan.id == redemption_code.plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan or not plan.is_active:
        raise HTTPException(status_code=400, detail="Associated plan is not available")

    # 获取组织
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # 计算到期时间
    now = datetime.utcnow()
    if org.plan == plan.slug and org.plan_expires_at and org.plan_expires_at > now:
        # 同 plan 叠加天数
        new_expires_at = org.plan_expires_at + timedelta(days=redemption_code.duration_days)
    else:
        new_expires_at = now + timedelta(days=redemption_code.duration_days)

    # 更新组织 plan
    org.plan = plan.slug
    org.plan_activated_at = now
    org.plan_expires_at = new_expires_at

    # 原子自增 used_count
    redemption_code.used_count = redemption_code.used_count + 1

    # 记录兑换日志
    log = RedemptionLog(
        id=str(uuid.uuid4()),
        code_id=redemption_code.id,
        org_id=org_id,
        user_id=auth.user_id,
        plan_slug=plan.slug,
        duration_days=redemption_code.duration_days,
        activated_at=now,
        expires_at=new_expires_at,
    )
    db.add(log)
    await db.flush()

    return {
        "plan": plan.slug,
        "plan_name": plan.name,
        "duration_days": redemption_code.duration_days,
        "activated_at": now.isoformat(),
        "expires_at": new_expires_at.isoformat(),
    }
