"""系统设置路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.system_setting import SystemSetting
from app.routers.admin import require_admin
from app.models.user import User

router = APIRouter(prefix="/system", tags=["系统设置"])


@router.get("/settings")
async def get_system_settings(db: AsyncSession = Depends(get_db)):
    """获取公开系统设置（无需认证）"""
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


@router.put("/settings")
async def update_system_settings(
    data: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新系统设置（仅管理员）"""
    for key, value in data.items():
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            setting = SystemSetting(key=key, value=str(value))
            db.add(setting)
    return {"message": "Settings updated"}
