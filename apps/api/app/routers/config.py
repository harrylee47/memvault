import copy
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.project import ProjectConfig
from app.schemas.config import (
    ProjectConfigResponse, ProjectConfigUpdate,
    LLMConfig, EmbedderConfig, VectorStoreConfig, GraphStoreConfig, RerankerConfig,
)
from app.utils.memory_client import invalidate_client

router = APIRouter(prefix="/config", tags=["配置"])


async def _get_config(project_id: str, db: AsyncSession) -> ProjectConfig:
    result = await db.execute(
        select(ProjectConfig).where(ProjectConfig.project_id == project_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Project config not found")
    return config


def _config_to_response(config: ProjectConfig) -> ProjectConfigResponse:
    mem0_config = config.mem0_config or {}
    return ProjectConfigResponse(
        project_id=config.project_id,
        llm=LLMConfig(**mem0_config["llm"]) if "llm" in mem0_config else None,
        embedder=EmbedderConfig(**mem0_config["embedder"]) if "embedder" in mem0_config else None,
        vector_store=VectorStoreConfig(**mem0_config["vector_store"]) if "vector_store" in mem0_config else None,
        graph_store=GraphStoreConfig(**mem0_config["graph_store"]) if "graph_store" in mem0_config else None,
        reranker=RerankerConfig(**mem0_config["reranker"]) if "reranker" in mem0_config else None,
        custom_instructions=config.custom_instructions,
        max_memories=config.max_memories,
    )


@router.get("", response_model=ProjectConfigResponse)
async def get_config(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目配置"""
    config = await _get_config(project_id, db)
    return _config_to_response(config)


@router.put("", response_model=ProjectConfigResponse)
async def update_config(
    data: ProjectConfigUpdate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新完整项目配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})

    if data.llm is not None:
        new_llm = data.llm.model_dump(exclude_none=True)
        # 合并: 保留已有字段，用新值覆盖
        existing_llm = mem0_config.get("llm", {})
        existing_llm.update(new_llm)
        mem0_config["llm"] = existing_llm
    if data.embedder is not None:
        new_emb = data.embedder.model_dump(exclude_none=True)
        existing_emb = mem0_config.get("embedder", {})
        existing_emb.update(new_emb)
        mem0_config["embedder"] = existing_emb
    if data.vector_store is not None:
        new_vs = data.vector_store.model_dump(exclude_none=True)
        existing_vs = mem0_config.get("vector_store", {})
        existing_vs.update(new_vs)
        mem0_config["vector_store"] = existing_vs
    if data.graph_store is not None:
        new_gs = data.graph_store.model_dump(exclude_none=True)
        existing_gs = mem0_config.get("graph_store", {})
        existing_gs.update(new_gs)
        mem0_config["graph_store"] = existing_gs
    if data.reranker is not None:
        new_rr = data.reranker.model_dump(exclude_none=True)
        existing_rr = mem0_config.get("reranker", {})
        existing_rr.update(new_rr)
        mem0_config["reranker"] = existing_rr
    if data.custom_instructions is not None:
        config.custom_instructions = data.custom_instructions
    if data.max_memories is not None:
        config.max_memories = data.max_memories

    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    # 使客户端缓存失效，下次访问重建
    invalidate_client(project_id)
    return _config_to_response(config)


@router.put("/mem0/llm", response_model=ProjectConfigResponse)
async def update_llm_config(
    data: LLMConfig,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新 LLM 配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})
    existing = mem0_config.get("llm", {})
    existing.update(data.model_dump(exclude_none=True))
    mem0_config["llm"] = existing
    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    invalidate_client(project_id)
    return _config_to_response(config)


@router.put("/mem0/embedder", response_model=ProjectConfigResponse)
async def update_embedder_config(
    data: EmbedderConfig,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新嵌入模型配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})
    existing = mem0_config.get("embedder", {})
    existing.update(data.model_dump(exclude_none=True))
    mem0_config["embedder"] = existing
    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    invalidate_client(project_id)
    return _config_to_response(config)


@router.put("/mem0/vector_store", response_model=ProjectConfigResponse)
async def update_vector_store_config(
    data: VectorStoreConfig,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新向量存储配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})
    existing = mem0_config.get("vector_store", {})
    existing.update(data.model_dump(exclude_none=True))
    mem0_config["vector_store"] = existing
    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    invalidate_client(project_id)
    return _config_to_response(config)


@router.put("/mem0/graph_store", response_model=ProjectConfigResponse)
async def update_graph_store_config(
    data: GraphStoreConfig,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新图存储配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})
    existing = mem0_config.get("graph_store", {})
    existing.update(data.model_dump(exclude_none=True))
    mem0_config["graph_store"] = existing
    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    invalidate_client(project_id)
    return _config_to_response(config)


@router.put("/mem0/reranker", response_model=ProjectConfigResponse)
async def update_reranker_config(
    data: RerankerConfig,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新重排序器配置"""
    config = await _get_config(project_id, db)
    mem0_config = copy.deepcopy(config.mem0_config or {})
    existing = mem0_config.get("reranker", {})
    existing.update(data.model_dump(exclude_none=True))
    mem0_config["reranker"] = existing
    config.mem0_config = mem0_config
    flag_modified(config, "mem0_config")
    invalidate_client(project_id)
    return _config_to_response(config)
