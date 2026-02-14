"""图谱可视化路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.services.graph_service import get_graph_entities, get_graph_stats

router = APIRouter(prefix="/graph", tags=["图谱"])


@router.get("")
async def get_graph(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取图谱数据（节点和边）"""
    return await get_graph_entities(project_id, db)


@router.get("/stats")
async def graph_stats(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取图谱统计信息"""
    return await get_graph_stats(project_id, db)
