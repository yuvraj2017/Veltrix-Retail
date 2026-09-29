"""stock safety foundation

Revision ID: 20260927_0007
Revises: 20260927_0006
Create Date: 2026-09-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260927_0007"
down_revision = "20260927_0006"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_check_constraint(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        constraint.get("name") == constraint_name
        for constraint in sa.inspect(op.get_bind()).get_check_constraints(table_name)
    )


def _assert_no_negative_stock() -> None:
    if not _has_table("products"):
        return

    rows = op.get_bind().execute(
        sa.text(
            """
            SELECT id, shop_id, sku, stock_quantity
            FROM products
            WHERE stock_quantity < 0
            ORDER BY shop_id, id
            LIMIT 10
            """
        )
    ).mappings().all()

    if rows:
        examples = ", ".join(
            f"id={row['id']} shop_id={row['shop_id']} sku={row['sku']} stock={row['stock_quantity']}"
            for row in rows
        )
        raise RuntimeError(
            "Cannot add non-negative stock protection because products with "
            f"negative stock already exist: {examples}. Resolve these rows "
            "manually before rerunning this migration."
        )


def upgrade() -> None:
    _assert_no_negative_stock()

    if op.get_bind().dialect.name == "sqlite":
        return

    if _has_table("products") and not _has_check_constraint(
        "products",
        "ck_products_stock_quantity_non_negative",
    ):
        op.create_check_constraint(
            "ck_products_stock_quantity_non_negative",
            "products",
            "stock_quantity >= 0",
        )


def downgrade() -> None:
    # Intentionally keep the safety boundary in place.
    pass
