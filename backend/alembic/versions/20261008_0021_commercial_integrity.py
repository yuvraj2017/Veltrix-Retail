"""commercial lifecycle integrity

Revision ID: 20261008_0021
Revises: 20261007_0020
Create Date: 2026-10-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261008_0021"
down_revision = "20261007_0020"
branch_labels = None
depends_on = None


SUBSCRIPTION_STATUS_CHECK = "ck_shop_subscriptions_status"
SUBSCRIPTION_INTERVAL_CHECK = "ck_shop_subscriptions_billing_interval"
LICENSE_STATUS_CHECK = "ck_shop_licenses_status"
PAYMENT_STATUS_CHECK = "ck_subscription_payments_status"
PAYMENT_INTERVAL_CHECK = "ck_subscription_payments_billing_interval"
PAYMENT_ORDER_UNIQUE = "uq_subscription_payments_provider_order"
PAYMENT_EVENT_UNIQUE = "uq_subscription_payments_provider_event"


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(name: str) -> bool:
    return name in _inspector().get_table_names()


def _has_check(table: str, name: str) -> bool:
    return any(row.get("name") == name for row in _inspector().get_check_constraints(table))


def _has_unique(table: str, name: str) -> bool:
    return any(row.get("name") == name for row in _inspector().get_unique_constraints(table))


def _validate_existing_rows() -> None:
    bind = op.get_bind()
    checks = (
        (
            "shop_subscriptions",
            "status NOT IN ('pending', 'active', 'past_due', 'grace_period', "
            "'suspended', 'expired', 'cancelled')",
            "unsupported subscription status",
        ),
        (
            "shop_subscriptions",
            "billing_interval NOT IN ('monthly', 'annual', 'legacy')",
            "unsupported subscription billing interval",
        ),
        (
            "shop_licenses",
            "status NOT IN ('pending', 'active', 'suspended', 'expired', 'revoked')",
            "unsupported license status",
        ),
        (
            "subscription_payments",
            "status NOT IN ('pending', 'submitted', 'succeeded', 'failed', 'refunded')",
            "unsupported subscription payment status",
        ),
        (
            "subscription_payments",
            "billing_interval IS NOT NULL AND billing_interval NOT IN ('monthly', 'annual', 'legacy')",
            "unsupported payment billing interval",
        ),
    )
    for table, predicate, message in checks:
        row = bind.execute(sa.text(f"SELECT id FROM {table} WHERE {predicate} LIMIT 1")).first()
        if row:
            raise RuntimeError(f"{message}: row {row.id}")

    duplicates = (
        ("provider_order_id", "duplicate provider order id"),
        ("provider_event_id", "duplicate provider event id"),
    )
    for column, message in duplicates:
        row = bind.execute(
            sa.text(
                f"""
                SELECT provider, {column}
                FROM subscription_payments
                WHERE {column} IS NOT NULL
                GROUP BY provider, {column}
                HAVING COUNT(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if row:
            raise RuntimeError(f"{message}: provider={row.provider!r}")


def _create_webhook_events() -> None:
    if _has_table("payment_webhook_events"):
        return
    op.create_table(
        "payment_webhook_events",
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_event_id", sa.String(length=150), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="processing", nullable=False),
        sa.Column("payment_id", sa.Integer(), nullable=True),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('processing', 'applied', 'duplicate')",
            name="ck_payment_webhook_events_status",
        ),
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["subscription_payments.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "provider_event_id",
            name="uq_payment_webhook_events_provider_event",
        ),
    )
    op.create_index("ix_payment_webhook_events_id", "payment_webhook_events", ["id"])
    op.create_index(
        "ix_payment_webhook_events_payment_id",
        "payment_webhook_events",
        ["payment_id"],
    )
    op.create_index(
        "ix_payment_webhook_events_provider_created",
        "payment_webhook_events",
        ["provider", "created_at"],
    )


