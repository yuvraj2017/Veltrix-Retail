"""purchase orders and goods receiving

Revision ID: 20261002_0016
Revises: 20261002_0015
Create Date: 2026-10-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261002_0016"
down_revision = "20261002_0015"
branch_labels = None
depends_on = None


MOVEMENT_TYPES_WITH_PURCHASE = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release', 'adjustment_in', 'adjustment_out', 'purchase_receipt')"
)
MOVEMENT_TYPES_BEFORE_PURCHASE = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release', 'adjustment_in', 'adjustment_out')"
)


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def _has_check(table: str, name: str) -> bool:
    if not _has_table(table):
        return False
    return any(item.get("name") == name for item in sa.inspect(op.get_bind()).get_check_constraints(table))


def _replace_stock_type_constraint(expression: str) -> None:
    if not _has_table("stock_movements"):
        return
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("stock_movements") as batch:
            if _has_check("stock_movements", "ck_stock_movements_type"):
                batch.drop_constraint("ck_stock_movements_type", type_="check")
            batch.create_check_constraint("ck_stock_movements_type", expression)
        return
    if _has_check("stock_movements", "ck_stock_movements_type"):
        op.drop_constraint("ck_stock_movements_type", "stock_movements", type_="check")
    op.create_check_constraint("ck_stock_movements_type", "stock_movements", expression)


def upgrade() -> None:
    _replace_stock_type_constraint(MOVEMENT_TYPES_WITH_PURCHASE)

    op.create_table(
        "purchase_order_sequences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("sequence_date", sa.Date(), nullable=False),
        sa.Column("last_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id", "sequence_date", name="uq_purchase_order_sequences_shop_date"),
    )
    op.create_index("ix_purchase_order_sequences_id", "purchase_order_sequences", ["id"])
    op.create_index("ix_purchase_order_sequences_shop_id", "purchase_order_sequences", ["shop_id"])

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("vendor_id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_number", sa.String(length=40), nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="draft", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("subtotal", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("tax_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')",
            name="ck_purchase_orders_status",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id", "purchase_order_number", name="uq_purchase_orders_shop_number"),
    )
    op.create_index("ix_purchase_orders_id", "purchase_orders", ["id"])
    op.create_index("ix_purchase_orders_shop_id", "purchase_orders", ["shop_id"])
    op.create_index("ix_purchase_orders_vendor_id", "purchase_orders", ["vendor_id"])
    op.create_index("ix_purchase_orders_created_by", "purchase_orders", ["created_by"])
    op.create_index(
        "ix_purchase_orders_shop_status_date", "purchase_orders", ["shop_id", "status", "order_date"]
    )

    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=200), nullable=False),
        sa.Column("product_sku", sa.String(length=100), nullable=False),
        sa.Column("ordered_quantity", sa.Integer(), nullable=False),
        sa.Column("received_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("ordered_quantity > 0", name="ck_purchase_order_items_ordered_positive"),
        sa.CheckConstraint("received_quantity >= 0", name="ck_purchase_order_items_received_non_negative"),
        sa.CheckConstraint(
            "received_quantity <= ordered_quantity",
            name="ck_purchase_order_items_received_within_ordered",
        ),
        sa.CheckConstraint("unit_cost >= 0", name="ck_purchase_order_items_unit_cost_non_negative"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_order_id", "product_id", name="uq_purchase_order_items_product"),
    )
    op.create_index("ix_purchase_order_items_id", "purchase_order_items", ["id"])
    op.create_index("ix_purchase_order_items_purchase_order_id", "purchase_order_items", ["purchase_order_id"])
    op.create_index("ix_purchase_order_items_product_id", "purchase_order_items", ["product_id"])

    op.create_table(
        "goods_receipts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("receipt_number", sa.String(length=60), nullable=False),
        sa.Column("received_date", sa.Date(), nullable=False),
        sa.Column("client_request_id", sa.String(length=100), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id", "receipt_number", name="uq_goods_receipts_shop_number"),
        sa.UniqueConstraint(
            "shop_id",
            "purchase_order_id",
            "client_request_id",
            name="uq_goods_receipts_request_scope",
        ),
    )
    op.create_index("ix_goods_receipts_id", "goods_receipts", ["id"])
    op.create_index("ix_goods_receipts_shop_id", "goods_receipts", ["shop_id"])
    op.create_index("ix_goods_receipts_purchase_order_id", "goods_receipts", ["purchase_order_id"])
    op.create_index("ix_goods_receipts_received_by", "goods_receipts", ["received_by"])
    op.create_index(
        "ix_goods_receipts_shop_po_created", "goods_receipts", ["shop_id", "purchase_order_id", "created_at"]
    )

    op.create_table(
        "goods_receipt_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goods_receipt_id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_item_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("received_quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("received_quantity > 0", name="ck_goods_receipt_items_quantity_positive"),
        sa.CheckConstraint("unit_cost >= 0", name="ck_goods_receipt_items_cost_non_negative"),
        sa.ForeignKeyConstraint(["goods_receipt_id"], ["goods_receipts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_order_item_id"], ["purchase_order_items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "goods_receipt_id", "purchase_order_item_id", name="uq_goods_receipt_items_po_item"
        ),
    )
    op.create_index("ix_goods_receipt_items_id", "goods_receipt_items", ["id"])
    op.create_index("ix_goods_receipt_items_goods_receipt_id", "goods_receipt_items", ["goods_receipt_id"])
    op.create_index(
        "ix_goods_receipt_items_purchase_order_item_id", "goods_receipt_items", ["purchase_order_item_id"]
    )
    op.create_index("ix_goods_receipt_items_product_id", "goods_receipt_items", ["product_id"])


def downgrade() -> None:
    purchase_movements = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM stock_movements WHERE movement_type = 'purchase_receipt'")
    ).scalar_one()
    if purchase_movements:
        raise RuntimeError("Cannot downgrade while purchase receipt stock movements exist")

    op.drop_table("goods_receipt_items")
    op.drop_table("goods_receipts")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("purchase_order_sequences")
    _replace_stock_type_constraint(MOVEMENT_TYPES_BEFORE_PURCHASE)
