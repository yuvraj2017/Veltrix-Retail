"""invoice idempotency and lifecycle foundation

Revision ID: 20261001_0011
Revises: 20261001_0010
Create Date: 2026-10-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261001_0011"
down_revision = "20261001_0010"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()

    if _has_table("invoices") and not _has_column("invoices", "finalized_at"):
        op.add_column(
            "invoices",
            sa.Column("finalized_at", sa.DateTime(timezone=False), nullable=True),
        )
        bind.execute(
            sa.text(
                """
                UPDATE invoices
                SET finalized_at = COALESCE(created_at, CURRENT_TIMESTAMP)
                WHERE invoice_status = 'saved' AND finalized_at IS NULL
                """
            )
        )

    if not _has_table("invoice_idempotency_keys"):
        op.create_table(
            "invoice_idempotency_keys",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("client_request_id", sa.String(length=100), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("invoice_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_invoice_idempotency_keys_id",
            "invoice_idempotency_keys",
            ["id"],
            unique=False,
        )
        op.create_index(
            "ix_invoice_idempotency_keys_shop_id",
            "invoice_idempotency_keys",
            ["shop_id"],
            unique=False,
        )
        op.create_index(
            "ix_invoice_idempotency_keys_invoice_id",
            "invoice_idempotency_keys",
            ["invoice_id"],
            unique=False,
        )

    if _has_table("invoice_idempotency_keys"):
        if not _has_index(
            "invoice_idempotency_keys",
            "uq_invoice_idempotency_shop_request",
        ):
            op.create_index(
                "uq_invoice_idempotency_shop_request",
                "invoice_idempotency_keys",
                ["shop_id", "client_request_id"],
                unique=True,
            )
        if not _has_index(
            "invoice_idempotency_keys",
            "ix_invoice_idempotency_shop_created",
        ):
            op.create_index(
                "ix_invoice_idempotency_shop_created",
                "invoice_idempotency_keys",
                ["shop_id", "created_at"],
                unique=False,
            )


def downgrade() -> None:
    # Non-destructive for invoice lifecycle metadata. Dropping idempotency records
    # is acceptable only when explicitly downgrading this foundation migration.
    if _has_table("invoice_idempotency_keys"):
        for index_name in (
            "ix_invoice_idempotency_shop_created",
            "uq_invoice_idempotency_shop_request",
            "ix_invoice_idempotency_keys_invoice_id",
            "ix_invoice_idempotency_keys_shop_id",
            "ix_invoice_idempotency_keys_id",
        ):
            if _has_index("invoice_idempotency_keys", index_name):
                op.drop_index(index_name, table_name="invoice_idempotency_keys")
        op.drop_table("invoice_idempotency_keys")
