import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth, organizations, projects, memories, config,
    api_keys, agents, analytics, webhooks, audit_logs, graph,
)
from app.mcp import mcp_router
from app.middleware.rate_limit import RateLimitMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期"""
    # 启动 - 初始化 Redis 连接
    redis_client = None
    try:
        import redis.asyncio as aioredis
        from app.config import get_settings
        settings = get_settings()
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        app.state.redis = redis_client
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
        app.state.redis = None
    yield
    # 关闭
    if redis_client:
        await redis_client.close()


app = FastAPI(
    title="MemVault API",
    description="多租户 AI 记忆管理平台 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:3001",
        "http://127.0.0.1:3000", "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 速率限制中间件（Redis 懒加载）
app.add_middleware(RateLimitMiddleware)

# 路由
app.include_router(auth.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(config.router, prefix="/api/v1")
app.include_router(api_keys.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")

# MCP SSE 端点（不使用 /api/v1 前缀，供 Claude Desktop / Cursor 直接连接）
app.include_router(mcp_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "memvault-api", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "name": "MemVault API",
        "version": "1.0.0",
        "docs": "/docs",
    }
