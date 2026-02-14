import uuid
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.organization import Organization, OrgMember, OrgRole
from app.models.project import Project, ProjectConfig
from app.middleware.auth import hash_password, verify_password, create_access_token, create_refresh_token
from app.schemas.auth import UserRegister, UserLogin, TokenResponse
from fastapi import HTTPException, status


async def register_user(data: UserRegister, db: AsyncSession) -> tuple[User, TokenResponse]:
    """注册新用户，自动创建默认组织和项目"""
    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # 创建用户
    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        name=data.name,
        hashed_password=hash_password(data.password),
        provider="email",
    )
    db.add(user)

    # 创建默认组织
    slug = data.email.split("@")[0].lower().replace(".", "-")
    org = Organization(
        id=str(uuid.uuid4()),
        name=f"{data.name}'s Org",
        slug=f"{slug}-{secrets.token_hex(3)}",
    )
    db.add(org)

    # 添加为 owner
    member = OrgMember(
        id=str(uuid.uuid4()),
        org_id=org.id,
        user_id=user.id,
        role=OrgRole.OWNER,
    )
    db.add(member)

    # 创建默认项目
    project = Project(
        id=str(uuid.uuid4()),
        org_id=org.id,
        name="Default Project",
        slug="default",
        created_by=user.id,
    )
    db.add(project)

    # 创建默认项目配置
    project_config = ProjectConfig(
        id=str(uuid.uuid4()),
        project_id=project.id,
        mem0_config={},
    )
    db.add(project_config)

    await db.flush()

    tokens = _create_tokens(user)
    return user, tokens


async def login_user(data: UserLogin, db: AsyncSession) -> tuple[User, TokenResponse]:
    """邮箱密码登录"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    tokens = _create_tokens(user)
    return user, tokens


def _create_tokens(user: User) -> TokenResponse:
    token_data = {"sub": user.id, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
