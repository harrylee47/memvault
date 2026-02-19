"""fix user FK cascades for delete

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-02-15 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # projects.created_by: nullable + SET NULL on delete
    op.alter_column("projects", "created_by", nullable=True)
    op.drop_constraint("projects_created_by_fkey", "projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_created_by_fkey", "projects", "users",
        ["created_by"], ["id"], ondelete="SET NULL",
    )

    # api_keys.created_by: nullable + SET NULL on delete
    op.alter_column("api_keys", "created_by", nullable=True)
    op.drop_constraint("api_keys_created_by_fkey", "api_keys", type_="foreignkey")
    op.create_foreign_key(
        "api_keys_created_by_fkey", "api_keys", "users",
        ["created_by"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    # Revert api_keys
    op.drop_constraint("api_keys_created_by_fkey", "api_keys", type_="foreignkey")
    op.create_foreign_key(
        "api_keys_created_by_fkey", "api_keys", "users",
        ["created_by"], ["id"],
    )
    op.alter_column("api_keys", "created_by", nullable=False)

    # Revert projects
    op.drop_constraint("projects_created_by_fkey", "projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_created_by_fkey", "projects", "users",
        ["created_by"], ["id"],
    )
    op.alter_column("projects", "created_by", nullable=False)
