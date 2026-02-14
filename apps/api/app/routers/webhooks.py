import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.models.webhook import Webhook

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
    events: list[str] | dict
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Webhook).where(Webhook.project_id == project_id).order_by(Webhook.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    data: WebhookCreate,
    project_id: str = Query(..., description="项目 ID"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    webhook = Webhook(
        id=str(uuid.uuid4()),
        project_id=project_id,
        url=data.url,
        secret=secrets.token_hex(32),
        events=data.events,
    )
    db.add(webhook)
    await db.flush()
    return webhook


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    data: WebhookUpdate,
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
    return webhook


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(webhook)
