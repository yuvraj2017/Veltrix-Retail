"""UPI gateway settings and payment review workflow

Revision ID: 20260925_0004
Revises: 20260925_0003
Create Date: 2026-09-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260925_0004"
down_revision = "20260925_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payment_gateway_configs") as batch_op:
        batch_op.alter_column(
            "key_id",
            existing_type=sa.String(length=150),
            nullable=True,
        )
        batch_op.alter_column(
            "key_secret_encrypted",
            existing_type=sa.Text(),
            nullable=True,
        )
        batch_op.add_column(sa.Column("settings_encrypted", sa.Text(), nullable=True))

    with op.batch_alter_table("subscription_payments") as batch_op:
        batch_op.add_column(sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("customer_reference", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_subscription_payments_reviewed_by_user_id_users",
            "users",
            ["reviewed_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_subscription_payments_customer_reference",
            ["customer_reference"],
        )
        batch_op.create_index(
            "ix_subscription_payments_reviewed_by_user_id",
            ["reviewed_by_user_id"],
        )
        batch_op.create_unique_constraint(
            "uq_subscription_payments_provider_customer_reference",
            ["provider", "customer_reference"],
        )


def downgrade() -> None:
    with op.batch_alter_table("subscription_payments") as batch_op:
        batch_op.drop_constraint(
            "uq_subscription_payments_provider_customer_reference",
            type_="unique",
        )
        batch_op.drop_index("ix_subscription_payments_reviewed_by_user_id")
        batch_op.drop_index("ix_subscription_payments_customer_reference")
        batch_op.drop_constraint(
            "fk_subscription_payments_reviewed_by_user_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("reviewed_by_user_id")
        batch_op.drop_column("customer_reference")
        batch_op.drop_column("reviewed_at")
        batch_op.drop_column("submitted_at")

    with op.batch_alter_table("payment_gateway_configs") as batch_op:
        batch_op.drop_column("settings_encrypted")
        batch_op.alter_column(
            "key_secret_encrypted",
            existing_type=sa.Text(),
            nullable=False,
        )
        batch_op.alter_column(
            "key_id",
            existing_type=sa.String(length=150),
            nullable=False,
        )
