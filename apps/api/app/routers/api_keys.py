import uuid
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.api_key import ApiKey
from app.middleware.auth import hash_api_key
from app.schemas.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyCreatedResponse, ApiKeyUpdate

router = APIRouter(prefix="/api-keys", tags=["API Key"])


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目的所有 API Key"""
    result = await db.execute(
        select(ApiKey).where(ApiKey.project_id == project_id).order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_api_key(
    data: ApiKeyCreate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 API Key"""
    # 生成 key: mv_ + 40位随机字符
    raw_key = f"mv_{secrets.token_hex(20)}"
    key_prefix = raw_key[:10]

    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)

    api_key = ApiKey(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=data.name,
        key_hash=hash_api_key(raw_key),
        key_prefix=key_prefix,
        scopes=data.scopes,
        expires_at=expires_at,
        created_by=auth.user_id,
    )
    db.add(api_key)
    await db.flush()

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        full_key=raw_key,
    )


@router.put("/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: str,
    data: ApiKeyUpdate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新 API Key"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    if data.name is not None:
        api_key.name = data.name
    if data.is_active is not None:
        api_key.is_active = data.is_active
    return api_key


@router.delete("/{key_id}", status_code=204)
async def delete_api_key(
    key_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 API Key"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")
    await db.delete(api_key)
