"""图谱存储服务 - Neo4j 集成"""
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.models.memory import Memory, MemoryState
from app.config import get_settings

logger = logging.getLogger(__name__)

# Neo4j 驱动懒加载
_neo4j_driver = None


def _get_neo4j_driver():
    global _neo4j_driver
    if _neo4j_driver is not None:
        return _neo4j_driver
    settings = get_settings()
    neo4j_url = getattr(settings, "NEO4J_URL", "")
    if not neo4j_url:
        return None
    try:
        from neo4j import GraphDatabase
        _neo4j_driver = GraphDatabase.driver(
            neo4j_url,
            auth=(
                getattr(settings, "NEO4J_USER", "neo4j"),
                getattr(settings, "NEO4J_PASSWORD", "password"),
            ),
        )
        return _neo4j_driver
    except Exception as e:
        logger.warning(f"Neo4j not available: {e}")
        return None


async def get_graph_entities(project_id: str, db: AsyncSession) -> dict:
    """获取图谱实体和关系"""
    driver = _get_neo4j_driver()

    if driver:
        return await _get_graph_from_neo4j(project_id, driver)

    # 降级: 从 PostgreSQL 中基于记忆内容构建简单图谱
    return await _build_graph_from_memories(project_id, db)


async def _get_graph_from_neo4j(project_id: str, driver) -> dict:
    """从 Neo4j 获取图谱数据"""
    try:
        with driver.session() as session:
            # 获取节点
            nodes_result = session.run(
                """
                MATCH (n)
                WHERE n.project_id = $project_id
                RETURN n.id AS id, n.name AS name, labels(n) AS labels,
                       n.type AS type, n.properties AS properties
                LIMIT 500
                """,
                project_id=project_id,
            )
            nodes = []
            for record in nodes_result:
                nodes.append({
                    "id": record["id"],
                    "name": record["name"],
                    "type": record["labels"][0] if record["labels"] else "Entity",
                    "properties": record["properties"] or {},
                })

            # 获取关系
            edges_result = session.run(
                """
                MATCH (a)-[r]->(b)
                WHERE a.project_id = $project_id
                RETURN a.id AS source, b.id AS target, type(r) AS relation,
                       r.weight AS weight
                LIMIT 1000
                """,
                project_id=project_id,
            )
            edges = []
            for record in edges_result:
                edges.append({
                    "source": record["source"],
                    "target": record["target"],
                    "relation": record["relation"],
                    "weight": record["weight"] or 1,
                })

            return {"nodes": nodes, "edges": edges}
    except Exception as e:
        logger.error(f"Neo4j query failed: {e}")
        return {"nodes": [], "edges": []}


async def _build_graph_from_memories(project_id: str, db: AsyncSession) -> dict:
    """从 PostgreSQL 记忆数据构建简单图谱（降级方案）"""
    result = await db.execute(
        select(Memory).where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
        ).order_by(Memory.created_at.desc()).limit(200)
    )
    memories = result.scalars().all()

    nodes = []
    edges = []
    node_ids = set()
    entity_memories = {}  # entity_name -> [memory_ids]

    for m in memories:
        # 每条记忆作为一个节点
        mem_node_id = f"mem_{m.id[:8]}"
        nodes.append({
            "id": mem_node_id,
            "name": m.content[:50] + ("..." if len(m.content) > 50 else ""),
            "type": "Memory",
            "properties": {
                "memory_type": m.memory_type,
                "user_id": m.user_id,
                "agent_id": m.agent_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            },
        })
        node_ids.add(mem_node_id)

        # user_id 作为实体节点
        if m.user_id and m.user_id not in node_ids:
            nodes.append({
                "id": m.user_id,
                "name": f"User: {m.user_id}",
                "type": "User",
                "properties": {},
            })
            node_ids.add(m.user_id)
        if m.user_id:
            edges.append({
                "source": m.user_id,
                "target": mem_node_id,
                "relation": "CREATED",
                "weight": 1,
            })

        # agent_id 作为实体节点
        if m.agent_id and m.agent_id not in node_ids:
            nodes.append({
                "id": m.agent_id,
                "name": f"Agent: {m.agent_id}",
                "type": "Agent",
                "properties": {},
            })
            node_ids.add(m.agent_id)
        if m.agent_id:
            edges.append({
                "source": m.agent_id,
                "target": mem_node_id,
                "relation": "GENERATED",
                "weight": 1,
            })

    return {"nodes": nodes, "edges": edges}


async def get_graph_stats(project_id: str, db: AsyncSession) -> dict:
    """获取图谱统计信息"""
    driver = _get_neo4j_driver()

    if driver:
        try:
            with driver.session() as session:
                result = session.run(
                    """
                    MATCH (n) WHERE n.project_id = $project_id
                    WITH count(n) AS node_count
                    MATCH (a)-[r]->(b) WHERE a.project_id = $project_id
                    RETURN node_count, count(r) AS edge_count
                    """,
                    project_id=project_id,
                )
                record = result.single()
                if record:
                    return {
                        "node_count": record["node_count"],
                        "edge_count": record["edge_count"],
                        "backend": "neo4j",
                    }
        except Exception as e:
            logger.warning(f"Neo4j stats query failed: {e}")

    # 降级统计
    memories_count = await db.execute(
        select(func.count()).select_from(Memory).where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
        )
    )
    total = memories_count.scalar() or 0
    users_count = await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.user_id.isnot(None),
        )
    )
    agents_count = await db.execute(
        select(func.count(func.distinct(Memory.agent_id))).where(
            Memory.project_id == project_id,
            Memory.state == MemoryState.ACTIVE,
            Memory.agent_id.isnot(None),
        )
    )

    return {
        "node_count": total + (users_count.scalar() or 0) + (agents_count.scalar() or 0),
        "edge_count": total,  # 每条记忆至少一条边
        "backend": "postgresql_fallback",
    }
