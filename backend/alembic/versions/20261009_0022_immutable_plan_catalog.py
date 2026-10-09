"""immutable plan catalog and pricing versions

Revision ID: 20261009_0022
Revises: 20261008_0021
Create Date: 2026-10-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261009_0022"
down_revision = "20261008_0021"
branch_labels = None
depends_on = None


def _validate_legacy_catalog() -> None:
    bind = op.get_bind()
    invalid_plan = bind.execute(
        sa.text(
            """
            SELECT id FROM plans
            WHERE monthly_price < 0 OR annual_price < 0
               OR trial_days < 0 OR grace_period_days < 0
               OR currency IS NULL OR LENGTH(currency) <> 3
            LIMIT 1
            """
        )
    ).first()
    if invalid_plan:
        raise RuntimeError(f"Plan {invalid_plan.id} cannot be catalog-versioned")

    orphan_subscription = bind.execute(
        sa.text(
            """
            SELECT s.id FROM shop_subscriptions s
            LEFT JOIN plans p ON p.id = s.plan_id
            WHERE p.id IS NULL
            LIMIT 1
            """
        )
    ).first()
    if orphan_subscription:
        raise RuntimeError(
            f"Subscription {orphan_subscription.id} has no valid plan"
        )


def _create_catalog_tables() -> None:
    op.create_table(
        "plan_catalog_versions",
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("monthly_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("annual_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("trial_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("grace_period_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by_user_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published')",
            name="ck_plan_catalog_versions_status",
        ),
        sa.CheckConstraint(
            "monthly_price >= 0 AND annual_price >= 0",
            name="ck_plan_catalog_versions_prices_non_negative",
        ),
        sa.CheckConstraint(
            "trial_days >= 0 AND grace_period_days >= 0",
            name="ck_plan_catalog_versions_terms_non_negative",
        ),
        sa.CheckConstraint(
            "(status = 'published' AND published_at IS NOT NULL) OR "
            "(status = 'draft' AND published_at IS NULL)",
            name="ck_plan_catalog_versions_publication_state",
        ),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "plan_id",
            "version_number",
            name="uq_plan_catalog_versions_plan_version",
        ),
        sa.UniqueConstraint(
            "id",
            "plan_id",
            name="uq_plan_catalog_versions_id_plan",
        ),
    )
    op.create_index("ix_plan_catalog_versions_id", "plan_catalog_versions", ["id"])
    op.create_index(
        "ix_plan_catalog_versions_published_by_user_id",
        "plan_catalog_versions",
        ["published_by_user_id"],
    )
    op.create_index(
        "ix_plan_catalog_versions_plan_status_version",
        "plan_catalog_versions",
        ["plan_id", "status", "version_number"],
    )

    op.create_table(
        "plan_catalog_entitlement_snapshots",
        sa.Column("catalog_version_id", sa.Integer(), nullable=False),
        sa.Column("entitlement_id", sa.Integer(), nullable=False),
        sa.Column("entitlement_key", sa.String(length=120), nullable=False),
        sa.Column("entitlement_name", sa.String(length=150), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("resource_key", sa.String(length=100), nullable=True),
        sa.Column("limit_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("is_unlimited", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("feature_enabled", sa.Boolean(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('limit', 'feature')",
            name="ck_plan_catalog_snapshot_kind",
        ),
        sa.CheckConstraint(
            "value_type IN ('integer', 'decimal', 'boolean', 'string')",
            name="ck_plan_catalog_snapshot_value_type",
        ),
        sa.CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_plan_catalog_snapshot_limit_non_negative",
        ),
        sa.CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_plan_catalog_snapshot_unlimited_has_no_limit",
        ),
        sa.ForeignKeyConstraint(
            ["catalog_version_id"],
            ["plan_catalog_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["entitlement_id"],
            ["entitlement_definitions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "catalog_version_id",
            "entitlement_id",
            name="uq_plan_catalog_snapshot_version_entitlement",
        ),
    )
    op.create_index(
        "ix_plan_catalog_entitlement_snapshots_id",
        "plan_catalog_entitlement_snapshots",
        ["id"],
    )
    op.create_index(
        "ix_plan_catalog_entitlement_snapshots_entitlement_id",
        "plan_catalog_entitlement_snapshots",
        ["entitlement_id"],
    )
    op.create_index(
        "ix_plan_catalog_snapshot_version_key",
        "plan_catalog_entitlement_snapshots",
        ["catalog_version_id", "entitlement_key"],
    )


def _add_bindings() -> None:
    op.add_column(
        "shop_subscriptions",
        sa.Column("catalog_version_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_shop_subscriptions_catalog_version_plan",
        "shop_subscriptions",
        "plan_catalog_versions",
        ["catalog_version_id", "plan_id"],
        ["id", "plan_id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_shop_subscriptions_catalog_version_id",
        "shop_subscriptions",
        ["catalog_version_id"],
    )

    op.add_column(
        "subscription_payments",
        sa.Column("catalog_version_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_subscription_payments_catalog_version_plan",
        "subscription_payments",
        "plan_catalog_versions",
        ["catalog_version_id", "plan_id"],
        ["id", "plan_id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_subscription_payments_catalog_version_has_plan",
        "subscription_payments",
        "catalog_version_id IS NULL OR plan_id IS NOT NULL",
    )
    op.create_index(
        "ix_subscription_payments_catalog_version_id",
        "subscription_payments",
        ["catalog_version_id"],
    )


def _backfill_catalog() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO plan_catalog_versions (
                plan_id, version_number, status, monthly_price, annual_price,
                currency, trial_days, grace_period_days, published_at,
                published_by_user_id, created_at, updated_at
            )
            SELECT id, 1, 'published', monthly_price, annual_price,
                   UPPER(currency), trial_days, grace_period_days,
                   COALESCE(updated_at, created_at, CURRENT_TIMESTAMP), NULL,
                   COALESCE(created_at, CURRENT_TIMESTAMP),
                   COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
            FROM plans
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO plan_catalog_entitlement_snapshots (
                catalog_version_id, entitlement_id, entitlement_key,
                entitlement_name, kind, value_type, resource_key,
                limit_value, is_unlimited, feature_enabled, created_at, updated_at
            )
            SELECT v.id, pe.entitlement_id, d.key, d.name, d.kind,
                   d.value_type, d.resource_key, pe.limit_value,
                   pe.is_unlimited, pe.feature_enabled,
                   COALESCE(pe.created_at, CURRENT_TIMESTAMP),
                   COALESCE(pe.updated_at, pe.created_at, CURRENT_TIMESTAMP)
            FROM plan_entitlements pe
            JOIN entitlement_definitions d ON d.id = pe.entitlement_id
            JOIN plan_catalog_versions v
              ON v.plan_id = pe.plan_id AND v.version_number = 1
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE shop_subscriptions
            SET catalog_version_id = (
                SELECT v.id FROM plan_catalog_versions v
                WHERE v.plan_id = shop_subscriptions.plan_id
                  AND v.version_number = 1
            )
            """
        )
    )
    missing = bind.execute(
        sa.text(
            "SELECT id FROM shop_subscriptions "
            "WHERE catalog_version_id IS NULL LIMIT 1"
        )
    ).first()
    if missing:
        raise RuntimeError(
            f"Subscription {missing.id} could not be bound to a catalog version"
        )
    op.alter_column(
        "shop_subscriptions",
        "catalog_version_id",
        existing_type=sa.Integer(),
        nullable=False,
    )


