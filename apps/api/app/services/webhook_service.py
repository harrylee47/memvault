"""Webhook 事件分发服务"""
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.models.webhook import Webhook

logger = logging.getLogger(__name__)


def _sign_payload(payload: str, secret: str) -> str:
    """使用 HMAC-SHA256 签名"""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _format_event_text(event: str, data: dict, project_id: str) -> str:
    """将事件转换为人类可读的消息文本"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    memory = data.get("memory") or data.get("content") or data.get("message", "")
    memory_id = data.get("id") or data.get("memory_id", "")

    if event == "memory.created":
        return f"🧠 新记忆创建\n内容: {memory}\nID: {memory_id}\n项目: {project_id}\n时间: {now}"
    elif event == "memory.updated":
        return f"✏️ 记忆更新\n内容: {memory}\nID: {memory_id}\n项目: {project_id}\n时间: {now}"
    elif event == "memory.deleted":
        return f"🗑️ 记忆删除\nID: {memory_id}\n项目: {project_id}\n时间: {now}"
    elif event == "test":
        return f"✅ MemVault Webhook 测试成功\n项目: {project_id}\n时间: {now}"
    else:
        return f"📌 {event}\n{json.dumps(data, ensure_ascii=False)}\n项目: {project_id}\n时间: {now}"


def _build_payload(wh_format: str, event: str, data: dict, project_id: str) -> str:
    """根据 webhook format 构建对应平台的 payload"""
    if wh_format == "wecom":
        text = _format_event_text(event, data, project_id)
        return json.dumps({"msgtype": "text", "text": {"content": text}}, ensure_ascii=False)

    elif wh_format == "dingtalk":
        text = _format_event_text(event, data, project_id)
        return json.dumps({"msgtype": "text", "text": {"content": text}}, ensure_ascii=False)

    elif wh_format == "feishu":
        text = _format_event_text(event, data, project_id)
        return json.dumps({"msg_type": "text", "content": {"text": text}}, ensure_ascii=False)

    elif wh_format == "slack":
        text = _format_event_text(event, data, project_id)
        return json.dumps({"text": text}, ensure_ascii=False)

    else:  # generic
        return json.dumps({
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "project_id": project_id,
            "data": data,
        }, ensure_ascii=False, default=str)


async def dispatch_webhook_event(
    db: AsyncSession,
    project_id: str,
    event: str,
    data: dict,
):
    """分发 webhook 事件到所有匹配的 webhook"""
    result = await db.execute(
        select(Webhook).where(
            Webhook.project_id == project_id,
            Webhook.is_active == True,
        )
    )
    webhooks = result.scalars().all()

    for wh in webhooks:
        events = wh.events if isinstance(wh.events, list) else []
        if event not in events and "*" not in events:
            continue

        wh_format = wh.format or "generic"
        payload = _build_payload(wh_format, event, data, project_id)

        headers = {"Content-Type": "application/json"}
        if wh_format == "generic":
            signature = _sign_payload(payload, wh.secret)
            headers["X-MemVault-Signature"] = f"sha256={signature}"
            headers["X-MemVault-Event"] = event

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(wh.url, content=payload, headers=headers)
                logger.info(f"Webhook {wh.id} [{wh_format}] delivered: {response.status_code} {response.text[:200]}")
        except Exception as e:
            logger.warning(f"Webhook {wh.id} delivery failed: {e}")


async def test_webhook(db: AsyncSession, webhook_id: str) -> dict:
    """发送测试 webhook"""
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        return {"success": False, "error": "Webhook not found"}

    wh_format = wh.format or "generic"
    test_data = {"message": "This is a test webhook from MemVault"}
    payload = _build_payload(wh_format, "test", test_data, wh.project_id)

    headers = {"Content-Type": "application/json"}
    if wh_format == "generic":
        signature = _sign_payload(payload, wh.secret)
        headers["X-MemVault-Signature"] = f"sha256={signature}"
        headers["X-MemVault-Event"] = "test"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(wh.url, content=payload, headers=headers)
            return {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "response_body": response.text[:500],
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
