"""add is_admin, request_logs, starter plan

Revision ID: a2b3c4d5e6f7
Revises: 9071668a3521
Create Date: 2026-02-15 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '9071668a3521'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users 表添加 is_admin 列
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 2. 创建 request_logs 表
    op.create_table('request_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False, server_default='200'),
        sa.Column('has_results', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('agent_id', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('request_body', sa.JSON(), nullable=True),
        sa.Column('response_summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_request_logs_project_id'), 'request_logs', ['project_id'], unique=False)
    op.create_index(op.f('ix_request_logs_created_at'), 'request_logs', ['created_at'], unique=False)

    # 3. 扩展 orgplan enum 添加 STARTER
    # 对于 SQLite，enum 是普通字符串无需修改
    # 对于 PostgreSQL，需要 ALTER TYPE
    # 使用条件判断以兼容两种数据库
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE orgplan ADD VALUE IF NOT EXISTS 'STARTER'")


def downgrade() -> None:
    op.drop_index(op.f('ix_request_logs_created_at'), table_name='request_logs')
    op.drop_index(op.f('ix_request_logs_project_id'), table_name='request_logs')
    op.drop_table('request_logs')
    op.drop_column('users', 'is_admin')