def _create_immutability_triggers() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_published_catalog_mutation()
        RETURNS trigger AS $$
        BEGIN
            IF OLD.status = 'published' THEN
                RAISE EXCEPTION 'published catalog versions are immutable';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_plan_catalog_versions_immutable
        BEFORE UPDATE OR DELETE ON plan_catalog_versions
        FOR EACH ROW EXECUTE FUNCTION prevent_published_catalog_mutation()
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_published_catalog_snapshot_mutation()
        RETURNS trigger AS $$
        DECLARE parent_status text;
        DECLARE parent_id integer;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                parent_id := OLD.catalog_version_id;
            ELSE
                parent_id := NEW.catalog_version_id;
            END IF;
            SELECT status INTO parent_status
            FROM plan_catalog_versions
            WHERE id = parent_id;
            IF parent_status = 'published' THEN
                RAISE EXCEPTION 'published catalog entitlement snapshots are immutable';
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_plan_catalog_snapshots_immutable
        BEFORE INSERT OR UPDATE OR DELETE ON plan_catalog_entitlement_snapshots
        FOR EACH ROW EXECUTE FUNCTION prevent_published_catalog_snapshot_mutation()
        """
    )


def upgrade() -> None:
    _validate_legacy_catalog()
    _create_catalog_tables()
    _add_bindings()
    _backfill_catalog()
    _create_immutability_triggers()


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "DROP TRIGGER IF EXISTS trg_plan_catalog_snapshots_immutable "
            "ON plan_catalog_entitlement_snapshots"
        )
        op.execute("DROP FUNCTION IF EXISTS prevent_published_catalog_snapshot_mutation()")
        op.execute(
            "DROP TRIGGER IF EXISTS trg_plan_catalog_versions_immutable "
            "ON plan_catalog_versions"
        )
        op.execute("DROP FUNCTION IF EXISTS prevent_published_catalog_mutation()")

    op.drop_index(
        "ix_subscription_payments_catalog_version_id",
        table_name="subscription_payments",
    )
    op.drop_constraint(
        "ck_subscription_payments_catalog_version_has_plan",
        "subscription_payments",
        type_="check",
    )
    op.drop_constraint(
        "fk_subscription_payments_catalog_version_plan",
        "subscription_payments",
        type_="foreignkey",
    )
    op.drop_column("subscription_payments", "catalog_version_id")

    op.drop_index(
        "ix_shop_subscriptions_catalog_version_id",
        table_name="shop_subscriptions",
    )
    op.drop_constraint(
        "fk_shop_subscriptions_catalog_version_plan",
        "shop_subscriptions",
        type_="foreignkey",
    )
    op.drop_column("shop_subscriptions", "catalog_version_id")

    op.drop_table("plan_catalog_entitlement_snapshots")
    op.drop_table("plan_catalog_versions")
