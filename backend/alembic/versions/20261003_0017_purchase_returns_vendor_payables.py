"""purchase returns and vendor payable hardening

Revision ID: 20261003_0017
Revises: 20261002_0016
Create Date: 2026-10-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261003_0017"
down_revision = "20261002_0016"
branch_labels = None
depends_on = None


MOVEMENT_TYPES_WITH_RETURN = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release', 'adjustment_in', 'adjustment_out', 'purchase_receipt', 'purchase_return')"
)
MOVEMENT_TYPES_BEFORE_RETURN = (
    "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
    "'draft_release', 'adjustment_in', 'adjustment_out', 'purchase_receipt')"
)


def _inspector():
    return sa.inspect(op.get_bind())


def _has_check(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_check_constraints(table))


def _has_column(table: str, name: str) -> bool:
    return any(item["name"] == name for item in _inspector().get_columns(table))


def _has_unique(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_unique_constraints(table))


def _replace_stock_type_constraint(expression: str) -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("stock_movements") as batch:
            if _has_check("stock_movements", "ck_stock_movements_type"):
                batch.drop_constraint("ck_stock_movements_type", type_="check")
            batch.create_check_constraint("ck_stock_movements_type", expression)
        return
    if _has_check("stock_movements", "ck_stock_movements_type"):
        op.drop_constraint("ck_stock_movements_type", "stock_movements", type_="check")
    op.create_check_constraint("ck_stock_movements_type", "stock_movements", expression)


def _replace_fk(table: str, local_column: str, remote: str, ondelete: str) -> None:
    matching = [
        fk for fk in _inspector().get_foreign_keys(table)
        if fk.get("constrained_columns") == [local_column]
    ]
    if matching and (matching[0].get("options") or {}).get("ondelete", "").upper() == ondelete:
        return
    if op.get_bind().dialect.name == "sqlite":
        if not matching or not matching[0].get("name"):
            # SQLite cannot drop an unnamed FK. Fresh databases already receive
            # the RESTRICT model definition from the defensive core baseline.
            return
        with op.batch_alter_table(table) as batch:
            for fk in matching:
                batch.drop_constraint(fk["name"], type_="foreignkey")
            batch.create_foreign_key(
                f"fk_{table}_{local_column}_{remote.split('.')[0]}",
                remote.split(".")[0],
                [local_column],
                [remote.split(".")[1]],
                ondelete=ondelete,
            )
        return
    for fk in matching:
        if fk.get("name"):
            op.drop_constraint(fk["name"], table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_{local_column}_{remote.split('.')[0]}",
        table,
        remote.split(".")[0],
        [local_column],
        [remote.split(".")[1]],
        ondelete=ondelete,
    )


def upgrade() -> None:
    duplicate_bill = op.get_bind().execute(
        sa.text(
            "SELECT shop_id, bill_number FROM vendor_bills "
            "GROUP BY shop_id, bill_number HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate_bill:
        raise RuntimeError(
            "Duplicate vendor bill numbers exist within a shop; resolve them before migration"
        )

    _replace_stock_type_constraint(MOVEMENT_TYPES_WITH_RETURN)

    op.create_table(
        "purchase_return_sequences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("sequence_date", sa.Date(), nullable=False),
        sa.Column("last_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id", "sequence_date", name="uq_purchase_return_sequences_shop_date"),
    )
    op.create_index("ix_purchase_return_sequences_id", "purchase_return_sequences", ["id"])
    op.create_index("ix_purchase_return_sequences_shop_id", "purchase_return_sequences", ["shop_id"])

    op.create_table(
        "purchase_returns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("vendor_id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("goods_receipt_id", sa.Integer(), nullable=True),
        sa.Column("return_number", sa.String(length=60), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("client_request_id", sa.String(length=100), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "reason IN ('damaged', 'defective', 'wrong_item', 'excess_quantity', 'quality_issue', 'other')",
            name="ck_purchase_returns_reason",
        ),
        sa.CheckConstraint("total_amount >= 0", name="ck_purchase_returns_total_non_negative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["goods_receipt_id"], ["goods_receipts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id", "return_number", name="uq_purchase_returns_shop_number"),
        sa.UniqueConstraint(
            "shop_id", "purchase_order_id", "client_request_id",
            name="uq_purchase_returns_request_scope",
        ),
    )
    for column in ("id", "shop_id", "vendor_id", "purchase_order_id", "goods_receipt_id", "created_by"):
        op.create_index(f"ix_purchase_returns_{column}", "purchase_returns", [column])
    op.create_index(
        "ix_purchase_returns_shop_po_created", "purchase_returns",
        ["shop_id", "purchase_order_id", "created_at"],
    )

    op.create_table(
        "purchase_return_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("purchase_return_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("goods_receipt_item_id", sa.Integer(), nullable=False),
        sa.Column("returned_quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("returned_quantity > 0", name="ck_purchase_return_items_quantity_positive"),
        sa.CheckConstraint("unit_cost >= 0", name="ck_purchase_return_items_cost_non_negative"),
        sa.CheckConstraint("line_total >= 0", name="ck_purchase_return_items_total_non_negative"),
        sa.ForeignKeyConstraint(["goods_receipt_item_id"], ["goods_receipt_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_return_id"], ["purchase_returns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "purchase_return_id", "goods_receipt_item_id",
            name="uq_purchase_return_items_receipt_item",
        ),
    )
    for column in ("id", "purchase_return_id", "product_id", "goods_receipt_item_id"):
        op.create_index(f"ix_purchase_return_items_{column}", "purchase_return_items", [column])

    op.create_table(
        "vendor_credits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("vendor_id", sa.Integer(), nullable=False),
        sa.Column("purchase_return_id", sa.Integer(), nullable=False),
        sa.Column("vendor_bill_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("applied_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="unapplied", nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount >= 0", name="ck_vendor_credits_amount_non_negative"),
        sa.CheckConstraint("applied_amount >= 0", name="ck_vendor_credits_applied_non_negative"),
        sa.CheckConstraint("applied_amount <= amount", name="ck_vendor_credits_applied_within_amount"),
        sa.CheckConstraint("status IN ('unapplied', 'partial', 'applied')", name="ck_vendor_credits_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["purchase_return_id"], ["purchase_returns.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_bill_id"], ["vendor_bills.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_return_id", name="uq_vendor_credits_purchase_return"),
    )
    for column in ("id", "shop_id", "vendor_id", "purchase_return_id", "vendor_bill_id", "created_by"):
        op.create_index(f"ix_vendor_credits_{column}", "vendor_credits", [column])

    if not _has_column("vendor_bill_payments", "client_request_id"):
        op.add_column(
            "vendor_bill_payments",
            sa.Column("client_request_id", sa.String(length=100), nullable=True),
        )
    if not _has_column("vendor_bill_payments", "request_fingerprint"):
        op.add_column(
            "vendor_bill_payments",
            sa.Column("request_fingerprint", sa.String(length=64), nullable=True),
        )
    if not _has_unique("vendor_bill_payments", "uq_vendor_bill_payments_request_scope"):
        with op.batch_alter_table("vendor_bill_payments") as batch:
            batch.create_unique_constraint(
                "uq_vendor_bill_payments_request_scope",
                ["shop_id", "vendor_bill_id", "client_request_id"],
            )
    op.execute(
        sa.text(
            "UPDATE vendor_bill_payments SET client_request_id = "
            "'legacy-vendor-payment-' || CAST(id AS VARCHAR) WHERE client_request_id IS NULL"
        )
    )
    if not _has_unique("vendor_bills", "uq_vendor_bills_shop_number"):
        with op.batch_alter_table("vendor_bills") as batch:
            batch.create_unique_constraint("uq_vendor_bills_shop_number", ["shop_id", "bill_number"])

    _replace_fk("vendor_bills", "vendor_id", "vendors.id", "RESTRICT")
    _replace_fk("vendor_bill_payments", "vendor_bill_id", "vendor_bills.id", "RESTRICT")


def downgrade() -> None:
    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM purchase_returns")).scalar_one():
        raise RuntimeError("Cannot downgrade while purchase return history exists")

    _replace_fk("vendor_bill_payments", "vendor_bill_id", "vendor_bills.id", "CASCADE")
    _replace_fk("vendor_bills", "vendor_id", "vendors.id", "CASCADE")
    with op.batch_alter_table("vendor_bills") as batch:
        batch.drop_constraint("uq_vendor_bills_shop_number", type_="unique")
    with op.batch_alter_table("vendor_bill_payments") as batch:
        batch.drop_constraint("uq_vendor_bill_payments_request_scope", type_="unique")
        batch.drop_column("request_fingerprint")
        batch.drop_column("client_request_id")
    op.drop_table("vendor_credits")
    op.drop_table("purchase_return_items")
    op.drop_table("purchase_returns")
    op.drop_table("purchase_return_sequences")
    _replace_stock_type_constraint(MOVEMENT_TYPES_BEFORE_RETURN)
