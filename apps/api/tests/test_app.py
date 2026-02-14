"""FastAPI 应用加载测试"""
from main import app


class TestAppStartup:
    def test_app_created(self):
        assert app is not None
        assert app.title == "MemVault API"
        assert app.version == "1.0.0"

    def test_routes_registered(self):
        route_paths = [r.path for r in app.routes if hasattr(r, "path")]
        # 核心路由存在
        assert "/health" in route_paths
        assert "/" in route_paths
        assert "/api/v1/auth/register" in route_paths
        assert "/api/v1/auth/login" in route_paths
        assert "/api/v1/auth/me" in route_paths
        assert "/api/v1/memories" in route_paths
        assert "/api/v1/memories/search" in route_paths
        assert "/api/v1/config" in route_paths
        assert "/api/v1/api-keys" in route_paths
        assert "/api/v1/agents" in route_paths
        assert "/api/v1/organizations" in route_paths
        assert "/api/v1/projects" in route_paths
        assert "/api/v1/webhooks" in route_paths
        assert "/api/v1/analytics/overview" in route_paths

    def test_cors_middleware(self):
        middleware_classes = [type(m).__name__ for m in app.user_middleware]
        # CORSMiddleware 通过 add_middleware 添加
        assert any("CORS" in str(m) for m in app.user_middleware)
