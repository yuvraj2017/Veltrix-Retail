"""move startup schema repairs into alembic

Revision ID: 20260927_0005
Revises: 20260925_0004
Create Date: 2026-09-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260927_0005"
down_revision = "20260925_0004"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _columns(table_name: str) -> dict[str, dict]:
    if not _has_table(table_name):
        return {}
    return {column["name"]: column for column in _inspector().get_columns(table_name)}


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in _columns(table_name)


def _index_leading_columns_exist(table_name: str, columns: tuple[str, ...]) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        tuple(index.get("column_names") or ())[: len(columns)] == columns
        for index in _inspector().get_indexes(table_name)
    )


def _create_index_if_missing(table_name: str, index_name: str, columns: tuple[str, ...]) -> None:
    if not _has_table(table_name) or _index_leading_columns_exist(table_name, columns):
        return

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.create_index(
                index_name,
                table_name,
                list(columns),
                postgresql_concurrently=True,
            )
    else:
        op.create_index(index_name, table_name, list(columns))


def upgrade() -> None:
    if _has_table("invoices"):
        if not _has_column("invoices", "billed_amount"):
            op.add_column(
                "invoices",
                sa.Column(
                    "billed_amount",
                    sa.Numeric(12, 2),
                    nullable=False,
                    server_default="0",
                ),
            )
        if not _has_column("invoices", "extra_discount_amount"):
            op.add_column(
                "invoices",
                sa.Column(
                    "extra_discount_amount",
                    sa.Numeric(12, 2),
                    nullable=False,
                    server_default="0",
                ),
            )
        op.execute(
            sa.text(
                "UPDATE invoices "
                "SET billed_amount = final_amount "
                "WHERE COALESCE(billed_amount, 0) = 0 "
                "AND COALESCE(final_amount, 0) <> 0"
            )
        )

    if _has_table("users"):
        if not _has_column("users", "status"):
            op.add_column(
                "users",
                sa.Column(
                    "status",
                    sa.String(length=20),
                    nullable=False,
                    server_default="active",
                ),
            )
        if not _has_column("users", "status_reason"):
            op.add_column("users", sa.Column("status_reason", sa.Text(), nullable=True))
        if not _has_column("users", "status_changed_at"):
            op.add_column(
                "users",
                sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
            )
        if not _has_column("users", "last_login_at"):
            op.add_column(
                "users",
                sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            )

        op.execute(
            sa.text(
                "UPDATE users SET status = 'disabled' "
                "WHERE is_active = false AND status = 'active'"
            )
        )

        shop_id_column = _columns("users").get("shop_id")
        if shop_id_column is not None and not shop_id_column.get("nullable", True):
            op.alter_column(
                "users",
                "shop_id",
                existing_type=sa.Integer(),
                nullable=True,
            )

    for table_name, index_name, columns in (
        ("invoices", "ix_invoices_shop_id_invoice_date", ("shop_id", "invoice_date")),
        ("invoices", "ix_invoices_shop_id_created_at", ("shop_id", "created_at")),
        ("invoices", "ix_invoices_shop_id_payment_status", ("shop_id", "payment_status")),
        (
            "product_sales_analytics",
            "ix_product_sales_analytics_shop_id_invoice_date",
            ("shop_id", "invoice_date"),
        ),
        ("products", "ix_products_shop_id_created_at", ("shop_id", "created_at")),
        ("users", "ix_users_status", ("status",)),
    ):
        _create_index_if_missing(table_name, index_name, columns)


def downgrade() -> None:
    # Intentionally no-op.  This revision replaces additive startup repairs and
    # must not remove columns, indexes, or backfilled production data.
    pass
