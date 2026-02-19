import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth, organizations, projects, memories, config,
    api_keys, agents, analytics, webhooks, audit_logs, graph,
    requests, admin, plans, system,
)
from app.mcp import mcp_router
from app.middleware.rate_limit import RateLimitMiddleware

logger = logging.getLogger(__name__)


async def _ensure_default_admin():
    """首次启动时自动创建默认管理员账号"""
    import uuid
    import secrets
    from sqlalchemy import select
    from app.database import async_session
    from app.models.user import User
    from app.models.organization import Organization, OrgMember, OrgRole
    from app.models.project import Project, ProjectConfig
    from app.middleware.auth import hash_password

    async with async_session() as db:
        # 检查是否已存在管理员
        result = await db.execute(select(User).where(User.is_admin == True).limit(1))
        if result.scalar_one_or_none():
            logger.info("Admin user already exists, skipping default admin creation")
            return

        admin_email = "admin@memvault.com"
        admin_name = "admin"
        admin_password = "a123456"

        # 检查邮箱是否已被占用
        result = await db.execute(select(User).where(User.email == admin_email))
        if result.scalar_one_or_none():
            logger.info("Default admin email already exists, skipping")
            return

        # 创建管理员用户
        user = User(
            id=str(uuid.uuid4()),
            email=admin_email,
            name=admin_name,
            hashed_password=hash_password(admin_password),
            provider="email",
            is_admin=True,
        )
        db.add(user)

        # 创建默认组织
        org = Organization(
            id=str(uuid.uuid4()),
            name="System Admin Org",
            slug=f"admin-{secrets.token_hex(3)}",
        )
        db.add(org)

        # 添加为 owner
        member = OrgMember(
            id=str(uuid.uuid4()),
            org_id=org.id,
            user_id=user.id,
            role=OrgRole.OWNER,
        )
        db.add(member)

        # 创建默认项目
        project = Project(
            id=str(uuid.uuid4()),
            org_id=org.id,
            name="Default Project",
            slug="default",
            created_by=user.id,
        )
        db.add(project)

        # 创建默认项目配置
        project_config = ProjectConfig(
            id=str(uuid.uuid4()),
            project_id=project.id,
            mem0_config={},
        )
        db.add(project_config)

        await db.commit()
        logger.info(f"Default admin created: {admin_email} / {admin_password}")


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

    # 启动 - 创建默认管理员
    try:
        await _ensure_default_admin()
    except Exception as e:
        logger.warning(f"Default admin creation failed: {e}")

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
app.include_router(requests.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(plans.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")

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
