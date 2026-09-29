"""payment gateway config and complete entitlement catalog

Revision ID: 20260925_0003
Revises: 20260925_0002
Create Date: 2026-09-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260925_0003"
down_revision = "20260925_0002"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names() and column_name in {
        column["name"] for column in inspector.get_columns(table_name)
    }


def upgrade() -> None:
    with op.batch_alter_table("subscription_payments") as batch_op:
        if not _has_column("subscription_payments", "plan_id"):
            batch_op.add_column(sa.Column("plan_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_subscription_payments_plan_id_plans",
                "plans",
                ["plan_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch_op.create_index("ix_subscription_payments_plan_id", ["plan_id"])
        if not _has_column("subscription_payments", "provider_order_id"):
            batch_op.add_column(sa.Column("provider_order_id", sa.String(length=150), nullable=True))
            batch_op.create_index("ix_subscription_payments_provider_order_id", ["provider_order_id"])

    op.create_table(
        "payment_gateway_configs",
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_test_mode", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("key_id", sa.String(length=150), nullable=False),
        sa.Column("key_secret_encrypted", sa.Text(), nullable=False),
        sa.Column("webhook_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", name="uq_payment_gateway_configs_provider"),
    )
    op.create_index(op.f("ix_payment_gateway_configs_created_by_user_id"), "payment_gateway_configs", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_payment_gateway_configs_id"), "payment_gateway_configs", ["id"], unique=False)
    op.create_index(op.f("ix_payment_gateway_configs_is_active"), "payment_gateway_configs", ["is_active"], unique=False)
    op.create_index("ix_payment_gateway_configs_provider_active", "payment_gateway_configs", ["provider", "is_active"], unique=False)

    _seed_missing_entitlements()


def _seed_missing_entitlements() -> None:
    bind = op.get_bind()
    plans = sa.table("plans", sa.column("id", sa.Integer), sa.column("code", sa.String))
    entitlement_definitions = sa.table(
        "entitlement_definitions",
        sa.column("id", sa.Integer),
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("kind", sa.String),
        sa.column("value_type", sa.String),
        sa.column("resource_key", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    plan_entitlements = sa.table(
        "plan_entitlements",
        sa.column("plan_id", sa.Integer),
        sa.column("entitlement_id", sa.Integer),
        sa.column("limit_value", sa.Numeric),
        sa.column("is_unlimited", sa.Boolean),
        sa.column("feature_enabled", sa.Boolean),
    )

    definitions = (
        ("staff.max", "Maximum staff/users", "limit", "integer", "staff"),
        ("locations.max", "Maximum locations", "limit", "integer", "locations"),
        ("storage.max", "Storage limit", "limit", "decimal", "storage"),
    )

    legacy_plan_id = bind.execute(
        sa.select(plans.c.id).where(plans.c.code == "legacy")
    ).scalar()

    for key, name, kind, value_type, resource_key in definitions:
        existing_id = bind.execute(
            sa.select(entitlement_definitions.c.id).where(entitlement_definitions.c.key == key)
        ).scalar()
        if existing_id:
            entitlement_id = existing_id
        else:
            bind.execute(
                entitlement_definitions.insert().values(
                    key=key,
                    name=name,
                    description=None,
                    kind=kind,
                    value_type=value_type,
                    resource_key=resource_key,
                    is_active=True,
                )
            )
            entitlement_id = bind.execute(
                sa.select(entitlement_definitions.c.id).where(entitlement_definitions.c.key == key)
            ).scalar_one()

        if legacy_plan_id:
            exists = bind.execute(
                sa.select(plan_entitlements.c.plan_id).where(
                    plan_entitlements.c.plan_id == legacy_plan_id,
                    plan_entitlements.c.entitlement_id == entitlement_id,
                )
            ).first()
            if not exists:
                bind.execute(
                    plan_entitlements.insert().values(
                        plan_id=legacy_plan_id,
                        entitlement_id=entitlement_id,
                        limit_value=None,
                        is_unlimited=True,
                        feature_enabled=None,
                    )
                )


def downgrade() -> None:
    op.drop_index("ix_payment_gateway_configs_provider_active", table_name="payment_gateway_configs")
    op.drop_index(op.f("ix_payment_gateway_configs_is_active"), table_name="payment_gateway_configs")
    op.drop_index(op.f("ix_payment_gateway_configs_id"), table_name="payment_gateway_configs")
    op.drop_index(op.f("ix_payment_gateway_configs_created_by_user_id"), table_name="payment_gateway_configs")
    op.drop_table("payment_gateway_configs")

    with op.batch_alter_table("subscription_payments") as batch_op:
        if _has_column("subscription_payments", "provider_order_id"):
            batch_op.drop_index("ix_subscription_payments_provider_order_id")
            batch_op.drop_column("provider_order_id")
        if _has_column("subscription_payments", "plan_id"):
            batch_op.drop_index("ix_subscription_payments_plan_id")
            batch_op.drop_constraint("fk_subscription_payments_plan_id_plans", type_="foreignkey")
            batch_op.drop_column("plan_id")
