"""
MCP (Model Context Protocol) SSE 服务器

提供 SSE 端点让 Claude Desktop / Cursor 等客户端通过 MCP 协议读写记忆。

端点:
  GET  /mcp/{project_id}/sse       - SSE 连接（长连接，推送事件）
  POST /mcp/{project_id}/messages  - 接收客户端 JSON-RPC 消息
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Query, Request, Header, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func as sa_func

from app.database import async_session
from app.middleware.auth import hash_api_key
from app.models.api_key import ApiKey
from app.models.project import Project, ProjectConfig
from app.models.memory import Memory, MemoryState
from app.models.request_log import RequestLog
from app.services.plan_service import check_memory_limit, check_request_limit
from app.utils.memory_client import get_project_memory_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP"])

# ---------- 活跃 SSE 会话管理 ----------

# session_id -> asyncio.Queue  每个 SSE 连接拥有一个消息队列
_sessions: dict[str, asyncio.Queue] = {}


# ---------- 认证辅助 ----------

async def _authenticate(
    project_id: str,
    api_key_query: str | None = None,
    authorization: str | None = None,
) -> ApiKey:
    """
    从 query param `api_key` 或 Authorization header 中提取 API Key 并验证。
    返回合法的 ApiKey 模型实例。
    """
    raw_key: str | None = None

    # 优先 query param
    if api_key_query:
        raw_key = api_key_query
    elif authorization:
        # 支持 "Bearer mv_xxx" 和裸 "mv_xxx"
        if authorization.startswith("Bearer "):
            raw_key = authorization[7:]
        else:
            raw_key = authorization

    if not raw_key or not raw_key.startswith("mv_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key. Provide via ?api_key= or Authorization header.",
        )

    key_hash = hash_api_key(raw_key)

    async with async_session() as db:
        result = await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
        )
        api_key_obj = result.scalar_one_or_none()

        if not api_key_obj:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

        if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key expired")

        if api_key_obj.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key not authorized for this project",
            )

        # 更新最后使用时间
        api_key_obj.last_used_at = datetime.utcnow()
        await db.commit()

    return api_key_obj


# ---------- mem0 客户端辅助 ----------

async def _get_mem0_client(project_id: str):
    """获取项目对应的 mem0 Memory 实例"""
    async with async_session() as db:
        result = await db.execute(
            select(ProjectConfig).where(ProjectConfig.project_id == project_id)
        )
        config = result.scalar_one_or_none()
        project_config = config.mem0_config if config else None

    return get_project_memory_client(project_id, project_config)


# ---------- MCP 工具定义 ----------

MCP_TOOLS = [
    {
        "name": "add_memory",
        "description": "添加一条新记忆。传入对话消息，系统会自动提取事实并存储。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "messages": {
                    "type": "array",
                    "description": "对话消息列表，格式: [{\"role\": \"user\", \"content\": \"...\"}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["role", "content"],
                    },
                },
                "user_id": {
                    "type": "string",
                    "description": "可选，关联的用户 ID",
                },
                "agent_id": {
                    "type": "string",
                    "description": "可选，关联的 Agent ID",
                },
                "metadata": {
                    "type": "object",
                    "description": "可选，自定义元数据",
                },
            },
            "required": ["messages"],
        },
    },
    {
        "name": "search_memory",
        "description": "基于语义搜索记忆。返回与查询最相关的记忆列表。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索查询文本",
                },
                "user_id": {
                    "type": "string",
                    "description": "可选，限定用户范围",
                },
                "agent_id": {
                    "type": "string",
                    "description": "可选，限定 Agent 范围",
                },
                "limit": {
                    "type": "integer",
                    "description": "返回数量上限，默认 10",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_memories",
        "description": "获取所有记忆列表，可按 user_id 或 agent_id 过滤。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "可选，按用户 ID 过滤",
                },
                "agent_id": {
                    "type": "string",
                    "description": "可选，按 Agent ID 过滤",
                },
            },
        },
    },
    {
        "name": "delete_memory",
        "description": "删除指定 ID 的记忆。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "memory_id": {
                    "type": "string",
                    "description": "要删除的记忆 ID（mem0 memory ID）",
                },
            },
            "required": ["memory_id"],
        },
    },
]


# ---------- 工具执行 ----------

async def _check_plan_limits(project_id: str, check_memory: bool = False, check_request: bool = False):
    """检查 Plan 限制，超限抛出 HTTPException"""
    async with async_session() as db:
        proj_result = await db.execute(select(Project).where(Project.id == project_id))
        project = proj_result.scalar_one_or_none()
        if not project:
            return
        org_proj_result = await db.execute(select(Project.id).where(Project.org_id == project.org_id))
        org_project_ids = [row[0] for row in org_proj_result.all()]
        if check_memory:
            await check_memory_limit(project.org_id, org_project_ids, db)
        if check_request:
            await check_request_limit(project.org_id, org_project_ids, db)


async def _handle_tool_call(project_id: str, tool_name: str, arguments: dict) -> list[dict]:
    """
    执行 MCP 工具调用，返回 MCP content 列表。
    每个工具都通过 mem0 客户端池获取对应项目的 Memory 实例。
    """
    client = await _get_mem0_client(project_id)

    if tool_name == "add_memory":
        messages = arguments.get("messages", [])
        if not messages:
            return [{"type": "text", "text": "Error: messages is required and cannot be empty."}]

        # 检查记忆数量和请求限制
        try:
            await _check_plan_limits(project_id, check_memory=True, check_request=True)
        except HTTPException as e:
            return [{"type": "text", "text": f"Plan limit exceeded: {e.detail}"}]

        kwargs = {}
        if arguments.get("user_id"):
            kwargs["user_id"] = arguments["user_id"]
        if arguments.get("agent_id"):
            kwargs["agent_id"] = arguments["agent_id"]
        if arguments.get("metadata"):
            kwargs["metadata"] = arguments["metadata"]

        result = client.add(messages, **kwargs, async_mode=False)
        return [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}]

    elif tool_name == "search_memory":
        query = arguments.get("query", "")
        if not query:
            return [{"type": "text", "text": "Error: query is required."}]

        # 检查请求限制
        try:
            await _check_plan_limits(project_id, check_request=True)
        except HTTPException as e:
            return [{"type": "text", "text": f"Plan limit exceeded: {e.detail}"}]

        kwargs = {"limit": arguments.get("limit", 10)}
        if arguments.get("user_id"):
            kwargs["user_id"] = arguments["user_id"]
        if arguments.get("agent_id"):
            kwargs["agent_id"] = arguments["agent_id"]

        result = client.search(query, **kwargs)
        return [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}]

    elif tool_name == "get_memories":
        kwargs = {}
        if arguments.get("user_id"):
            kwargs["user_id"] = arguments["user_id"]
        if arguments.get("agent_id"):
            kwargs["agent_id"] = arguments["agent_id"]

        result = client.get_all(**kwargs)
        return [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}]

    elif tool_name == "delete_memory":
        memory_id = arguments.get("memory_id", "")
        if not memory_id:
            return [{"type": "text", "text": "Error: memory_id is required."}]

        try:
            client.delete(memory_id)
            return [{"type": "text", "text": json.dumps({"status": "deleted", "memory_id": memory_id})}]
        except Exception as e:
            return [{"type": "text", "text": f"Error deleting memory: {e}"}]

    else:
        return [{"type": "text", "text": f"Unknown tool: {tool_name}"}]


# ---------- JSON-RPC 消息处理 ----------

def _jsonrpc_response(id: str | int | None, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": id, "result": result}


def _jsonrpc_error(id: str | int | None, code: int, message: str, data: dict | None = None) -> dict:
    error = {"code": code, "message": message}
    if data:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": id, "error": error}


async def _process_message(project_id: str, message: dict) -> dict | None:
    """
    处理一条 JSON-RPC 请求消息，返回响应（或 None 表示 notification）。
    遵循 MCP 协议规范。
    """
    method = message.get("method", "")
    msg_id = message.get("id")
    params = message.get("params", {})

    # --- initialize ---
    if method == "initialize":
        return _jsonrpc_response(msg_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {"listChanged": False},
            },
            "serverInfo": {
                "name": "memvault-mcp",
                "version": "0.1.0",
            },
        })

    # --- notifications/initialized (notification, 无需响应) ---
    if method == "notifications/initialized":
        return None

    # --- ping ---
    if method == "ping":
        return _jsonrpc_response(msg_id, {})

    # --- tools/list ---
    if method == "tools/list":
        return _jsonrpc_response(msg_id, {"tools": MCP_TOOLS})

    # --- tools/call ---
    if method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        try:
            content = await _handle_tool_call(project_id, tool_name, arguments)
            return _jsonrpc_response(msg_id, {"content": content, "isError": False})
        except Exception as e:
            logger.exception(f"MCP tool call error: {tool_name}")
            return _jsonrpc_response(msg_id, {
                "content": [{"type": "text", "text": f"Internal error: {e}"}],
                "isError": True,
            })

    # --- 未知方法 ---
    return _jsonrpc_error(msg_id, -32601, f"Method not found: {method}")


# ---------- SSE 事件格式化 ----------

def _sse_event(event: str, data: str) -> str:
    """格式化 SSE 事件"""
    lines = []
    lines.append(f"event: {event}")
    for line in data.split("\n"):
        lines.append(f"data: {line}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


# ---------- 路由 ----------

@router.get("/{project_id}/sse")
async def sse_endpoint(
    project_id: str,
    request: Request,
    api_key: str | None = Query(None, description="API Key (mv_xxx)"),
    authorization: str | None = Header(None),
):
    """
    MCP SSE 连接端点。

    客户端通过此端点建立 SSE 长连接，服务器推送：
      1. endpoint 事件 - 告知客户端 messages 端点 URL
      2. message 事件  - 推送 JSON-RPC 响应
    """
    await _authenticate(project_id, api_key, authorization)

    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    _sessions[session_id] = queue

    logger.info(f"MCP SSE session created: {session_id} for project {project_id}")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # 发送 endpoint 事件，告知客户端向哪里 POST 消息
            messages_url = f"/mcp/{project_id}/messages?session_id={session_id}"
            yield _sse_event("endpoint", messages_url)

            # 持续监听队列，推送 message 事件
            while True:
                # 检测客户端是否断开
                if await request.is_disconnected():
                    logger.info(f"MCP SSE client disconnected: {session_id}")
                    break

                try:
                    # 用超时避免无限阻塞，以便周期性检测断连
                    response_data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield _sse_event("message", json.dumps(response_data, ensure_ascii=False, default=str))
                except asyncio.TimeoutError:
                    # 发送注释作为心跳保活
                    yield ": heartbeat\n\n"
        finally:
            _sessions.pop(session_id, None)
            logger.info(f"MCP SSE session cleaned up: {session_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        },
    )


@router.post("/{project_id}/messages")
async def messages_endpoint(
    project_id: str,
    request: Request,
    session_id: str = Query(..., description="SSE 会话 ID"),
    api_key: str | None = Query(None, description="API Key (mv_xxx)"),
    authorization: str | None = Header(None),
):
    """
    MCP 消息处理端点。

    客户端通过此端点发送 JSON-RPC 消息，服务器处理后将响应推入对应的 SSE 会话队列。
    """
    await _authenticate(project_id, api_key, authorization)

    # 检查会话是否存在
    queue = _sessions.get(session_id)
    if not queue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session not found: {session_id}. Please establish an SSE connection first.",
        )

    # 解析请求体
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body",
        )

    # 处理消息
    response = await _process_message(project_id, body)

    # notification 不需要响应
    if response is not None:
        await queue.put(response)

    # 对 POST 请求返回 202 Accepted
    return {"status": "accepted"}
