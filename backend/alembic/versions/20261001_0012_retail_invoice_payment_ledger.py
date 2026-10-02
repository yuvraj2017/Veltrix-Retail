"""retail invoice payment ledger

Revision ID: 20261001_0012
Revises: 20261001_0011
Create Date: 2026-10-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261001_0012"
down_revision = "20261001_0011"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table("invoice_payments"):
        op.create_table(
            "invoice_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("invoice_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("payment_method", sa.String(length=30), nullable=False),
            sa.Column("payment_reference", sa.String(length=150), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("client_request_id", sa.String(length=100), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column(
                "received_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_invoice_payments_id", "invoice_payments", ["id"], unique=False)
        op.create_index("ix_invoice_payments_shop_id", "invoice_payments", ["shop_id"], unique=False)
        op.create_index("ix_invoice_payments_invoice_id", "invoice_payments", ["invoice_id"], unique=False)
        op.create_index("ix_invoice_payments_created_by", "invoice_payments", ["created_by"], unique=False)

    if _has_table("invoice_payments"):
        if not _has_index("invoice_payments", "uq_invoice_payments_shop_invoice_request"):
            op.create_index(
                "uq_invoice_payments_shop_invoice_request",
                "invoice_payments",
                ["shop_id", "invoice_id", "client_request_id"],
                unique=True,
            )
        if not _has_index("invoice_payments", "ix_invoice_payments_shop_invoice"):
            op.create_index(
                "ix_invoice_payments_shop_invoice",
                "invoice_payments",
                ["shop_id", "invoice_id"],
                unique=False,
            )
        if not _has_index("invoice_payments", "ix_invoice_payments_shop_received"):
            op.create_index(
                "ix_invoice_payments_shop_received",
                "invoice_payments",
                ["shop_id", "received_at"],
                unique=False,
            )

    if _has_table("invoice_payments") and _has_table("invoices"):
        bind.execute(
            sa.text(
                """
                INSERT INTO invoice_payments (
                    shop_id,
                    invoice_id,
                    amount,
                    payment_method,
                    payment_reference,
                    notes,
                    status,
                    client_request_id,
                    request_fingerprint,
                    received_at,
                    created_by,
                    created_at
                )
                SELECT
                    invoices.shop_id,
                    invoices.id,
                    invoices.paid_amount,
                    CASE
                        WHEN invoices.payment_mode IN ('cash', 'upi', 'card', 'bank_transfer', 'other')
                            THEN invoices.payment_mode
                        ELSE 'other'
                    END,
                    NULL,
                    'Migrated from legacy invoice paid amount',
                    'completed',
                    'legacy-invoice-' || CAST(invoices.id AS VARCHAR),
                    'legacy',
                    COALESCE(invoices.created_at, CURRENT_TIMESTAMP),
                    invoices.created_by,
                    COALESCE(invoices.created_at, CURRENT_TIMESTAMP)
                FROM invoices
                WHERE invoices.paid_amount > 0
                  AND NOT EXISTS (
                    SELECT 1
                    FROM invoice_payments
                    WHERE invoice_payments.invoice_id = invoices.id
                  )
                """
            )
        )


def downgrade() -> None:
    if _has_table("invoice_payments"):
        for index_name in (
            "ix_invoice_payments_shop_received",
            "ix_invoice_payments_shop_invoice",
            "uq_invoice_payments_shop_invoice_request",
            "ix_invoice_payments_created_by",
            "ix_invoice_payments_invoice_id",
            "ix_invoice_payments_shop_id",
            "ix_invoice_payments_id",
        ):
            if _has_index("invoice_payments", index_name):
                op.drop_index(index_name, table_name="invoice_payments")
        op.drop_table("invoice_payments")
