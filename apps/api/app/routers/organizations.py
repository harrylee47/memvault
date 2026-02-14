import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.organization import Organization, OrgMember, OrgRole
from app.models.user import User
from app.schemas.organization import OrgCreate, OrgUpdate, OrgResponse, OrgMemberResponse, OrgMemberAdd

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
    # 检查 slug 唯一性
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

    # 验证成员身份
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

    # 验证 admin+ 权限
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
