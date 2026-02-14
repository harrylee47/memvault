"""Webhook 事件分发服务"""
import hmac
import hashlib
import json
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.models.webhook import Webhook

logger = logging.getLogger(__name__)


def _sign_payload(payload: str, secret: str) -> str:
    """使用 HMAC-SHA256 签名"""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


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

        payload = json.dumps({
            "event": event,
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": project_id,
            "data": data,
        })

        signature = _sign_payload(payload, wh.secret)
        headers = {
            "Content-Type": "application/json",
            "X-MemVault-Signature": f"sha256={signature}",
            "X-MemVault-Event": event,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(wh.url, content=payload, headers=headers)
                logger.info(f"Webhook {wh.id} delivered: {response.status_code}")
        except Exception as e:
            logger.warning(f"Webhook {wh.id} delivery failed: {e}")


async def test_webhook(db: AsyncSession, webhook_id: str) -> dict:
    """发送测试 webhook"""
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        return {"success": False, "error": "Webhook not found"}

    payload = json.dumps({
        "event": "test",
        "timestamp": datetime.utcnow().isoformat(),
        "project_id": wh.project_id,
        "data": {"message": "This is a test webhook from MemVault"},
    })

    signature = _sign_payload(payload, wh.secret)
    headers = {
        "Content-Type": "application/json",
        "X-MemVault-Signature": f"sha256={signature}",
        "X-MemVault-Event": "test",
    }

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
