"""gst tax foundation

Revision ID: 20261001_0009
Revises: 20260927_0008
Create Date: 2026-10-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261001_0009"
down_revision = "20260927_0008"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing(
        "shops",
        sa.Column("gst_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    _add_column_if_missing("shops", sa.Column("gstin", sa.String(length=15), nullable=True))
    _add_column_if_missing("shops", sa.Column("state", sa.String(length=100), nullable=True))
    _add_column_if_missing("shops", sa.Column("gst_state_code", sa.String(length=2), nullable=True))

    _add_column_if_missing("products", sa.Column("hsn_sac", sa.String(length=20), nullable=True))
    _add_column_if_missing(
        "products",
        sa.Column("gst_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
    )

    _add_column_if_missing("invoices", sa.Column("customer_state_code_snapshot", sa.String(length=2), nullable=True))
    _add_column_if_missing("invoices", sa.Column("seller_gst_number_snapshot", sa.String(length=15), nullable=True))
    _add_column_if_missing("invoices", sa.Column("seller_state_snapshot", sa.String(length=100), nullable=True))
    _add_column_if_missing("invoices", sa.Column("seller_state_code_snapshot", sa.String(length=2), nullable=True))
    _add_column_if_missing(
        "invoices",
        sa.Column("tax_treatment", sa.String(length=20), server_default="non_gst", nullable=False),
    )

    _add_column_if_missing("invoice_items", sa.Column("hsn_sac_snapshot", sa.String(length=20), nullable=True))
    _add_column_if_missing(
        "invoice_items",
        sa.Column("gst_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("taxable_value", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("cgst_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("cgst_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("sgst_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("sgst_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("igst_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("igst_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    _add_column_if_missing(
        "invoice_items",
        sa.Column("total_tax_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
    )


def downgrade() -> None:
    # Keep downgrade non-destructive for Phase 2B. Removing tax snapshot fields
    # from a live database would destroy invoice history needed for compliance.
    pass
