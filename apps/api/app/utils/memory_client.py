"""项目级 mem0 Memory 客户端池"""
import hashlib
import json
import logging
from typing import Dict
from mem0 import Memory
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_client_pool: Dict[str, Memory] = {}
_config_hashes: Dict[str, str] = {}


def _hash_config(config: dict) -> str:
    """计算配置哈希，用于检测配置变化"""
    config_str = json.dumps(config, sort_keys=True)
    return hashlib.md5(config_str.encode()).hexdigest()


def build_mem0_config(project_id: str, project_config: dict | None = None) -> dict:
    """构建 mem0 配置，合并项目配置和全局默认值"""
    config = {
        "llm": {
            "provider": settings.LLM_PROVIDER,
            "config": {
                "model": settings.LLM_MODEL,
                "temperature": 0.0,
                "max_tokens": 1500,
            },
        },
        "embedder": {
            "provider": settings.EMBEDDER_PROVIDER,
            "config": {
                "model": settings.EMBEDDER_MODEL,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": f"memvault_{project_id}",
                "host": settings.QDRANT_HOST,
                "port": settings.QDRANT_PORT,
            },
        },
        "version": "v1.1",
    }

    if not project_config:
        return config

    # 合并项目级 LLM 配置
    if "llm" in project_config and project_config["llm"]:
        llm = project_config["llm"]
        config["llm"]["provider"] = llm.get("provider", config["llm"]["provider"])
        config["llm"]["config"]["model"] = llm.get("model", config["llm"]["config"]["model"])
        if llm.get("api_key"):
            config["llm"]["config"]["api_key"] = llm["api_key"]
        if llm.get("api_base_url"):
            provider = config["llm"]["provider"]
            if provider == "ollama":
                config["llm"]["config"]["ollama_base_url"] = llm["api_base_url"]
            else:
                config["llm"]["config"]["openai_base_url"] = llm["api_base_url"]
        if "temperature" in llm:
            config["llm"]["config"]["temperature"] = llm["temperature"]
        if "max_tokens" in llm:
            config["llm"]["config"]["max_tokens"] = llm["max_tokens"]

    # 合并项目级 Embedder 配置
    if "embedder" in project_config and project_config["embedder"]:
        emb = project_config["embedder"]
        config["embedder"]["provider"] = emb.get("provider", config["embedder"]["provider"])
        config["embedder"]["config"]["model"] = emb.get("model", config["embedder"]["config"]["model"])
        if emb.get("api_key"):
            config["embedder"]["config"]["api_key"] = emb["api_key"]
        if emb.get("api_base_url"):
            emb_provider = config["embedder"]["provider"]
            if emb_provider == "ollama":
                config["embedder"]["config"]["ollama_base_url"] = emb["api_base_url"]
            else:
                config["embedder"]["config"]["openai_base_url"] = emb["api_base_url"]

    # 合并项目级 Vector Store 配置
    if "vector_store" in project_config and project_config["vector_store"]:
        vs = project_config["vector_store"]
        config["vector_store"]["provider"] = vs.get("provider", config["vector_store"]["provider"])
        if vs.get("host"):
            config["vector_store"]["config"]["host"] = vs["host"]
        if vs.get("port"):
            config["vector_store"]["config"]["port"] = vs["port"]

    # 图存储（可选）
    if "graph_store" in project_config and project_config["graph_store"]:
        gs = project_config["graph_store"]
        config["graph_store"] = {
            "provider": gs.get("provider", "neo4j"),
            "config": {
                "url": gs.get("url", ""),
                "username": gs.get("username", ""),
                "password": gs.get("password", ""),
            },
        }

    # 重排序器（可选）
    if "reranker" in project_config and project_config["reranker"]:
        rr = project_config["reranker"]
        config["reranker"] = {
            "provider": rr.get("provider", "cross-encoder"),
            "config": {
                "model": rr.get("model", "cross-encoder/ms-marco-MiniLM-L-6-v2"),
            },
        }

    # 自定义指令
    if "custom_instructions" in project_config and project_config["custom_instructions"]:
        config["custom_fact_extraction_prompt"] = project_config["custom_instructions"]

    return config


def get_project_memory_client(project_id: str, project_config: dict | None = None) -> Memory:
    """
    获取项目级 mem0 Memory 客户端。
    支持配置热更新：检测 config hash 变化自动重建客户端。
    """
    config = build_mem0_config(project_id, project_config)
    config_hash = _hash_config(config)

    if project_id in _client_pool and _config_hashes.get(project_id) == config_hash:
        return _client_pool[project_id]

    logger.info(f"Creating new mem0 client for project {project_id}")
    client = Memory.from_config(config_dict=config)
    _client_pool[project_id] = client
    _config_hashes[project_id] = config_hash
    return client


def invalidate_client(project_id: str):
    """使项目客户端缓存失效"""
    _client_pool.pop(project_id, None)
    _config_hashes.pop(project_id, None)
