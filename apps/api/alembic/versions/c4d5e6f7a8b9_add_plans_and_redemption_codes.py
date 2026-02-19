"""add plans and redemption codes

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-02-15 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 创建 plans 表
    op.create_table(
        'plans',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('price_label', sa.String(50), nullable=True),
        sa.Column('limits', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('features', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_default', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_plans_slug', 'plans', ['slug'], unique=True)

    # 2. 插入默认 plan 种子数据（3 个默认 plan）
    import uuid, json
    plans_data = [
        (str(uuid.uuid4()), 'Hobby Plan', 'free',
         'Includes limited requests and memories to test core memory workflows.',
         'Free',
         json.dumps({"memories": 10000, "requests": 1000, "projects": 1}),
         json.dumps(["Unlimited end users", "10,000 Memories", "1,000 retrieval API calls/month", "1 Project", "Community Support"]),
         0, True, True),
        (str(uuid.uuid4()), 'Pro Plan', 'pro',
         'Full-featured plan for production workloads with advanced capabilities.',
         '$249/month',
         json.dumps({"memories": -1, "requests": 50000, "projects": -1}),
         json.dumps(["Unlimited end users", "Unlimited Memories", "50,000 retrieval API calls/month", "Unlimited Projects", "Graph Memory", "Private Slack Channel", "Advanced Analytics", "Multiple Project Support"]),
         1, False, True),
        (str(uuid.uuid4()), 'Max Plan', 'max',
         'Ultimate plan for large-scale deployments with dedicated support.',
         'Flexible Pricing',
         json.dumps({"memories": -1, "requests": -1, "projects": -1}),
         json.dumps(["Unlimited end users", "Unlimited Memories", "Unlimited API calls/month", "Unlimited Projects", "Private Slack Channel", "Advanced Analytics", "Graph Memory", "On-prem deployment", "Audit Logs", "SSO", "Custom Integrations", "SLA"]),
         2, False, True),
    ]
    for row in plans_data:
        op.execute(
            sa.text(
                "INSERT INTO plans (id, name, slug, description, price_label, limits, features, sort_order, is_default, is_active) "
                "VALUES (:id, :name, :slug, :desc, :price, :limits::json, :features::json, :sort, :is_def, :is_act)"
            ).bindparams(
                id=row[0], name=row[1], slug=row[2], desc=row[3], price=row[4],
                limits=row[5], features=row[6], sort=row[7], is_def=row[8], is_act=row[9],
            )
        )

    # 3. 修改 organizations.plan 列: 从枚举改为 VARCHAR(50)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE organizations ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text")
        op.execute("UPDATE organizations SET plan = LOWER(plan)")
        # 删除旧的枚举类型
        op.execute("DROP TYPE IF EXISTS orgplan")
    else:
        # SQLite 等: plan 已经是 text 存储，只需统一小写
        op.execute("UPDATE organizations SET plan = LOWER(plan)")

    # 4. 新增 organizations 列
    op.add_column('organizations', sa.Column('plan_expires_at', sa.DateTime, nullable=True))
    op.add_column('organizations', sa.Column('plan_activated_at', sa.DateTime, nullable=True))

    # 5. 创建 redemption_codes 表
    op.create_table(
        'redemption_codes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('duration_days', sa.Integer, nullable=False),
        sa.Column('max_uses', sa.Integer, nullable=False, server_default='1'),
        sa.Column('used_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('expires_at', sa.DateTime, nullable=True),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_redemption_codes_code', 'redemption_codes', ['code'], unique=True)

    # 6. 创建 redemption_logs 表
    op.create_table(
        'redemption_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code_id', sa.String(36), sa.ForeignKey('redemption_codes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plan_slug', sa.String(50), nullable=False),
        sa.Column('duration_days', sa.Integer, nullable=False),
        sa.Column('activated_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('redemption_logs')
    op.drop_table('redemption_codes')
    op.drop_column('organizations', 'plan_activated_at')
    op.drop_column('organizations', 'plan_expires_at')

    # 恢复枚举类型
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("CREATE TYPE orgplan AS ENUM ('free', 'pro', 'max')")
        op.execute("ALTER TABLE organizations ALTER COLUMN plan TYPE orgplan USING plan::orgplan")

    op.drop_index('ix_plans_slug', table_name='plans')
    op.drop_table('plans')
