"""explicit organization commercial source

Revision ID: 20261010_0023
Revises: 20261009_0022
Create Date: 2026-10-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261010_0023"
down_revision = "20261009_0022"
branch_labels = None
depends_on = None


SOURCE_COLUMN = "commercial_source_shop_id"
SOURCE_INDEX = "ix_organizations_commercial_source_shop_id"
SOURCE_FK = "fk_organizations_commercial_source_shop_organization"


def _inspector():
    return sa.inspect(op.get_bind())


def _has_column(table: str, column: str) -> bool:
    return any(item["name"] == column for item in _inspector().get_columns(table))


def _has_index(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_indexes(table))


def _has_constraint(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_foreign_keys(table))


def _add_source_column() -> None:
    if not _has_column("organizations", SOURCE_COLUMN):
        op.add_column(
            "organizations",
            sa.Column(SOURCE_COLUMN, sa.Integer(), nullable=True),
        )


def _backfill_single_shop_organizations() -> None:
    op.get_bind().execute(
        sa.text(
            """
            UPDATE organizations AS organization
            SET commercial_source_shop_id = candidate.shop_id
            FROM (
                SELECT organization_id, MIN(id) AS shop_id
                FROM shops
                GROUP BY organization_id
                HAVING COUNT(*) = 1
            ) AS candidate
            WHERE candidate.organization_id = organization.id
              AND organization.commercial_source_shop_id IS NULL
            """
        )
    )


def _validate_backfill() -> None:
    invalid = op.get_bind().execute(
        sa.text(
            """
            SELECT organization.id
            FROM organizations AS organization
            JOIN shops AS source
              ON source.id = organization.commercial_source_shop_id
            WHERE source.organization_id <> organization.id
            LIMIT 1
            """
        )
    ).first()
    if invalid:
        raise RuntimeError(
            "Commercial source backfill crossed organization boundary for "
            f"organization {invalid.id}"
        )

    unresolved_single = op.get_bind().execute(
        sa.text(
            """
            SELECT organization.id
            FROM organizations AS organization
            WHERE organization.commercial_source_shop_id IS NULL
              AND 1 = (
                  SELECT COUNT(*) FROM shops
                  WHERE shops.organization_id = organization.id
              )
            LIMIT 1
            """
        )
    ).first()
    if unresolved_single:
        raise RuntimeError(
            "Single-shop organization source backfill failed for organization "
            f"{unresolved_single.id}"
        )


def _add_constraints() -> None:
    if not _has_index("organizations", SOURCE_INDEX):
        op.create_index(
            SOURCE_INDEX,
            "organizations",
            [SOURCE_COLUMN],
            unique=False,
        )

    if _has_constraint("organizations", SOURCE_FK):
        return
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("organizations") as batch:
            batch.create_foreign_key(
                SOURCE_FK,
                "shops",
                [SOURCE_COLUMN, "id"],
                ["id", "organization_id"],
                ondelete="RESTRICT",
            )
    else:
        op.create_foreign_key(
            SOURCE_FK,
            "organizations",
            "shops",
            [SOURCE_COLUMN, "id"],
            ["id", "organization_id"],
            ondelete="RESTRICT",
        )


def upgrade() -> None:
    _add_source_column()
    _backfill_single_shop_organizations()
    _validate_backfill()
    _add_constraints()


def downgrade() -> None:
    if _has_constraint("organizations", SOURCE_FK):
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("organizations") as batch:
                batch.drop_constraint(SOURCE_FK, type_="foreignkey")
        else:
            op.drop_constraint(SOURCE_FK, "organizations", type_="foreignkey")
    if _has_index("organizations", SOURCE_INDEX):
        op.drop_index(SOURCE_INDEX, table_name="organizations")
    if _has_column("organizations", SOURCE_COLUMN):
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("organizations") as batch:
                batch.drop_column(SOURCE_COLUMN)
        else:
            op.drop_column("organizations", SOURCE_COLUMN)
