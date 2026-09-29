"""business audit foundation

Revision ID: 20260927_0008
Revises: 20260927_0007
Create Date: 2026-09-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260927_0008"
down_revision = "20260927_0007"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table("business_audit_logs"):
        return

    op.create_table(
        "business_audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_email", sa.String(length=150), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("before_data", sa.JSON(), nullable=True),
        sa.Column("after_data", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_business_audit_logs_id"), "business_audit_logs", ["id"], unique=False)
    op.create_index(
        op.f("ix_business_audit_logs_shop_id"),
        "business_audit_logs",
        ["shop_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_business_audit_logs_actor_user_id"),
        "business_audit_logs",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_business_audit_logs_action"),
        "business_audit_logs",
        ["action"],
        unique=False,
    )
    op.create_index(
        op.f("ix_business_audit_logs_entity_type"),
        "business_audit_logs",
        ["entity_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_business_audit_logs_entity_id"),
        "business_audit_logs",
        ["entity_id"],
        unique=False,
    )
    op.create_index(
        "ix_business_audit_logs_shop_created",
        "business_audit_logs",
        ["shop_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_business_audit_logs_shop_entity",
        "business_audit_logs",
        ["shop_id", "entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        "ix_business_audit_logs_shop_action_created",
        "business_audit_logs",
        ["shop_id", "action", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    # Keep the business audit trail non-destructive once created.
    pass