def _add_constraints() -> None:
    subscription_checks = (
        (
            SUBSCRIPTION_STATUS_CHECK,
            "status IN ('pending', 'active', 'past_due', 'grace_period', "
            "'suspended', 'expired', 'cancelled')",
        ),
        (
            SUBSCRIPTION_INTERVAL_CHECK,
            "billing_interval IN ('monthly', 'annual', 'legacy')",
        ),
    )
    license_checks = (
        (
            LICENSE_STATUS_CHECK,
            "status IN ('pending', 'active', 'suspended', 'expired', 'revoked')",
        ),
    )
    payment_checks = (
        (
            PAYMENT_STATUS_CHECK,
            "status IN ('pending', 'submitted', 'succeeded', 'failed', 'refunded')",
        ),
        (
            PAYMENT_INTERVAL_CHECK,
            "billing_interval IS NULL OR billing_interval IN ('monthly', 'annual', 'legacy')",
        ),
    )

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("shop_subscriptions") as batch:
            for name, expression in subscription_checks:
                if not _has_check("shop_subscriptions", name):
                    batch.create_check_constraint(name, expression)
        with op.batch_alter_table("shop_licenses") as batch:
            for name, expression in license_checks:
                if not _has_check("shop_licenses", name):
                    batch.create_check_constraint(name, expression)
        with op.batch_alter_table("subscription_payments") as batch:
            for name, expression in payment_checks:
                if not _has_check("subscription_payments", name):
                    batch.create_check_constraint(name, expression)
            if not _has_unique("subscription_payments", PAYMENT_ORDER_UNIQUE):
                batch.create_unique_constraint(
                    PAYMENT_ORDER_UNIQUE,
                    ["provider", "provider_order_id"],
                )
            if not _has_unique("subscription_payments", PAYMENT_EVENT_UNIQUE):
                batch.create_unique_constraint(
                    PAYMENT_EVENT_UNIQUE,
                    ["provider", "provider_event_id"],
                )
        return

    for name, expression in subscription_checks:
        if not _has_check("shop_subscriptions", name):
            op.create_check_constraint(name, "shop_subscriptions", expression)
    for name, expression in license_checks:
        if not _has_check("shop_licenses", name):
            op.create_check_constraint(name, "shop_licenses", expression)
    for name, expression in payment_checks:
        if not _has_check("subscription_payments", name):
            op.create_check_constraint(name, "subscription_payments", expression)
    if not _has_unique("subscription_payments", PAYMENT_ORDER_UNIQUE):
        op.create_unique_constraint(
            PAYMENT_ORDER_UNIQUE,
            "subscription_payments",
            ["provider", "provider_order_id"],
        )
    if not _has_unique("subscription_payments", PAYMENT_EVENT_UNIQUE):
        op.create_unique_constraint(
            PAYMENT_EVENT_UNIQUE,
            "subscription_payments",
            ["provider", "provider_event_id"],
        )


def upgrade() -> None:
    _validate_existing_rows()
    _create_webhook_events()
    _add_constraints()


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("subscription_payments") as batch:
            if _has_unique("subscription_payments", PAYMENT_EVENT_UNIQUE):
                batch.drop_constraint(PAYMENT_EVENT_UNIQUE, type_="unique")
            if _has_unique("subscription_payments", PAYMENT_ORDER_UNIQUE):
                batch.drop_constraint(PAYMENT_ORDER_UNIQUE, type_="unique")
            for name in (PAYMENT_INTERVAL_CHECK, PAYMENT_STATUS_CHECK):
                if _has_check("subscription_payments", name):
                    batch.drop_constraint(name, type_="check")
        with op.batch_alter_table("shop_licenses") as batch:
            if _has_check("shop_licenses", LICENSE_STATUS_CHECK):
                batch.drop_constraint(LICENSE_STATUS_CHECK, type_="check")
        with op.batch_alter_table("shop_subscriptions") as batch:
            for name in (SUBSCRIPTION_INTERVAL_CHECK, SUBSCRIPTION_STATUS_CHECK):
                if _has_check("shop_subscriptions", name):
                    batch.drop_constraint(name, type_="check")
    else:
        for name in (PAYMENT_EVENT_UNIQUE, PAYMENT_ORDER_UNIQUE):
            if _has_unique("subscription_payments", name):
                op.drop_constraint(name, "subscription_payments", type_="unique")
        for name in (PAYMENT_INTERVAL_CHECK, PAYMENT_STATUS_CHECK):
            if _has_check("subscription_payments", name):
                op.drop_constraint(name, "subscription_payments", type_="check")
        if _has_check("shop_licenses", LICENSE_STATUS_CHECK):
            op.drop_constraint(LICENSE_STATUS_CHECK, "shop_licenses", type_="check")
        for name in (SUBSCRIPTION_INTERVAL_CHECK, SUBSCRIPTION_STATUS_CHECK):
            if _has_check("shop_subscriptions", name):
                op.drop_constraint(name, "shop_subscriptions", type_="check")

    if _has_table("payment_webhook_events"):
        op.drop_table("payment_webhook_events")
