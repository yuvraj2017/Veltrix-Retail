"""backfill operational plan entitlements

Revision ID: 20261001_0010
Revises: 20261001_0009
Create Date: 2026-10-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261001_0010"
down_revision = "20261001_0009"
branch_labels = None
depends_on = None


OPERATIONAL_LIMITS = (
    ("products.max", "Maximum products", "products"),
    ("vendors.max", "Maximum vendors", "vendors"),
    ("orders.monthly.max", "Maximum monthly orders", "orders.monthly"),
)


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not all(
        _has_table(table)
        for table in ("plans", "entitlement_definitions", "plan_entitlements")
    ):
        return

    bind = op.get_bind()

    plans = sa.table(
        "plans",
        sa.column("id", sa.Integer),
    )
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

    plan_ids = [row.id for row in bind.execute(sa.select(plans.c.id)).all()]
    if not plan_ids:
        return

    for key, name, resource_key in OPERATIONAL_LIMITS:
        entitlement_id = bind.execute(
            sa.select(entitlement_definitions.c.id).where(
                entitlement_definitions.c.key == key
            )
        ).scalar()

        if not entitlement_id:
            bind.execute(
                entitlement_definitions.insert().values(
                    key=key,
                    name=name,
                    description=None,
                    kind="limit",
                    value_type="integer",
                    resource_key=resource_key,
                    is_active=True,
                )
            )
            entitlement_id = bind.execute(
                sa.select(entitlement_definitions.c.id).where(
                    entitlement_definitions.c.key == key
                )
            ).scalar_one()

        for plan_id in plan_ids:
            exists = bind.execute(
                sa.select(plan_entitlements.c.plan_id).where(
                    plan_entitlements.c.plan_id == plan_id,
                    plan_entitlements.c.entitlement_id == entitlement_id,
                )
            ).first()
            if exists:
                continue

            bind.execute(
                plan_entitlements.insert().values(
                    plan_id=plan_id,
                    entitlement_id=entitlement_id,
                    limit_value=None,
                    is_unlimited=True,
                    feature_enabled=None,
                )
            )


def downgrade() -> None:
    # Non-destructive: these rows may be edited by admins after upgrade.
    pass
