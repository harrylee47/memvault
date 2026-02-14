import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.project import Project, ProjectConfig
from app.models.organization import OrgMember
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["项目"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    org_id: str | None = None,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户可见的所有项目"""
    query = (
        select(Project)
        .join(OrgMember, OrgMember.org_id == Project.org_id)
        .where(OrgMember.user_id == auth.user_id)
    )
    if org_id:
        query = query.where(Project.org_id == org_id)
    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    org_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在组织下创建项目"""
    # 验证组织成员
    member_result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == auth.user_id)
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    project = Project(
        id=str(uuid.uuid4()),
        org_id=org_id,
        name=data.name,
        slug=data.slug,
        description=data.description,
        created_by=auth.user_id,
    )
    db.add(project)

    # 创建默认配置
    config = ProjectConfig(
        id=str(uuid.uuid4()),
        project_id=project.id,
        mem0_config={},
    )
    db.add(config)
    await db.flush()
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目详情"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 验证访问权限
    member_result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == project.org_id, OrgMember.user_id == auth.user_id)
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
