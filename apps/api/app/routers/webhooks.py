"""Webhook 管理路由"""
import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.webhook import Webhook
from app.services.webhook_service import test_webhook
from app.middleware.audit import log_audit

router = APIRouter(prefix="/webhooks", tags=["Webhook"])


class WebhookCreate(BaseModel):
    url: str
    events: list[str] = ["memory.created", "memory.updated", "memory.deleted"]


class WebhookUpdate(BaseModel):
    url: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    id: str
    url: str
    secret: str | None = None
    events: list[str] | dict
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("")
async def list_webhooks(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Webhook).where(Webhook.project_id == project_id).order_by(Webhook.created_at.desc())
    )
    webhooks = result.scalars().all()
    return [
        {
            "id": wh.id,
            "url": wh.url,
            "events": wh.events,
            "is_active": wh.is_active,
            "created_at": wh.created_at.isoformat() if wh.created_at else None,
        }
        for wh in webhooks
    ]


@router.post("", status_code=201)
async def create_webhook(
    data: WebhookCreate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    secret = secrets.token_hex(32)
    webhook = Webhook(
        id=str(uuid.uuid4()),
        project_id=project_id,
        url=data.url,
        secret=secret,
        events=data.events,
    )
    db.add(webhook)
    await db.flush()
    await log_audit(db, project_id, auth.user_id, "create", "webhook", webhook.id)
    return {
        "id": webhook.id,
        "url": webhook.url,
        "secret": secret,
        "events": webhook.events,
        "is_active": webhook.is_active,
        "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
    }


@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    data: WebhookUpdate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if data.url is not None:
        webhook.url = data.url
    if data.events is not None:
        webhook.events = data.events
    if data.is_active is not None:
        webhook.is_active = data.is_active
    await log_audit(db, project_id, auth.user_id, "update", "webhook", webhook_id)
    return {
        "id": webhook.id,
        "url": webhook.url,
        "events": webhook.events,
        "is_active": webhook.is_active,
        "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
    }


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(webhook)
    await log_audit(db, project_id, auth.user_id, "delete", "webhook", webhook_id)


@router.post("/{webhook_id}/test")
async def test_webhook_endpoint(
    webhook_id: str,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送测试 Webhook"""
    result = await test_webhook(db, webhook_id)
    await log_audit(db, project_id, auth.user_id, "test", "webhook", webhook_id)
    return result
