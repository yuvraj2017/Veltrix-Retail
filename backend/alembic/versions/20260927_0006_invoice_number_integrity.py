"""invoice number integrity

Revision ID: 20260927_0006
Revises: 20260927_0005
Create Date: 2026-09-27
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date

from alembic import op
import sqlalchemy as sa


revision = "20260927_0006"
down_revision = "20260927_0005"
branch_labels = None
depends_on = None


INVOICE_NUMBER_PATTERN = re.compile(r"^INV-(\d{8})-(\d+)$")


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_unique_invoice_index() -> bool:
    if not _has_table("invoices"):
        return False

    inspector = _inspector()
    for index in inspector.get_indexes("invoices"):
        if index.get("unique") and tuple(index.get("column_names") or ()) == (
            "shop_id",
            "invoice_number",
        ):
            return True

    for constraint in inspector.get_unique_constraints("invoices"):
        if tuple(constraint.get("column_names") or ()) == ("shop_id", "invoice_number"):
            return True

    return False


def _assert_no_duplicate_invoice_numbers() -> None:
    if not _has_table("invoices"):
        return

    duplicates = op.get_bind().execute(
        sa.text(
            """
            SELECT shop_id, invoice_number, COUNT(*) AS duplicate_count
            FROM invoices
            GROUP BY shop_id, invoice_number
            HAVING COUNT(*) > 1
            ORDER BY shop_id, invoice_number
            LIMIT 10
            """
        )
    ).mappings().all()

    if duplicates:
        examples = ", ".join(
            f"shop_id={row['shop_id']} invoice_number={row['invoice_number']} count={row['duplicate_count']}"
            for row in duplicates
        )
        raise RuntimeError(
            "Cannot add unique invoice-number protection because duplicate "
            f"(shop_id, invoice_number) values already exist: {examples}. "
            "Resolve duplicates manually before rerunning this migration."
        )


def _create_invoice_sequence_table() -> None:
    if _has_table("invoice_sequences"):
        return

    op.create_table(
        "invoice_sequences",
        sa.Column("shop_id", sa.Integer(), nullable=False),
        sa.Column("sequence_date", sa.Date(), nullable=False),
        sa.Column("last_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "shop_id",
            "sequence_date",
            name="uq_invoice_sequences_shop_date",
        ),
    )
    op.create_index(
        "ix_invoice_sequences_shop_date",
        "invoice_sequences",
        ["shop_id", "sequence_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_invoice_sequences_shop_id"),
        "invoice_sequences",
        ["shop_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_invoice_sequences_id"),
        "invoice_sequences",
        ["id"],
        unique=False,
    )


def _seed_invoice_sequences() -> None:
    if not _has_table("invoices") or not _has_table("invoice_sequences"):
        return

    bind = op.get_bind()
    sequence_max: dict[tuple[int, date], int] = defaultdict(int)
    rows = bind.execute(sa.text("SELECT shop_id, invoice_number FROM invoices"))

    for row in rows:
        match = INVOICE_NUMBER_PATTERN.match(row.invoice_number or "")
        if not match:
            continue

        date_part, number_part = match.groups()
        sequence_date = date(
            int(date_part[:4]),
            int(date_part[4:6]),
            int(date_part[6:8]),
        )
        key = (row.shop_id, sequence_date)
        sequence_max[key] = max(sequence_max[key], int(number_part))

    if not sequence_max:
        return

    invoice_sequences = sa.table(
        "invoice_sequences",
        sa.column("shop_id", sa.Integer),
        sa.column("sequence_date", sa.Date),
        sa.column("last_number", sa.Integer),
    )

    for (shop_id, sequence_date), last_number in sequence_max.items():
        exists = bind.execute(
            sa.select(invoice_sequences.c.last_number).where(
                invoice_sequences.c.shop_id == shop_id,
                invoice_sequences.c.sequence_date == sequence_date,
            )
        ).scalar()
        if exists is None:
            bind.execute(
                invoice_sequences.insert().values(
                    shop_id=shop_id,
                    sequence_date=sequence_date,
                    last_number=last_number,
                )
            )
        elif int(exists) < last_number:
            bind.execute(
                invoice_sequences.update()
                .where(
                    invoice_sequences.c.shop_id == shop_id,
                    invoice_sequences.c.sequence_date == sequence_date,
                )
                .values(last_number=last_number)
            )


def upgrade() -> None:
    _assert_no_duplicate_invoice_numbers()
    _create_invoice_sequence_table()
    _seed_invoice_sequences()

    if _has_table("invoices") and not _has_unique_invoice_index():
        op.create_index(
            "uq_invoices_shop_invoice_number",
            "invoices",
            ["shop_id", "invoice_number"],
            unique=True,
        )


def downgrade() -> None:
    # Keep downgrade non-destructive for Phase 1C.  Removing the sequence table
    # or invoice uniqueness would weaken production safety and can strand
    # already-issued invoice numbers.
    pass
