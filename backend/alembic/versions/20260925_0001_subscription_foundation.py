"""subscription foundation

Revision ID: 20260925_0001
Revises:
Create Date: 2026-09-25
"""

from __future__ import annotations

import hashlib
import secrets
import string
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260925_0001"
down_revision = "20260925_0000"
branch_labels = None
depends_on = None


LICENSE_PREFIX = "PRPL"
LICENSE_ALPHABET = string.ascii_uppercase + string.digits


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_license_key() -> str:
    random_part = "".join(secrets.choice(LICENSE_ALPHABET) for _ in range(32))
    grouped = "-".join(
        random_part[index : index + 4] for index in range(0, len(random_part), 4)
    )
    return f"{LICENSE_PREFIX}-{grouped}"


def _hash_license_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _mask_license_key(raw_key: str) -> str:
    return f"{raw_key[:len(LICENSE_PREFIX)]}-****-****-****-****-{raw_key[-4:]}"


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("monthly_price", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("annual_price", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="INR", nullable=False),
        sa.Column("trial_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("grace_period_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_plans_code"), "plans", ["code"], unique=True)
    op.create_index(op.f("ix_plans_id"), "plans", ["id"], unique=False)
    op.create_index(op.f("ix_plans_is_active"), "plans", ["is_active"], unique=False)
    op.create_index(op.f("ix_plans_is_archived"), "plans", ["is_archived"], unique=False)

    op.create_table(
        "entitlement_definitions",
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("resource_key", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index(
        op.f("ix_entitlement_definitions_id"),
        "entitlement_definitions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_entitlement_definitions_is_active"),
        "entitlement_definitions",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_entitlement_definitions_key"),
        "entitlement_definitions",
        ["key"],
        unique=True,
    )
    op.create_index(
        op.f("ix_entitlement_definitions_kind"),
        "entitlement_definitions",
        ["kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_entitlement_definitions_resource_key"),
        "entitlement_definitions",
        ["resource_key"],
        unique=False,
    )

    op.create_table(
        "plan_entitlements",
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("entitlement_id", sa.Integer(), nullable=False),
        sa.Column("limit_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("is_unlimited", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("feature_enabled", sa.Boolean(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_plan_entitlements_limit_non_negative",
        ),
        sa.CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_plan_entitlements_unlimited_has_no_limit",
        ),
        sa.ForeignKeyConstraint(["entitlement_id"], ["entitlement_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "entitlement_id", name="uq_plan_entitlements_plan_entitlement"),
    )
    op.create_index("ix_plan_entitlements_entitlement_id", "plan_entitlements", ["entitlement_id"], unique=False)
    op.create_index(op.f("ix_plan_entitlements_id"), "plan_entitlements", ["id"], unique=False)
    op.create_index("ix_plan_entitlements_plan_id", "plan_entitlements", ["plan_id"], unique=False)

    op.create_table(
        "shop_subscriptions",
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("billing_interval", sa.String(length=20), nullable=False),
        sa.Column("trial_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("provider_customer_id", sa.String(length=150), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=150), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shop_subscriptions_id"), "shop_subscriptions", ["id"], unique=False)
    op.create_index("ix_shop_subscriptions_plan_id", "shop_subscriptions", ["plan_id"], unique=False)
    op.create_index("ix_shop_subscriptions_provider_subscription", "shop_subscriptions", ["provider", "provider_subscription_id"], unique=False)
    op.create_index(op.f("ix_shop_subscriptions_provider_customer_id"), "shop_subscriptions", ["provider_customer_id"], unique=False)
    op.create_index(op.f("ix_shop_subscriptions_provider_subscription_id"), "shop_subscriptions", ["provider_subscription_id"], unique=False)
    op.create_index(op.f("ix_shop_subscriptions_shop_id"), "shop_subscriptions", ["shop_id"], unique=False)
    op.create_index("ix_shop_subscriptions_shop_status", "shop_subscriptions", ["shop_id", "status"], unique=False)
    op.create_index(op.f("ix_shop_subscriptions_status"), "shop_subscriptions", ["status"], unique=False)

    op.create_table(
        "shop_entitlement_overrides",
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("entitlement_id", sa.Integer(), nullable=False),
        sa.Column("limit_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("is_unlimited", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("feature_enabled", sa.Boolean(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_shop_entitlement_overrides_limit_non_negative",
        ),
        sa.CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_shop_entitlement_overrides_unlimited_has_no_limit",
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entitlement_id"], ["entitlement_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shop_entitlement_overrides_created_by_user_id"), "shop_entitlement_overrides", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_shop_entitlement_overrides_entitlement_id"), "shop_entitlement_overrides", ["entitlement_id"], unique=False)
    op.create_index(op.f("ix_shop_entitlement_overrides_id"), "shop_entitlement_overrides", ["id"], unique=False)
    op.create_index(op.f("ix_shop_entitlement_overrides_shop_id"), "shop_entitlement_overrides", ["shop_id"], unique=False)
    op.create_index("ix_shop_entitlement_overrides_shop_entitlement", "shop_entitlement_overrides", ["shop_id", "entitlement_id"], unique=False)
    op.create_index("ix_shop_entitlement_overrides_starts_ends", "shop_entitlement_overrides", ["starts_at", "ends_at"], unique=False)

    op.create_table(
        "shop_licenses",
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("license_key_hash", sa.String(length=128), nullable=False),
        sa.Column("license_key_prefix", sa.String(length=20), nullable=False),
        sa.Column("license_key_suffix", sa.String(length=20), nullable=False),
        sa.Column("masked_key", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["shop_subscriptions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("license_key_hash"),
    )
    op.create_index(op.f("ix_shop_licenses_id"), "shop_licenses", ["id"], unique=False)
    op.create_index(op.f("ix_shop_licenses_license_key_hash"), "shop_licenses", ["license_key_hash"], unique=True)
    op.create_index(op.f("ix_shop_licenses_shop_id"), "shop_licenses", ["shop_id"], unique=False)
    op.create_index("ix_shop_licenses_shop_status", "shop_licenses", ["shop_id", "status"], unique=False)
    op.create_index(op.f("ix_shop_licenses_status"), "shop_licenses", ["status"], unique=False)
    op.create_index("ix_shop_licenses_subscription_id", "shop_licenses", ["subscription_id"], unique=False)

    _seed_legacy_plan_and_subscriptions()


def _seed_legacy_plan_and_subscriptions() -> None:
    bind = op.get_bind()
    now = _utcnow()

    plans = sa.table(
        "plans",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("monthly_price", sa.Numeric),
        sa.column("annual_price", sa.Numeric),
        sa.column("currency", sa.String),
        sa.column("trial_days", sa.Integer),
        sa.column("grace_period_days", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("is_archived", sa.Boolean),
        sa.column("display_order", sa.Integer),
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
    shop_subscriptions = sa.table(
        "shop_subscriptions",
        sa.column("id", sa.Integer),
        sa.column("shop_id", sa.Integer),
        sa.column("plan_id", sa.Integer),
        sa.column("status", sa.String),
        sa.column("billing_interval", sa.String),
        sa.column("current_period_start", sa.DateTime(timezone=True)),
    )
    shop_licenses = sa.table(
        "shop_licenses",
        sa.column("shop_id", sa.Integer),
        sa.column("subscription_id", sa.Integer),
        sa.column("license_key_hash", sa.String),
        sa.column("license_key_prefix", sa.String),
        sa.column("license_key_suffix", sa.String),
        sa.column("masked_key", sa.String),
        sa.column("status", sa.String),
        sa.column("issued_at", sa.DateTime(timezone=True)),
        sa.column("activated_at", sa.DateTime(timezone=True)),
    )
    shops = sa.table("shops", sa.column("id", sa.Integer))

    bind.execute(
        plans.insert().values(
            code="legacy",
            name="Legacy",
            description="Internal compatibility plan for shops that predate subscription billing.",
            monthly_price=0,
            annual_price=0,
            currency="INR",
            trial_days=0,
            grace_period_days=0,
            is_active=True,
            is_archived=False,
            display_order=0,
        )
    )
    legacy_plan_id = bind.execute(
        sa.select(plans.c.id).where(plans.c.code == "legacy")
    ).scalar_one()

    definitions = (
        ("products.max", "Maximum products", "limit", "integer", "products"),
        ("vendors.max", "Maximum vendors", "limit", "integer", "vendors"),
        ("orders.monthly.max", "Maximum monthly orders", "limit", "integer", "orders.monthly"),
        ("reports.advanced", "Advanced reporting", "feature", "boolean", None),
        ("export.enabled", "CSV/Excel export", "feature", "boolean", None),
        ("api.enabled", "API access", "feature", "boolean", None),
        ("multi_location.enabled", "Multi-location support", "feature", "boolean", None),
        ("custom_branding.enabled", "Custom branding", "feature", "boolean", None),
        ("integrations.enabled", "Integrations", "feature", "boolean", None),
    )

    for key, name, kind, value_type, resource_key in definitions:
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
            sa.select(entitlement_definitions.c.id).where(
                entitlement_definitions.c.key == key
            )
        ).scalar_one()
        bind.execute(
            plan_entitlements.insert().values(
                plan_id=legacy_plan_id,
                entitlement_id=entitlement_id,
                limit_value=None,
                is_unlimited=(kind == "limit"),
                feature_enabled=True if kind == "feature" else None,
            )
        )

    for (shop_id,) in bind.execute(sa.select(shops.c.id)).all():
        result = bind.execute(
            shop_subscriptions.insert().values(
                shop_id=shop_id,
                plan_id=legacy_plan_id,
                status="active",
                billing_interval="legacy",
                current_period_start=now,
            )
        )
        subscription_id = result.inserted_primary_key[0]
        raw_key = _generate_license_key()
        bind.execute(
            shop_licenses.insert().values(
                shop_id=shop_id,
                subscription_id=subscription_id,
                license_key_hash=_hash_license_key(raw_key),
                license_key_prefix=LICENSE_PREFIX,
                license_key_suffix=raw_key[-4:],
                masked_key=_mask_license_key(raw_key),
                status="active",
                issued_at=now,
                activated_at=now,
            )
        )


def downgrade() -> None:
    op.drop_index("ix_shop_licenses_subscription_id", table_name="shop_licenses")
    op.drop_index(op.f("ix_shop_licenses_status"), table_name="shop_licenses")
    op.drop_index("ix_shop_licenses_shop_status", table_name="shop_licenses")
    op.drop_index(op.f("ix_shop_licenses_shop_id"), table_name="shop_licenses")
    op.drop_index(op.f("ix_shop_licenses_license_key_hash"), table_name="shop_licenses")
    op.drop_index(op.f("ix_shop_licenses_id"), table_name="shop_licenses")
    op.drop_table("shop_licenses")

    op.drop_index("ix_shop_entitlement_overrides_starts_ends", table_name="shop_entitlement_overrides")
    op.drop_index("ix_shop_entitlement_overrides_shop_entitlement", table_name="shop_entitlement_overrides")
    op.drop_index(op.f("ix_shop_entitlement_overrides_shop_id"), table_name="shop_entitlement_overrides")
    op.drop_index(op.f("ix_shop_entitlement_overrides_id"), table_name="shop_entitlement_overrides")
    op.drop_index(op.f("ix_shop_entitlement_overrides_entitlement_id"), table_name="shop_entitlement_overrides")
    op.drop_index(op.f("ix_shop_entitlement_overrides_created_by_user_id"), table_name="shop_entitlement_overrides")
    op.drop_table("shop_entitlement_overrides")

    op.drop_index(op.f("ix_shop_subscriptions_status"), table_name="shop_subscriptions")
    op.drop_index("ix_shop_subscriptions_shop_status", table_name="shop_subscriptions")
    op.drop_index(op.f("ix_shop_subscriptions_shop_id"), table_name="shop_subscriptions")
    op.drop_index(op.f("ix_shop_subscriptions_provider_subscription_id"), table_name="shop_subscriptions")
    op.drop_index(op.f("ix_shop_subscriptions_provider_customer_id"), table_name="shop_subscriptions")
    op.drop_index("ix_shop_subscriptions_provider_subscription", table_name="shop_subscriptions")
    op.drop_index("ix_shop_subscriptions_plan_id", table_name="shop_subscriptions")
    op.drop_index(op.f("ix_shop_subscriptions_id"), table_name="shop_subscriptions")
    op.drop_table("shop_subscriptions")

    op.drop_index("ix_plan_entitlements_plan_id", table_name="plan_entitlements")
    op.drop_index(op.f("ix_plan_entitlements_id"), table_name="plan_entitlements")
    op.drop_index("ix_plan_entitlements_entitlement_id", table_name="plan_entitlements")
    op.drop_table("plan_entitlements")

    op.drop_index(op.f("ix_entitlement_definitions_resource_key"), table_name="entitlement_definitions")
    op.drop_index(op.f("ix_entitlement_definitions_kind"), table_name="entitlement_definitions")
    op.drop_index(op.f("ix_entitlement_definitions_key"), table_name="entitlement_definitions")
    op.drop_index(op.f("ix_entitlement_definitions_is_active"), table_name="entitlement_definitions")
    op.drop_index(op.f("ix_entitlement_definitions_id"), table_name="entitlement_definitions")
    op.drop_table("entitlement_definitions")

    op.drop_index(op.f("ix_plans_is_archived"), table_name="plans")
    op.drop_index(op.f("ix_plans_is_active"), table_name="plans")
    op.drop_index(op.f("ix_plans_id"), table_name="plans")
    op.drop_index(op.f("ix_plans_code"), table_name="plans")
    op.drop_table("plans")
