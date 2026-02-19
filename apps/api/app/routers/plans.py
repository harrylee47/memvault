"""公开 Plan 路由"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.plan import Plan
from app.schemas.plan import PlanResponse

router = APIRouter(prefix="/plans", tags=["计划"])


@router.get("", response_model=list[PlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """获取所有启用的 plan（公开，无需认证）"""
    result = await db.execute(
        select(Plan).where(Plan.is_active == True).order_by(Plan.sort_order.asc())
    )
    return result.scalars().all()
