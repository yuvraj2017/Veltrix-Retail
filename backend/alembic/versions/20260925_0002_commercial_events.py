"""commercial events and payment records

Revision ID: 20260925_0002
Revises: 20260925_0001
Create Date: 2026-09-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260925_0002"
down_revision = "20260925_0001"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    op.create_table(
        "subscription_payments",
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_payment_id", sa.String(length=150), nullable=False),
        sa.Column("provider_event_id", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("billing_interval", sa.String(length=20), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["shop_subscriptions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_payment_id", name="uq_subscription_payments_provider_payment"),
    )
    op.create_index(op.f("ix_subscription_payments_id"), "subscription_payments", ["id"], unique=False)
    op.create_index(op.f("ix_subscription_payments_provider_event_id"), "subscription_payments", ["provider_event_id"], unique=False)
    op.create_index("ix_subscription_payments_provider_event", "subscription_payments", ["provider", "provider_event_id"], unique=False)
    op.create_index(op.f("ix_subscription_payments_shop_id"), "subscription_payments", ["shop_id"], unique=False)
    op.create_index("ix_subscription_payments_shop_status", "subscription_payments", ["shop_id", "status"], unique=False)
    op.create_index(op.f("ix_subscription_payments_status"), "subscription_payments", ["status"], unique=False)
    op.create_index(op.f("ix_subscription_payments_subscription_id"), "subscription_payments", ["subscription_id"], unique=False)

    op.create_table(
        "subscription_events",
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("previous_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("provider_event_id", sa.String(length=150), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["shop_subscriptions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subscription_events_event_type"), "subscription_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_subscription_events_id"), "subscription_events", ["id"], unique=False)
    op.create_index("ix_subscription_events_provider_event", "subscription_events", ["provider", "provider_event_id"], unique=False)
    op.create_index(op.f("ix_subscription_events_shop_id"), "subscription_events", ["shop_id"], unique=False)
    op.create_index("ix_subscription_events_subscription_created", "subscription_events", ["subscription_id", "created_at"], unique=False)
    op.create_index(op.f("ix_subscription_events_subscription_id"), "subscription_events", ["subscription_id"], unique=False)

    op.create_table(
        "license_events",
        sa.Column("license_id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("previous_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["license_id"], ["shop_licenses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_license_events_event_type"), "license_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_license_events_id"), "license_events", ["id"], unique=False)
    op.create_index("ix_license_events_license_created", "license_events", ["license_id", "created_at"], unique=False)
    op.create_index(op.f("ix_license_events_license_id"), "license_events", ["license_id"], unique=False)
    op.create_index(op.f("ix_license_events_shop_id"), "license_events", ["shop_id"], unique=False)

    if _has_table("admin_audit_logs"):
        with op.batch_alter_table("admin_audit_logs") as batch_op:
            if not _has_column("admin_audit_logs", "target_entity_type"):
                batch_op.add_column(sa.Column("target_entity_type", sa.String(length=80), nullable=True))
            if not _has_column("admin_audit_logs", "target_entity_id"):
                batch_op.add_column(sa.Column("target_entity_id", sa.Integer(), nullable=True))
            if _has_column("admin_audit_logs", "previous_value"):
                batch_op.alter_column(
                    "previous_value",
                    existing_type=sa.String(length=50),
                    type_=sa.Text(),
                    existing_nullable=True,
                )
            if _has_column("admin_audit_logs", "new_value"):
                batch_op.alter_column(
                    "new_value",
                    existing_type=sa.String(length=50),
                    type_=sa.Text(),
                    existing_nullable=True,
                )


def downgrade() -> None:
    if _has_table("admin_audit_logs"):
        with op.batch_alter_table("admin_audit_logs") as batch_op:
            if _has_column("admin_audit_logs", "new_value"):
                batch_op.alter_column(
                    "new_value",
                    existing_type=sa.Text(),
                    type_=sa.String(length=50),
                    existing_nullable=True,
                )
            if _has_column("admin_audit_logs", "previous_value"):
                batch_op.alter_column(
                    "previous_value",
                    existing_type=sa.Text(),
                    type_=sa.String(length=50),
                    existing_nullable=True,
                )
            if _has_column("admin_audit_logs", "target_entity_id"):
                batch_op.drop_column("target_entity_id")
            if _has_column("admin_audit_logs", "target_entity_type"):
                batch_op.drop_column("target_entity_type")

    op.drop_index(op.f("ix_license_events_shop_id"), table_name="license_events")
    op.drop_index(op.f("ix_license_events_license_id"), table_name="license_events")
    op.drop_index("ix_license_events_license_created", table_name="license_events")
    op.drop_index(op.f("ix_license_events_id"), table_name="license_events")
    op.drop_index(op.f("ix_license_events_event_type"), table_name="license_events")
    op.drop_table("license_events")

    op.drop_index(op.f("ix_subscription_events_subscription_id"), table_name="subscription_events")
    op.drop_index("ix_subscription_events_subscription_created", table_name="subscription_events")
    op.drop_index(op.f("ix_subscription_events_shop_id"), table_name="subscription_events")
    op.drop_index("ix_subscription_events_provider_event", table_name="subscription_events")
    op.drop_index(op.f("ix_subscription_events_id"), table_name="subscription_events")
    op.drop_index(op.f("ix_subscription_events_event_type"), table_name="subscription_events")
    op.drop_table("subscription_events")

    op.drop_index(op.f("ix_subscription_payments_subscription_id"), table_name="subscription_payments")
    op.drop_index(op.f("ix_subscription_payments_status"), table_name="subscription_payments")
    op.drop_index("ix_subscription_payments_shop_status", table_name="subscription_payments")
    op.drop_index(op.f("ix_subscription_payments_shop_id"), table_name="subscription_payments")
    op.drop_index("ix_subscription_payments_provider_event", table_name="subscription_payments")
    op.drop_index(op.f("ix_subscription_payments_provider_event_id"), table_name="subscription_payments")
    op.drop_index(op.f("ix_subscription_payments_id"), table_name="subscription_payments")
    op.drop_table("subscription_payments")
