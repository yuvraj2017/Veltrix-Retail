"""returns refunds and credit notes

Revision ID: 20261001_0013
Revises: 20261001_0012
Create Date: 2026-10-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261001_0013"
down_revision = "20261001_0012"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], *, unique: bool = False) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    if not _has_table("invoice_reversal_sequences"):
        op.create_table(
            "invoice_reversal_sequences",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("sequence_type", sa.String(length=20), nullable=False),
            sa.Column("sequence_date", sa.Date(), nullable=False),
            sa.Column("last_number", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_invoice_reversal_sequences_id", "invoice_reversal_sequences", ["id"])
    _create_index_if_missing("ix_invoice_reversal_sequences_shop_id", "invoice_reversal_sequences", ["shop_id"])
    _create_index_if_missing(
        "uq_invoice_reversal_sequences_scope",
        "invoice_reversal_sequences",
        ["shop_id", "sequence_type", "sequence_date"],
        unique=True,
    )

    if not _has_table("invoice_returns"):
        op.create_table(
            "invoice_returns",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("invoice_id", sa.Integer(), nullable=False),
            sa.Column("return_number", sa.String(length=50), nullable=False),
            sa.Column("credit_note_number", sa.String(length=50), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("reason", sa.String(length=200), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("taxable_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("cgst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("sgst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("igst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_tax_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_buy_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_profit", sa.Numeric(12, 2), nullable=False),
            sa.Column("applied_to_outstanding_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("refundable_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("client_request_id", sa.String(length=100), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    for index_name, columns, unique in (
        ("ix_invoice_returns_id", ["id"], False),
        ("ix_invoice_returns_shop_id", ["shop_id"], False),
        ("ix_invoice_returns_invoice_id", ["invoice_id"], False),
        ("ix_invoice_returns_return_number", ["return_number"], False),
        ("ix_invoice_returns_credit_note_number", ["credit_note_number"], False),
        ("ix_invoice_returns_created_by", ["created_by"], False),
        ("uq_invoice_returns_shop_request", ["shop_id", "client_request_id"], True),
        ("uq_invoice_returns_shop_return_number", ["shop_id", "return_number"], True),
        ("uq_invoice_returns_shop_credit_note_number", ["shop_id", "credit_note_number"], True),
        ("ix_invoice_returns_shop_invoice", ["shop_id", "invoice_id"], False),
        ("ix_invoice_returns_shop_created", ["shop_id", "created_at"], False),
    ):
        _create_index_if_missing(index_name, "invoice_returns", columns, unique=unique)

    if not _has_table("invoice_return_items"):
        op.create_table(
            "invoice_return_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("return_id", sa.Integer(), nullable=False),
            sa.Column("invoice_item_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=True),
            sa.Column("product_code", sa.String(length=100), nullable=False),
            sa.Column("product_name_snapshot", sa.String(length=255), nullable=False),
            sa.Column("hsn_sac_snapshot", sa.String(length=20), nullable=True),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit_taxable_value", sa.Numeric(12, 2), nullable=False),
            sa.Column("gst_rate", sa.Numeric(5, 2), nullable=False),
            sa.Column("cgst_rate", sa.Numeric(5, 2), nullable=False),
            sa.Column("sgst_rate", sa.Numeric(5, 2), nullable=False),
            sa.Column("igst_rate", sa.Numeric(5, 2), nullable=False),
            sa.Column("taxable_value", sa.Numeric(12, 2), nullable=False),
            sa.Column("cgst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("sgst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("igst_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_tax_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_buy_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_profit", sa.Numeric(12, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["invoice_item_id"], ["invoice_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["return_id"], ["invoice_returns.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    for index_name, columns, unique in (
        ("ix_invoice_return_items_id", ["id"], False),
        ("ix_invoice_return_items_shop_id", ["shop_id"], False),
        ("ix_invoice_return_items_return_id", ["return_id"], False),
        ("ix_invoice_return_items_invoice_item_id", ["invoice_item_id"], False),
        ("ix_invoice_return_items_product_id", ["product_id"], False),
        ("ix_invoice_return_items_shop_invoice_item", ["shop_id", "invoice_item_id"], False),
    ):
        _create_index_if_missing(index_name, "invoice_return_items", columns, unique=unique)

    if not _has_table("invoice_refunds"):
        op.create_table(
            "invoice_refunds",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("invoice_id", sa.Integer(), nullable=False),
            sa.Column("return_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("refund_method", sa.String(length=30), nullable=False),
            sa.Column("reference", sa.String(length=150), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("client_request_id", sa.String(length=100), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("refunded_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["return_id"], ["invoice_returns.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    for index_name, columns, unique in (
        ("ix_invoice_refunds_id", ["id"], False),
        ("ix_invoice_refunds_shop_id", ["shop_id"], False),
        ("ix_invoice_refunds_invoice_id", ["invoice_id"], False),
        ("ix_invoice_refunds_return_id", ["return_id"], False),
        ("ix_invoice_refunds_created_by", ["created_by"], False),
        ("uq_invoice_refunds_shop_return_request", ["shop_id", "return_id", "client_request_id"], True),
        ("ix_invoice_refunds_shop_invoice", ["shop_id", "invoice_id"], False),
        ("ix_invoice_refunds_shop_return", ["shop_id", "return_id"], False),
        ("ix_invoice_refunds_shop_refunded", ["shop_id", "refunded_at"], False),
    ):
        _create_index_if_missing(index_name, "invoice_refunds", columns, unique=unique)


def downgrade() -> None:
    for table_name, indexes in (
        (
            "invoice_refunds",
            (
                "ix_invoice_refunds_shop_refunded",
                "ix_invoice_refunds_shop_return",
                "ix_invoice_refunds_shop_invoice",
                "uq_invoice_refunds_shop_return_request",
                "ix_invoice_refunds_created_by",
                "ix_invoice_refunds_return_id",
                "ix_invoice_refunds_invoice_id",
                "ix_invoice_refunds_shop_id",
                "ix_invoice_refunds_id",
            ),
        ),
        (
            "invoice_return_items",
            (
                "ix_invoice_return_items_shop_invoice_item",
                "ix_invoice_return_items_product_id",
                "ix_invoice_return_items_invoice_item_id",
                "ix_invoice_return_items_return_id",
                "ix_invoice_return_items_shop_id",
                "ix_invoice_return_items_id",
            ),
        ),
        (
            "invoice_returns",
            (
                "ix_invoice_returns_shop_created",
                "ix_invoice_returns_shop_invoice",
                "uq_invoice_returns_shop_credit_note_number",
                "uq_invoice_returns_shop_return_number",
                "uq_invoice_returns_shop_request",
                "ix_invoice_returns_created_by",
                "ix_invoice_returns_credit_note_number",
                "ix_invoice_returns_return_number",
                "ix_invoice_returns_invoice_id",
                "ix_invoice_returns_shop_id",
                "ix_invoice_returns_id",
            ),
        ),
        (
            "invoice_reversal_sequences",
            (
                "uq_invoice_reversal_sequences_scope",
                "ix_invoice_reversal_sequences_shop_id",
                "ix_invoice_reversal_sequences_id",
            ),
        ),
    ):
        if _has_table(table_name):
            for index_name in indexes:
                if _has_index(table_name, index_name):
                    op.drop_index(index_name, table_name=table_name)
            op.drop_table(table_name)
