from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, organizations, projects, memories, config, api_keys, agents, analytics, webhooks

app = FastAPI(
    title="MemVault API",
    description="多租户 AI 记忆管理平台 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "memvault-api"}


@app.get("/")
async def root():
    return {
        "name": "MemVault API",
        "version": "0.1.0",
        "docs": "/docs",
    }
