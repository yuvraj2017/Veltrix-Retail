"""shop branch lifecycle

Revision ID: 20261007_0020
Revises: 20261003_0019
Create Date: 2026-10-07
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261007_0020"
down_revision = "20261003_0019"
branch_labels = None
depends_on = None


STATUS_CHECK = "ck_shops_status"
STATUS_INDEX = "ix_shops_organization_status"
VALID_STATUSES = ("pending", "active", "inactive")


def _inspector():
    return sa.inspect(op.get_bind())


def _has_column(table: str, column: str) -> bool:
    return any(item["name"] == column for item in _inspector().get_columns(table))


def _has_index(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_indexes(table))


def _has_check(table: str, name: str) -> bool:
    return any(
        item.get("name") == name
        for item in _inspector().get_check_constraints(table)
    )


def _validate_existing_branch_foundation() -> None:
    bind = op.get_bind()
    orphan = bind.execute(
        sa.text(
            "SELECT id FROM shops WHERE organization_id IS NULL LIMIT 1"
        )
    ).first()
    if orphan:
        raise RuntimeError(f"Shop {orphan.id} has no organization")

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
            "Organization does not have exactly one default branch: "
            f"{invalid_default.organization_id}"
        )


def _add_and_backfill_status() -> None:
    if not _has_column("shops", "status"):
        op.add_column(
            "shops",
            sa.Column(
                "status",
                sa.String(length=20),
                server_default="active",
                nullable=True,
            ),
        )

    bind = op.get_bind()
    bind.execute(sa.text("UPDATE shops SET status = 'active' WHERE status IS NULL"))

    invalid = bind.execute(
        sa.text(
            """
            SELECT id, status
            FROM shops
            WHERE status IS NULL OR status NOT IN ('pending', 'active', 'inactive')
            LIMIT 1
            """
        )
    ).first()
    if invalid:
        raise RuntimeError(
            f"Shop {invalid.id} has unsupported lifecycle status {invalid.status!r}"
        )


def _enforce_status_schema() -> None:
    bind = op.get_bind()
    column = next(
        item for item in _inspector().get_columns("shops") if item["name"] == "status"
    )
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("shops") as batch:
            if column.get("nullable", True):
                batch.alter_column(
                    "status",
                    existing_type=sa.String(length=20),
                    existing_server_default="active",
                    nullable=False,
                )
            if not _has_check("shops", STATUS_CHECK):
                batch.create_check_constraint(
                    STATUS_CHECK,
                    "status IN ('pending', 'active', 'inactive')",
                )
    else:
        if column.get("nullable", True):
            op.alter_column(
                "shops",
                "status",
                existing_type=sa.String(length=20),
                existing_server_default="active",
                nullable=False,
            )
        if not _has_check("shops", STATUS_CHECK):
            op.create_check_constraint(
                STATUS_CHECK,
                "shops",
                "status IN ('pending', 'active', 'inactive')",
            )

    if not _has_index("shops", STATUS_INDEX):
        op.create_index(
            STATUS_INDEX,
            "shops",
            ["organization_id", "status"],
            unique=False,
        )


def upgrade() -> None:
    _validate_existing_branch_foundation()
    _add_and_backfill_status()
    _enforce_status_schema()


def downgrade() -> None:
    if _has_index("shops", STATUS_INDEX):
        op.drop_index(STATUS_INDEX, table_name="shops")

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("shops") as batch:
            if _has_check("shops", STATUS_CHECK):
                batch.drop_constraint(STATUS_CHECK, type_="check")
            if _has_column("shops", "status"):
                batch.drop_column("status")
    else:
        if _has_check("shops", STATUS_CHECK):
            op.drop_constraint(STATUS_CHECK, "shops", type_="check")
        if _has_column("shops", "status"):
            op.drop_column("shops", "status")
