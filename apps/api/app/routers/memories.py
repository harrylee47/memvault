from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.schemas.memory import (
    MemoryAdd, MemoryUpdate, MemorySearch,
    MemoryResponse, MemoryListResponse, MemorySearchResponse,
    MemoryHistoryResponse, MemorySearchResult,
)
from app.services.memory_service import (
    add_memory, get_all_memories, get_memory, update_memory,
    delete_memory, search_memories, get_memory_history, reset_memories,
)

router = APIRouter(prefix="/memories", tags=["记忆"])


@router.post("")
async def create_memory(
    data: MemoryAdd,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加记忆 - mem0.add()"""
    result = await add_memory(
        project_id=project_id,
        messages=data.messages,
        user_id=data.user_id,
        agent_id=data.agent_id,
        run_id=data.run_id,
        metadata=data.metadata,
        db=db,
    )
    return {"results": result}


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    project_id: str = Query(..., description="项目 ID"),
    user_id: str | None = None,
    agent_id: str | None = None,
    run_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆列表 - mem0.get_all()"""
    memories, total = await get_all_memories(
        project_id=project_id,
        user_id=user_id,
        agent_id=agent_id,
        run_id=run_id,
        page=page,
        page_size=page_size,
        db=db,
    )
    return MemoryListResponse(
        memories=[MemoryResponse.model_validate(m) for m in memories],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_single_memory(
    memory_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取单条记忆 - mem0.get()"""
    memory = await get_memory(project_id, memory_id, db)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_single_memory(
    memory_id: str,
    data: MemoryUpdate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新记忆 - mem0.update()"""
    memory = await update_memory(project_id, memory_id, data.content, db)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.delete("/{memory_id}", status_code=204)
async def delete_single_memory(
    memory_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除记忆 - mem0.delete()"""
    success = await delete_memory(project_id, memory_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")


@router.post("/search", response_model=MemorySearchResponse)
async def search(
    data: MemorySearch,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """搜索记忆 - mem0.search()"""
    results = await search_memories(
        project_id=project_id,
        query=data.query,
        user_id=data.user_id,
        agent_id=data.agent_id,
        run_id=data.run_id,
        limit=data.limit,
        filters=data.filters,
        db=db,
    )
    return MemorySearchResponse(
        results=[MemorySearchResult(**r) for r in results],
        total=len(results),
    )


@router.get("/{memory_id}/history", response_model=MemoryHistoryResponse)
async def memory_history(
    memory_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记忆历史 - mem0.history()"""
    history = await get_memory_history(project_id, memory_id, db)
    return MemoryHistoryResponse(history=history)


@router.post("/actions/reset")
async def reset(
    project_id: str = Query(..., description="项目 ID"),
    user_id: str | None = None,
    agent_id: str | None = None,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重置记忆 - mem0.reset()"""
    count = await reset_memories(project_id, user_id, agent_id, db)
    return {"deleted_count": count}
