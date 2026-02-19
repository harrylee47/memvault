"""add system_settings table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-02-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(100), primary_key=True),
        sa.Column('value', sa.Text, nullable=False, server_default=''),
    )

    # 插入默认值：注册开关默认开启
    op.execute(
        sa.text(
            "INSERT INTO system_settings (key, value) VALUES (:key, :value)"
        ).bindparams(key='registration_enabled', value='true')
    )


def downgrade() -> None:
    op.drop_table('system_settings')
