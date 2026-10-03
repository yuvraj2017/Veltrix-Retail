"""organization and branch foundation

Revision ID: 20261003_0018
Revises: 20261003_0017
Create Date: 2026-10-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261003_0018"
down_revision = "20261003_0017"
branch_labels = None
depends_on = None


ORGANIZATION_FK = "fk_shops_organization_id_organizations"
DEFAULT_BRANCH_INDEX = "uq_shops_organization_default_branch"


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table: str) -> bool:
    return _inspector().has_table(table)


def _has_column(table: str, column: str) -> bool:
    return any(item["name"] == column for item in _inspector().get_columns(table))


def _has_index(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_indexes(table))


def _has_fk(table: str, constrained_column: str) -> bool:
    return any(
        item.get("constrained_columns") == [constrained_column]
        for item in _inspector().get_foreign_keys(table)
    )


def _create_organizations_table() -> None:
    if _has_table("organizations"):
        return
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"], unique=False)


def _add_shop_columns() -> None:
    if not _has_column("shops", "organization_id"):
        op.add_column("shops", sa.Column("organization_id", sa.Integer(), nullable=True))
    if not _has_column("shops", "is_default_branch"):
        op.add_column(
            "shops",
            sa.Column(
                "is_default_branch",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            ),
        )


def _backfill_existing_shops() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO organizations (id, name, status, created_at, updated_at)
            SELECT s.id, s.name, 'active', s.created_at, s.updated_at
            FROM shops AS s
            WHERE NOT EXISTS (
                SELECT 1 FROM organizations AS o WHERE o.id = s.id
            )
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE shops
            SET organization_id = id, is_default_branch = true
            WHERE organization_id IS NULL
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE shops AS target
            SET is_default_branch = true
            WHERE target.is_default_branch = false
              AND NOT EXISTS (
                  SELECT 1 FROM shops AS existing
                  WHERE existing.organization_id = target.organization_id
                    AND existing.is_default_branch = true
              )
              AND 1 = (
                  SELECT COUNT(*) FROM shops AS sibling
                  WHERE sibling.organization_id = target.organization_id
              )
            """
        )
    )

    if bind.dialect.name == "postgresql":
        bind.execute(
            sa.text(
                """
                SELECT setval(
                    pg_get_serial_sequence('organizations', 'id'),
                    COALESCE(MAX(id), 1),
                    COUNT(*) > 0
                )
                FROM organizations
                """
            )
        )


def _validate_backfill() -> None:
    bind = op.get_bind()
    orphan = bind.execute(
        sa.text("SELECT id FROM shops WHERE organization_id IS NULL LIMIT 1")
    ).first()
    if orphan:
        raise RuntimeError(f"Organization backfill left shop {orphan.id} unassigned")

    invalid_default = bind.execute(
        sa.text(
            """
            SELECT organization_id
            FROM shops
            GROUP BY organization_id
            HAVING SUM(CASE WHEN is_default_branch THEN 1 ELSE 0 END) <> 1
            LIMIT 1
            """
        )
    ).first()
    if invalid_default:
        raise RuntimeError(
            "Organization backfill did not produce exactly one default branch "
            f"for organization {invalid_default.organization_id}"
        )


def _enforce_shop_constraints() -> None:
    organization_column = next(
        item for item in _inspector().get_columns("shops") if item["name"] == "organization_id"
    )
    if organization_column.get("nullable", True):
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("shops") as batch:
                batch.alter_column(
                    "organization_id",
                    existing_type=sa.Integer(),
                    nullable=False,
                )
        else:
            op.alter_column(
                "shops",
                "organization_id",
                existing_type=sa.Integer(),
                nullable=False,
            )

    if not _has_fk("shops", "organization_id"):
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("shops") as batch:
                batch.create_foreign_key(
                    ORGANIZATION_FK,
                    "organizations",
                    ["organization_id"],
                    ["id"],
                    ondelete="RESTRICT",
                )
        else:
            op.create_foreign_key(
                ORGANIZATION_FK,
                "shops",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="RESTRICT",
            )

    if not _has_index("shops", "ix_shops_organization_id"):
        op.create_index("ix_shops_organization_id", "shops", ["organization_id"])
    if not _has_index("shops", DEFAULT_BRANCH_INDEX):
        op.create_index(
            DEFAULT_BRANCH_INDEX,
            "shops",
            ["organization_id"],
            unique=True,
            postgresql_where=sa.text("is_default_branch"),
            sqlite_where=sa.text("is_default_branch = 1"),
        )


def upgrade() -> None:
    _create_organizations_table()
    _add_shop_columns()
    _backfill_existing_shops()
    _validate_backfill()
    _enforce_shop_constraints()


def downgrade() -> None:
    if _has_index("shops", DEFAULT_BRANCH_INDEX):
        op.drop_index(DEFAULT_BRANCH_INDEX, table_name="shops")
    if _has_index("shops", "ix_shops_organization_id"):
        op.drop_index("ix_shops_organization_id", table_name="shops")

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("shops") as batch:
            if _has_fk("shops", "organization_id"):
                batch.drop_constraint(ORGANIZATION_FK, type_="foreignkey")
            if _has_column("shops", "is_default_branch"):
                batch.drop_column("is_default_branch")
            if _has_column("shops", "organization_id"):
                batch.drop_column("organization_id")
    else:
        if _has_fk("shops", "organization_id"):
            op.drop_constraint(ORGANIZATION_FK, "shops", type_="foreignkey")
        if _has_column("shops", "is_default_branch"):
            op.drop_column("shops", "is_default_branch")
        if _has_column("shops", "organization_id"):
            op.drop_column("shops", "organization_id")

    if _has_table("organizations"):
        op.drop_table("organizations")
