"""core schema baseline

Revision ID: 20260925_0000
Revises:
Create Date: 2026-09-25
"""

from __future__ import annotations

from alembic import op

from app import models  # noqa: F401
from app.core.database import Base


revision = "20260925_0000"
down_revision = None
branch_labels = None
depends_on = None


# Original POS/inventory tables that predate the subscription migrations.  The
# migration is defensive so an existing database created by the old startup
# create_all() path can pass through it without table recreation.
CORE_TABLES = (
    "shops",
    "users",
    "customers",
    "vendors",
    "vendor_bills",
    "vendor_bill_payments",
    "products",
    "product_images",
    "invoices",
    "invoice_items",
    "product_sales_analytics",
    "expenses",
    "password_reset_tokens",
    "admin_audit_logs",
)


def upgrade() -> None:
    bind = op.get_bind()
    metadata = Base.metadata
    core_table_names = set(CORE_TABLES)

    for table in metadata.sorted_tables:
        if table.name in core_table_names:
            table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    # Intentionally no-op.  This baseline exists to bring existing populated
    # databases under Alembic management and must not drop business data.
    pass
