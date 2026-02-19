"""add webhook format column

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-02-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("webhooks", sa.Column("format", sa.String(20), server_default="generic", nullable=False))


def downgrade() -> None:
    op.drop_column("webhooks", "format")
