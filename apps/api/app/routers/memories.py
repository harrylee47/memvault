import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.memory import Memory, MemoryState, MemoryType
from app.schemas.memory import (
    MemoryAdd, MemoryUpdate, MemorySearch,
    MemoryResponse, MemoryListResponse, MemorySearchResponse,
    MemoryHistoryResponse, MemorySearchResult, MemoryExport, MemoryImport,
)
from app.services.memory_service import (
    add_memory, get_all_memories, get_memory, update_memory,
    delete_memory, search_memories, get_memory_history, reset_memories,
)
from app.middleware.audit import log_audit
from app.services.webhook_service import dispatch_webhook_event
import io
import csv
from datetime import datetime

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
    await log_audit(db, project_id, auth.user_id, "create", "memory", details={"count": len(result)})
    # Webhook 通知
    for item in result:
        await dispatch_webhook_event(db, project_id, "memory.created", item)
    return {"results": result}


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    project_id: str = Query(..., description="项目 ID"),
    user_id: str | None = None,
    agent_id: str | None = None,
    run_id: str | None = None,
    memory_type: str | None = None,
    source_app: str | None = None,
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at", regex="^(created_at|updated_at|content)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆列表 - 支持高级过滤和排序"""
    query = select(Memory).where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
    count_query = select(func.count()).select_from(Memory).where(
        Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE
    )

    if user_id:
        query = query.where(Memory.user_id == user_id)
        count_query = count_query.where(Memory.user_id == user_id)
    if agent_id:
        query = query.where(Memory.agent_id == agent_id)
        count_query = count_query.where(Memory.agent_id == agent_id)
    if run_id:
        query = query.where(Memory.run_id == run_id)
        count_query = count_query.where(Memory.run_id == run_id)
    if memory_type:
        query = query.where(Memory.memory_type == memory_type)
        count_query = count_query.where(Memory.memory_type == memory_type)
    if source_app:
        query = query.where(Memory.source_app == source_app)
        count_query = count_query.where(Memory.source_app == source_app)
    if keyword:
        query = query.where(Memory.content.ilike(f"%{keyword}%"))
        count_query = count_query.where(Memory.content.ilike(f"%{keyword}%"))

    total = (await db.execute(count_query)).scalar()

    sort_col = getattr(Memory, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    memories = result.scalars().all()

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
    await log_audit(db, project_id, auth.user_id, "update", "memory", memory_id)
    await dispatch_webhook_event(db, project_id, "memory.updated", {
        "id": memory_id, "content": data.content,
    })
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
    await log_audit(db, project_id, auth.user_id, "delete", "memory", memory_id)
    await dispatch_webhook_event(db, project_id, "memory.deleted", {"id": memory_id})


@router.post("/search", response_model=MemorySearchResponse)
async def search(
    data: MemorySearch,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """搜索记忆 - mem0.search() 含高级过滤"""
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
    await log_audit(db, project_id, auth.user_id, "search", "memory", details={"query": data.query})
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
    await log_audit(db, project_id, auth.user_id, "reset", "memory", details={"count": count})
    return {"deleted_count": count}


@router.post("/export")
async def export_memories(
    data: MemoryExport,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出记忆"""
    query = select(Memory).where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
    if data.user_id:
        query = query.where(Memory.user_id == data.user_id)
    if data.agent_id:
        query = query.where(Memory.agent_id == data.agent_id)

    result = await db.execute(query.order_by(Memory.created_at.desc()))
    memories = result.scalars().all()

    await log_audit(db, project_id, auth.user_id, "export", "memory", details={"count": len(memories)})

    if data.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "content", "user_id", "agent_id", "memory_type", "created_at"])
        for m in memories:
            writer.writerow([m.id, m.content, m.user_id, m.agent_id, m.memory_type, m.created_at.isoformat()])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=memories.csv"},
        )
    else:
        export_data = [
            {
                "id": m.id,
                "content": m.content,
                "user_id": m.user_id,
                "agent_id": m.agent_id,
                "run_id": m.run_id,
                "memory_type": m.memory_type,
                "source_app": m.source_app,
                "created_at": m.created_at.isoformat(),
            }
            for m in memories
        ]
        return {"memories": export_data, "total": len(export_data)}


@router.post("/import")
async def import_memories(
    data: MemoryImport,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导入记忆"""
    imported = 0
    for item in data.memories:
        content = item.get("content", "")
        if not content:
            continue
        messages = [{"role": "user", "content": content}]
        user_id = item.get("user_id") or data.user_id
        agent_id = item.get("agent_id") or data.agent_id
        await add_memory(
            project_id=project_id,
            messages=messages,
            user_id=user_id,
            agent_id=agent_id,
            run_id=None,
            metadata=item.get("metadata"),
            db=db,
        )
        imported += 1

    await log_audit(db, project_id, auth.user_id, "import", "memory", details={"count": imported})
    return {"imported": imported}
