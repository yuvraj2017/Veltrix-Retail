"""controlled stock adjustments

Revision ID: 20261002_0015
Revises: 20261002_0014
Create Date: 2026-10-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261002_0015"
down_revision = "20261002_0014"
branch_labels = None
depends_on = None


MOVEMENT_TYPES_WITH_ADJUSTMENTS = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release', 'adjustment_in', 'adjustment_out')"
)
MOVEMENT_TYPES_BEFORE_ADJUSTMENTS = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release')"
)


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)
    }


def _has_check(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        constraint.get("name") == constraint_name
        for constraint in sa.inspect(op.get_bind()).get_check_constraints(table_name)
    )


def _replace_movement_type_constraint(expression: str) -> None:
    if not _has_table("stock_movements"):
        return

    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("stock_movements") as batch_op:
            if _has_check("stock_movements", "ck_stock_movements_type"):
                batch_op.drop_constraint("ck_stock_movements_type", type_="check")
            batch_op.create_check_constraint("ck_stock_movements_type", expression)
        return

    if _has_check("stock_movements", "ck_stock_movements_type"):
        op.drop_constraint("ck_stock_movements_type", "stock_movements", type_="check")
    op.create_check_constraint(
        "ck_stock_movements_type",
        "stock_movements",
        expression,
    )


def upgrade() -> None:
    _replace_movement_type_constraint(MOVEMENT_TYPES_WITH_ADJUSTMENTS)

    if not _has_table("stock_adjustment_requests"):
        op.create_table(
            "stock_adjustment_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column("movement_id", sa.Integer(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("operation_type", sa.String(length=30), nullable=False),
            sa.Column("client_request_id", sa.String(length=100), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("quantity_before", sa.Integer(), nullable=False),
            sa.Column("quantity_delta", sa.Integer(), nullable=False),
            sa.Column("quantity_after", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=50), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "operation_type IN ('adjustment', 'physical_count')",
                name="ck_stock_adjustment_requests_operation_type",
            ),
            sa.CheckConstraint(
                "quantity_before >= 0",
                name="ck_stock_adjustment_requests_before_non_negative",
            ),
            sa.CheckConstraint(
                "quantity_after >= 0",
                name="ck_stock_adjustment_requests_after_non_negative",
            ),
            sa.CheckConstraint(
                "quantity_after = quantity_before + quantity_delta",
                name="ck_stock_adjustment_requests_balance_math",
            ),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["movement_id"], ["stock_movements.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    for index_name, columns, unique in (
        ("ix_stock_adjustment_requests_id", ["id"], False),
        ("ix_stock_adjustment_requests_shop_id", ["shop_id"], False),
        ("ix_stock_adjustment_requests_product_id", ["product_id"], False),
        ("ix_stock_adjustment_requests_movement_id", ["movement_id"], False),
        ("ix_stock_adjustment_requests_created_by", ["created_by"], False),
        (
            "uq_stock_adjustment_requests_scope",
            ["shop_id", "product_id", "client_request_id"],
            True,
        ),
        (
            "ix_stock_adjustment_requests_shop_product_created",
            ["shop_id", "product_id", "created_at"],
            False,
        ),
    ):
        if not _has_index("stock_adjustment_requests", index_name):
            op.create_index(index_name, "stock_adjustment_requests", columns, unique=unique)


def downgrade() -> None:
    if _has_table("stock_adjustment_requests"):
        op.drop_table("stock_adjustment_requests")
    _replace_movement_type_constraint(MOVEMENT_TYPES_BEFORE_ADJUSTMENTS)
