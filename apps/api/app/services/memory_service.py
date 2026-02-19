"""记忆服务层 - 封装 mem0 SDK 调用"""
import uuid
import json
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.models.memory import Memory, MemoryState, MemoryType
from app.models.project import ProjectConfig
from app.utils.memory_client import get_project_memory_client

logger = logging.getLogger(__name__)


async def _get_mem0_client(project_id: str, db: AsyncSession):
    """获取项目的 mem0 客户端"""
    result = await db.execute(select(ProjectConfig).where(ProjectConfig.project_id == project_id))
    config = result.scalar_one_or_none()
    project_config = config.mem0_config if config else None
    return get_project_memory_client(project_id, project_config)


async def add_memory(
    project_id: str,
    messages: list[dict] | str,
    user_id: str | None,
    agent_id: str | None,
    run_id: str | None,
    metadata: dict | None,
    db: AsyncSession,
    source_app: str | None = None,
    infer: bool = True,
    prompt: str | None = None,
    memory_type: str | None = None,
) -> list[dict]:
    """添加记忆 - 调用 mem0.add()"""
    client = await _get_mem0_client(project_id, db)

    kwargs = {}
    if user_id:
        kwargs["user_id"] = user_id
    if agent_id:
        kwargs["agent_id"] = agent_id
    if run_id:
        kwargs["run_id"] = run_id
    if metadata:
        kwargs["metadata"] = metadata
    if not infer:
        kwargs["infer"] = False
    if prompt:
        kwargs["prompt"] = prompt
    if memory_type:
        kwargs["memory_type"] = memory_type

    result = client.add(messages, **kwargs)

    # 同步到 PostgreSQL
    affected_memories = []
    if result and "results" in result:
        for item in result["results"]:
            event = (item.get("event") or "").upper()
            mem0_id = item.get("id")

            if event == "ADD":
                # 根据 memory_type 参数确定 PG 中的类型
                pg_memory_type = MemoryType.SEMANTIC
                if memory_type == "procedural_memory":
                    pg_memory_type = MemoryType.PROCEDURAL

                memory = Memory(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    mem0_memory_id=mem0_id,
                    user_id=user_id,
                    agent_id=agent_id,
                    run_id=run_id,
                    content=item.get("memory", ""),
                    memory_type=pg_memory_type,
                    metadata_json=json.dumps(metadata) if metadata else None,
                    source_app=source_app,
                )
                db.add(memory)
                affected_memories.append({
                    "id": memory.id,
                    "mem0_memory_id": mem0_id,
                    "memory": item.get("memory", ""),
                    "event": "ADD",
                })

            elif event == "UPDATE" and mem0_id:
                # 同步更新 PostgreSQL 中的记忆内容
                pg_result = await db.execute(
                    select(Memory).where(
                        Memory.project_id == project_id,
                        Memory.mem0_memory_id == mem0_id,
                        Memory.state == MemoryState.ACTIVE,
                    )
                )
                existing = pg_result.scalar_one_or_none()
                if existing:
                    existing.content = item.get("memory", existing.content)
                    existing.updated_at = datetime.utcnow()
                affected_memories.append({
                    "id": existing.id if existing else None,
                    "mem0_memory_id": mem0_id,
                    "memory": item.get("memory", ""),
                    "event": "UPDATE",
                    "previous_memory": item.get("previous_memory"),
                })

            elif event == "DELETE" and mem0_id:
                # 同步删除（标记为已删除）
                pg_result = await db.execute(
                    select(Memory).where(
                        Memory.project_id == project_id,
                        Memory.mem0_memory_id == mem0_id,
                    )
                )
                existing = pg_result.scalar_one_or_none()
                if existing:
                    existing.state = MemoryState.DELETED
                affected_memories.append({
                    "id": existing.id if existing else None,
                    "mem0_memory_id": mem0_id,
                    "memory": item.get("memory", ""),
                    "event": "DELETE",
                })

            else:
                # NOOP 或其他事件
                affected_memories.append({
                    "id": item.get("id"),
                    "memory": item.get("memory", ""),
                    "event": event or "NOOP",
                })

    return affected_memories if affected_memories else (result.get("results", []) if result else [])


