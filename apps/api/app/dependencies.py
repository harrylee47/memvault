from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import decode_token, hash_api_key
from app.models.user import User
from app.models.api_key import ApiKey
from app.models.project import Project
from app.models.organization import OrgMember
from datetime import datetime

security = HTTPBearer()


class AuthContext:
    """认证上下文，支持 JWT 用户和 API Key"""

    def __init__(self, user: User | None = None, api_key: ApiKey | None = None, project_id: str | None = None):
        self.user = user
        self.api_key = api_key
        self._project_id = project_id

    @property
    def user_id(self) -> str | None:
        return self.user.id if self.user else None

    @property
    def project_id(self) -> str | None:
        if self._project_id:
            return self._project_id
        if self.api_key:
            return self.api_key.project_id
        return None

    @property
    def is_api_key(self) -> bool:
        return self.api_key is not None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """解析 JWT 或 API Key，返回认证上下文"""
    token = credentials.credentials

    # 尝试 API Key（mv_ 前缀）
    if token.startswith("mv_"):
        key_hash = hash_api_key(token)
        result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True))
        api_key = result.scalar_one_or_none()
        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key expired")
        # 更新最后使用时间
        api_key.last_used_at = datetime.utcnow()
        return AuthContext(api_key=api_key)

    # 尝试 JWT
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return AuthContext(user=user)


async def get_project_access(
    project_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[AuthContext, Project]:
    """验证用户对项目的访问权限"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # API Key 只能访问绑定的项目
    if auth.is_api_key:
        if auth.api_key.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key not authorized for this project")
        return auth, project

    # JWT 用户：检查组织成员身份
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == project.org_id, OrgMember.user_id == auth.user_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    return auth, project
