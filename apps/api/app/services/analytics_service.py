"""深度统计分析服务"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, case
from app.models.memory import Memory, MemoryState, MemoryType
from app.models.agent import Agent
from app.models.audit_log import AuditLog
from app.models.api_key import ApiKey


async def get_memory_analytics(project_id: str, days: int, db: AsyncSession) -> dict:
    """记忆深度分析"""
    since = datetime.utcnow() - timedelta(days=days)

    # 每日趋势（创建/更新/删除）
    daily_created = await db.execute(
        select(func.date(Memory.created_at), func.count())
        .where(Memory.project_id == project_id, Memory.created_at >= since)
        .group_by(func.date(Memory.created_at))
        .order_by(func.date(Memory.created_at))
    )

    # 按类型统计
    by_type = await db.execute(
        select(Memory.memory_type, func.count())
        .where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
        .group_by(Memory.memory_type)
    )

    # 按来源统计
    by_source = await db.execute(
        select(Memory.source_app, func.count())
        .where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.source_app.isnot(None),
        )
        .group_by(Memory.source_app)
    )

    # 活跃用户排名
    top_users = await db.execute(
        select(Memory.user_id, func.count().label("count"))
        .where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.user_id.isnot(None),
        )
        .group_by(Memory.user_id)
        .order_by(func.count().desc())
        .limit(10)
    )

    # 每小时分布（热力图数据）
    hourly = await db.execute(
        select(func.extract("hour", Memory.created_at).label("hour"), func.count())
        .where(Memory.project_id == project_id, Memory.created_at >= since)
        .group_by("hour")
        .order_by("hour")
    )

    # 平均记忆长度
    avg_length = await db.execute(
        select(func.avg(func.length(Memory.content)))
        .where(Memory.project_id == project_id, Memory.state == MemoryState.ACTIVE)
    )

    return {
        "daily_trend": [{"date": str(row[0]), "count": row[1]} for row in daily_created.all()],
        "by_type": {row[0]: row[1] for row in by_type.all()},
        "by_source": {(row[0] or "unknown"): row[1] for row in by_source.all()},
        "top_users": [{"user_id": row[0], "count": row[1]} for row in top_users.all()],
        "hourly_distribution": {int(row[0]): row[1] for row in hourly.all()},
        "avg_memory_length": round(avg_length.scalar() or 0, 1),
    }


async def get_agent_analytics(project_id: str, db: AsyncSession) -> dict:
    """Agent 统计分析"""
    # Agent 列表及其记忆数
    agents_with_count = await db.execute(
        select(Agent.id, Agent.name, Agent.agent_type, Agent.agent_id, Agent.last_active,
               func.count(Memory.id).label("memory_count"))
        .outerjoin(Memory, (Memory.agent_id == Agent.agent_id) & (Memory.project_id == Agent.project_id))
        .where(Agent.project_id == project_id)
        .group_by(Agent.id, Agent.name, Agent.agent_type, Agent.agent_id, Agent.last_active)
        .order_by(func.count(Memory.id).desc())
    )

    agents = []
    for row in agents_with_count.all():
        agents.append({
            "id": row[0],
            "name": row[1],
            "agent_type": row[2],
            "agent_id": row[3],
            "last_active": row[4].isoformat() if row[4] else None,
            "memory_count": row[5],
        })

    # Agent 类型分布
    by_type = await db.execute(
        select(Agent.agent_type, func.count())
        .where(Agent.project_id == project_id)
        .group_by(Agent.agent_type)
    )

    return {
        "agents": agents,
        "by_type": {row[0]: row[1] for row in by_type.all()},
        "total": len(agents),
    }


async def get_usage_analytics(project_id: str, days: int, db: AsyncSession) -> dict:
    """用量统计（基于审计日志）"""
    since = datetime.utcnow() - timedelta(days=days)

    # 操作分布
    action_counts = await db.execute(
        select(AuditLog.action, func.count())
        .where(AuditLog.project_id == project_id, AuditLog.created_at >= since)
        .group_by(AuditLog.action)
        .order_by(func.count().desc())
    )

    # 每日 API 调用量
    daily_calls = await db.execute(
        select(func.date(AuditLog.created_at), func.count())
        .where(AuditLog.project_id == project_id, AuditLog.created_at >= since)
        .group_by(func.date(AuditLog.created_at))
        .order_by(func.date(AuditLog.created_at))
    )

    # 资源类型分布
    resource_counts = await db.execute(
        select(AuditLog.resource_type, func.count())
        .where(AuditLog.project_id == project_id, AuditLog.created_at >= since)
        .group_by(AuditLog.resource_type)
    )

    return {
        "action_distribution": {row[0]: row[1] for row in action_counts.all()},
        "daily_api_calls": [{"date": str(row[0]), "count": row[1]} for row in daily_calls.all()],
        "resource_distribution": {row[0]: row[1] for row in resource_counts.all()},
    }


async def get_category_analytics(project_id: str, db: AsyncSession) -> dict:
    """分类统计"""
    from app.models.memory import Category, memory_categories

    categories = await db.execute(
        select(Category.id, Category.name, Category.color, func.count(memory_categories.c.memory_id).label("count"))
        .outerjoin(memory_categories, memory_categories.c.category_id == Category.id)
        .where(Category.project_id == project_id)
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.count(memory_categories.c.memory_id).desc())
    )

    return {
        "categories": [
            {"id": row[0], "name": row[1], "color": row[2], "count": row[3]}
            for row in categories.all()
        ]
    }