async def get_all_memories(
    project_id: str,
    user_id: str | None,
    agent_id: str | None,
    run_id: str | None,
    page: int,
    page_size: int,
    db: AsyncSession,
) -> tuple[list[Memory], int]:
    """获取所有记忆"""
    query = select(Memory).where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
    count_query = select(func.count()).select_from(Memory).where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)

    if user_id:
        query = query.where(Memory.user_id == user_id)
        count_query = count_query.where(Memory.user_id == user_id)
    if agent_id:
        query = query.where(Memory.agent_id == agent_id)
        count_query = count_query.where(Memory.agent_id == agent_id)
    if run_id:
        query = query.where(Memory.run_id == run_id)
        count_query = count_query.where(Memory.run_id == run_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Memory.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    memories = result.scalars().all()

    return list(memories), total


async def get_memory(project_id: str, memory_id: str, db: AsyncSession) -> Memory | None:
    """获取单条记忆"""
    result = await db.execute(
        select(Memory).where(Memory.id == memory_id, Memory.project_id == project_id)
    )
    return result.scalar_one_or_none()


async def update_memory(project_id: str, memory_id: str, content: str, db: AsyncSession) -> Memory | None:
    """更新记忆"""
    memory = await get_memory(project_id, memory_id, db)
    if not memory:
        return None

    # 更新 mem0
    if memory.mem0_memory_id:
        client = await _get_mem0_client(project_id, db)
        try:
            client.update(memory.mem0_memory_id, data=content)
        except Exception as e:
            logger.warning(f"Failed to update mem0 memory: {e}")

    memory.content = content
    memory.updated_at = datetime.utcnow()
    return memory


async def delete_memory(project_id: str, memory_id: str, db: AsyncSession) -> bool:
    """删除记忆"""
    memory = await get_memory(project_id, memory_id, db)
    if not memory:
        return False

    # 从 mem0 删除
    if memory.mem0_memory_id:
        client = await _get_mem0_client(project_id, db)
        try:
            client.delete(memory.mem0_memory_id)
        except Exception as e:
            logger.warning(f"Failed to delete mem0 memory: {e}")

    memory.state = MemoryState.DELETED
    return True


async def search_memories(
    project_id: str,
    query: str,
    user_id: str | None,
    agent_id: str | None,
    run_id: str | None,
    limit: int,
    filters: dict | None,
    db: AsyncSession,
    threshold: float | None = None,
) -> list[dict]:
    """搜索记忆 - 调用 mem0.search()"""
    client = await _get_mem0_client(project_id, db)

    kwargs = {"limit": limit}
    if user_id:
        kwargs["user_id"] = user_id
    if agent_id:
        kwargs["agent_id"] = agent_id
    if run_id:
        kwargs["run_id"] = run_id
    if filters:
        kwargs["filters"] = filters
    if threshold is not None:
        kwargs["threshold"] = threshold

    result = client.search(query, **kwargs)

    results = []
    if result and "results" in result:
        for item in result["results"]:
            results.append({
                "id": item.get("id", ""),
                "memory": item.get("memory", ""),
                "score": item.get("score"),
                "user_id": item.get("user_id"),
                "agent_id": item.get("agent_id"),
            })
    elif isinstance(result, list):
        for item in result:
            results.append({
                "id": item.get("id", ""),
                "memory": item.get("memory", ""),
                "score": item.get("score"),
                "user_id": item.get("user_id"),
                "agent_id": item.get("agent_id"),
            })

    return results


async def get_memory_history(project_id: str, memory_id: str, db: AsyncSession) -> list[dict]:
    """获取记忆历史 - 调用 mem0.history()"""
    memory = await get_memory(project_id, memory_id, db)
    if not memory or not memory.mem0_memory_id:
        return []

    client = await _get_mem0_client(project_id, db)
    try:
        history = client.history(memory.mem0_memory_id)
        if not isinstance(history, list):
            return []
        # 字段映射: mem0 返回 old_memory/new_memory/event，前端期望 old_content/new_content/action
        normalized = []
        for entry in history:
            normalized.append({
                "id": entry.get("id", ""),
                "memory_id": entry.get("memory_id", ""),
                "old_content": entry.get("old_memory") or entry.get("old_content", ""),
                "new_content": entry.get("new_memory") or entry.get("new_content", ""),
                "action": (entry.get("event") or entry.get("action", "")).lower(),
                "created_at": entry.get("created_at") or entry.get("updated_at", ""),
            })
        return normalized
    except Exception as e:
        logger.warning(f"Failed to get memory history: {e}")
        return []


async def reset_memories(project_id: str, user_id: str | None, agent_id: str | None, db: AsyncSession) -> int:
    """重置记忆 - 调用 mem0.delete_all() 或 mem0.reset()"""
    client = await _get_mem0_client(project_id, db)

    try:
        if user_id or agent_id:
            # 按条件删除：使用 delete_all (支持 user_id/agent_id 过滤)
            kwargs = {}
            if user_id:
                kwargs["user_id"] = user_id
            if agent_id:
                kwargs["agent_id"] = agent_id
            client.delete_all(**kwargs)
        else:
            # 全量重置：使用 reset (不接受参数)
            client.reset()
    except Exception as e:
        logger.warning(f"Failed to reset mem0 memories: {e}")

    # 标记 PostgreSQL 中的记忆为已删除
    query = select(Memory).where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
    if user_id:
        query = query.where(Memory.user_id == user_id)
    if agent_id:
        query = query.where(Memory.agent_id == agent_id)

    result = await db.execute(query)
    memories = result.scalars().all()
    count = len(memories)
    for m in memories:
        m.state = MemoryState.DELETED

    return count


async def get_memory_stats(project_id: str, db: AsyncSession) -> dict:
    """获取记忆统计"""
    total_result = await db.execute(
        select(func.count()).select_from(Memory).where(
            Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE
        )
    )
    total = total_result.scalar()

    # 按类型统计
    type_result = await db.execute(
        select(Memory.memory_type, func.count()).where(
            Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE
        ).group_by(Memory.memory_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # 最近 7 天每天新增数
    from datetime import timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_result = await db.execute(
        select(
            func.date(Memory.created_at),
            func.count(),
        ).where(
            Memory.project_id == project_id,
            Memory.created_at >= seven_days_ago,
        ).group_by(func.date(Memory.created_at)).order_by(func.date(Memory.created_at))
    )
    daily = [{"date": str(row[0]), "count": row[1]} for row in daily_result.all()]

    return {
        "total": total,
        "by_type": by_type,
        "daily_trend": daily,
    }
