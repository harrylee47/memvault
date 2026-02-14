"""Redis 速率限制中间件"""
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request

logger = logging.getLogger(__name__)

# 速率限制配置（每分钟请求数）
RATE_LIMITS = {
    "default": 120,
    "auth": 20,
    "memories_write": 60,
    "search": 60,
    "export": 10,
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 从 app.state 获取 Redis（懒加载）
        redis = getattr(request.app.state, "redis", None)
        if not redis:
            return await call_next(request)

        # 确定限制类别
        path = request.url.path
        method = request.method
        category = "default"

        if "/auth/" in path:
            category = "auth"
        elif "/memories" in path and method == "POST" and "/search" not in path:
            category = "memories_write"
        elif "/search" in path:
            category = "search"
        elif "/export" in path:
            category = "export"

        # 获取客户端标识（优先 API Key，其次 IP）
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer mv_"):
            client_id = f"apikey:{auth_header[7:17]}"
        elif auth_header.startswith("Bearer "):
            client_id = f"jwt:{auth_header[7:27]}"
        else:
            client_id = f"ip:{request.client.host if request.client else 'unknown'}"

        limit = RATE_LIMITS.get(category, RATE_LIMITS["default"])
        key = f"ratelimit:{category}:{client_id}"

        try:
            current = await redis.get(key)
            if current and int(current) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={
                        "Retry-After": "60",
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                    },
                )

            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            await pipe.execute()
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")

        response = await call_next(request)

        # 添加速率限制响应头
        try:
            current = await redis.get(key)
            remaining = max(0, limit - int(current or 0))
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        except Exception:
            pass

        return response
