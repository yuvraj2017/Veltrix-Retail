"""stock movement ledger and return disposition

Revision ID: 20261002_0014
Revises: 20261001_0013
Create Date: 2026-10-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261002_0014"
down_revision = "20261001_0013"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


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


def _create_stock_movements() -> None:
    if not _has_table("stock_movements"):
        op.create_table(
            "stock_movements",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column("movement_type", sa.String(length=30), nullable=False),
            sa.Column("quantity_delta", sa.Integer(), nullable=False),
            sa.Column("quantity_before", sa.Integer(), nullable=False),
            sa.Column("quantity_after", sa.Integer(), nullable=False),
            sa.Column("reference_type", sa.String(length=50), nullable=False),
            sa.Column("reference_id", sa.Integer(), nullable=True),
            sa.Column("reference_line_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.String(length=200), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("client_request_id", sa.String(length=150), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column(
                "occurred_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "quantity_before >= 0",
                name="ck_stock_movements_before_non_negative",
            ),
            sa.CheckConstraint(
                "quantity_after >= 0",
                name="ck_stock_movements_after_non_negative",
            ),
            sa.CheckConstraint(
                "quantity_after = quantity_before + quantity_delta",
                name="ck_stock_movements_balance_math",
            ),
            sa.CheckConstraint(
                "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', 'draft_release')",
                name="ck_stock_movements_type",
            ),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    for index_name, columns, unique in (
        ("ix_stock_movements_id", ["id"], False),
        ("ix_stock_movements_shop_id", ["shop_id"], False),
        ("ix_stock_movements_product_id", ["product_id"], False),
        ("ix_stock_movements_movement_type", ["movement_type"], False),
        ("ix_stock_movements_created_by", ["created_by"], False),
        (
            "uq_stock_movements_shop_client_request",
            ["shop_id", "client_request_id"],
            True,
        ),
        (
            "ix_stock_movements_shop_product_occurred",
            ["shop_id", "product_id", "occurred_at"],
            False,
        ),
        (
            "ix_stock_movements_shop_reference",
            ["shop_id", "reference_type", "reference_id"],
            False,
        ),
    ):
        if not _has_index("stock_movements", index_name):
            op.create_index(index_name, "stock_movements", columns, unique=unique)


def _backfill_opening_balances() -> None:
    if not _has_table("products") or not _has_table("stock_movements"):
        return

    products = sa.table(
        "products",
        sa.column("id", sa.Integer()),
        sa.column("shop_id", sa.Integer()),
        sa.column("stock_quantity", sa.Integer()),
    )
    movements = sa.table(
        "stock_movements",
        sa.column("shop_id", sa.Integer()),
        sa.column("product_id", sa.Integer()),
        sa.column("movement_type", sa.String()),
        sa.column("quantity_delta", sa.Integer()),
        sa.column("quantity_before", sa.Integer()),
        sa.column("quantity_after", sa.Integer()),
        sa.column("reference_type", sa.String()),
        sa.column("reference_id", sa.Integer()),
        sa.column("reference_line_id", sa.Integer()),
        sa.column("reason", sa.String()),
        sa.column("notes", sa.Text()),
        sa.column("client_request_id", sa.String()),
        sa.column("created_by", sa.Integer()),
        sa.column("occurred_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    request_key = sa.literal("migration-opening-product-") + sa.cast(
        products.c.id, sa.String()
    )
    already_exists = sa.exists().where(
        sa.and_(
            movements.c.shop_id == products.c.shop_id,
            movements.c.client_request_id == request_key,
        )
    )
    opening_rows = sa.select(
        products.c.shop_id,
        products.c.id,
        sa.literal("opening_balance"),
        products.c.stock_quantity,
        sa.literal(0),
        products.c.stock_quantity,
        sa.literal("migration_cutover"),
        products.c.id,
        sa.null(),
        sa.literal("Phase 3B ledger cutover opening balance"),
        sa.null(),
        request_key,
        sa.null(),
        sa.func.now(),
        sa.func.now(),
    ).where(~already_exists)

    op.get_bind().execute(
        movements.insert().from_select(
            [
                "shop_id",
                "product_id",
                "movement_type",
                "quantity_delta",
                "quantity_before",
                "quantity_after",
                "reference_type",
                "reference_id",
                "reference_line_id",
                "reason",
                "notes",
                "client_request_id",
                "created_by",
                "occurred_at",
                "created_at",
            ],
            opening_rows,
        )
    )


def _add_return_disposition() -> None:
    if not _has_table("invoice_return_items"):
        return

    if not _has_column("invoice_return_items", "restocked_quantity"):
        op.add_column(
            "invoice_return_items",
            sa.Column("restocked_quantity", sa.Integer(), nullable=True),
        )
    if not _has_column("invoice_return_items", "non_restocked_quantity"):
        op.add_column(
            "invoice_return_items",
            sa.Column("non_restocked_quantity", sa.Integer(), nullable=True),
        )
    if not _has_column("invoice_return_items", "disposition"):
        op.add_column(
            "invoice_return_items",
            sa.Column("disposition", sa.String(length=30), nullable=True),
        )
    if not _has_column("invoice_return_items", "disposition_notes"):
        op.add_column(
            "invoice_return_items",
            sa.Column("disposition_notes", sa.Text(), nullable=True),
        )

    fractional = op.get_bind().execute(
        sa.text(
            "SELECT id FROM invoice_return_items "
            "WHERE quantity <> CAST(quantity AS INTEGER) LIMIT 1"
        )
    ).first()
    if fractional:
        raise RuntimeError(
            "Cannot add whole-unit return disposition because an existing return item "
            "has a fractional quantity. Resolve it manually before rerunning the migration."
        )

    op.execute(
        sa.text(
            "UPDATE invoice_return_items "
            "SET restocked_quantity = CAST(quantity AS INTEGER), "
            "non_restocked_quantity = 0, disposition = 'restock' "
            "WHERE restocked_quantity IS NULL "
            "OR non_restocked_quantity IS NULL OR disposition IS NULL"
        )
    )

    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("invoice_return_items") as batch_op:
            batch_op.alter_column("restocked_quantity", existing_type=sa.Integer(), nullable=False)
            batch_op.alter_column("non_restocked_quantity", existing_type=sa.Integer(), nullable=False)
            batch_op.alter_column("disposition", existing_type=sa.String(length=30), nullable=False)
            batch_op.create_check_constraint(
                "ck_invoice_return_items_disposition_quantities",
                "quantity = restocked_quantity + non_restocked_quantity "
                "AND restocked_quantity >= 0 AND non_restocked_quantity >= 0",
            )
            batch_op.create_check_constraint(
                "ck_invoice_return_items_disposition",
                "disposition IN ('restock', 'damaged', 'defective', 'other_non_restock')",
            )
    else:
        op.alter_column("invoice_return_items", "restocked_quantity", existing_type=sa.Integer(), nullable=False)
        op.alter_column("invoice_return_items", "non_restocked_quantity", existing_type=sa.Integer(), nullable=False)
        op.alter_column("invoice_return_items", "disposition", existing_type=sa.String(length=30), nullable=False)
        if not _has_check("invoice_return_items", "ck_invoice_return_items_disposition_quantities"):
            op.create_check_constraint(
                "ck_invoice_return_items_disposition_quantities",
                "invoice_return_items",
                "quantity = restocked_quantity + non_restocked_quantity "
                "AND restocked_quantity >= 0 AND non_restocked_quantity >= 0",
            )
        if not _has_check("invoice_return_items", "ck_invoice_return_items_disposition"):
            op.create_check_constraint(
                "ck_invoice_return_items_disposition",
                "invoice_return_items",
                "disposition IN ('restock', 'damaged', 'defective', 'other_non_restock')",
            )


def upgrade() -> None:
    _create_stock_movements()
    _backfill_opening_balances()
    _add_return_disposition()


def downgrade() -> None:
    if _has_table("invoice_return_items"):
        dialect = op.get_bind().dialect.name
        if dialect == "sqlite":
            with op.batch_alter_table("invoice_return_items") as batch_op:
                batch_op.drop_constraint(
                    "ck_invoice_return_items_disposition_quantities", type_="check"
                )
                batch_op.drop_constraint("ck_invoice_return_items_disposition", type_="check")
                batch_op.drop_column("disposition_notes")
                batch_op.drop_column("disposition")
                batch_op.drop_column("non_restocked_quantity")
                batch_op.drop_column("restocked_quantity")
        else:
            for constraint_name in (
                "ck_invoice_return_items_disposition_quantities",
                "ck_invoice_return_items_disposition",
            ):
                if _has_check("invoice_return_items", constraint_name):
                    op.drop_constraint(
                        constraint_name,
                        "invoice_return_items",
                        type_="check",
                    )
            for column_name in (
                "disposition_notes",
                "disposition",
                "non_restocked_quantity",
                "restocked_quantity",
            ):
                if _has_column("invoice_return_items", column_name):
                    op.drop_column("invoice_return_items", column_name)

    if _has_table("stock_movements"):
        op.drop_table("stock_movements")
