"""membership foundation

Revision ID: 20261003_0019
Revises: 20261003_0018
Create Date: 2026-10-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20261003_0019"
down_revision = "20261003_0018"
branch_labels = None
depends_on = None


MEMBERSHIP_ROLES = (
    "owner",
    "admin",
    "manager",
    "cashier",
    "inventory_manager",
    "purchasing_manager",
    "report_viewer",
)
MEMBERSHIP_STATUSES = ("active", "inactive")


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table: str) -> bool:
    return _inspector().has_table(table)


def _has_index(table: str, name: str) -> bool:
    return any(item.get("name") == name for item in _inspector().get_indexes(table))


def _validate_legacy_users(bind) -> None:
    invalid = bind.execute(
        sa.text(
            """
            SELECT u.id, u.role, u.shop_id
            FROM users AS u
            LEFT JOIN shops AS s ON s.id = u.shop_id
            WHERE (u.shop_id IS NOT NULL AND (u.role <> 'owner' OR s.id IS NULL OR s.organization_id IS NULL))
               OR (u.shop_id IS NULL AND u.role <> 'super_admin')
               OR (u.role = 'super_admin' AND u.shop_id IS NOT NULL)
            ORDER BY u.id
            LIMIT 1
            """
        )
    ).first()
    if invalid:
        raise RuntimeError(
            "Unsupported user membership backfill mapping: "
            f"user_id={invalid.id}, role={invalid.role!r}, shop_id={invalid.shop_id!r}"
        )


def _create_schema() -> None:
    if not _has_index("shops", "uq_shops_id_organization"):
        op.create_index(
            "uq_shops_id_organization",
            "shops",
            ["id", "organization_id"],
            unique=True,
        )

    if not _has_table("organization_memberships"):
        op.create_table(
            "organization_memberships",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("organization_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("role", sa.String(length=40), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint(
                f"role IN ({_quoted(MEMBERSHIP_ROLES)})",
                name="ck_organization_memberships_role",
            ),
            sa.CheckConstraint(
                f"status IN ({_quoted(MEMBERSHIP_STATUSES)})",
                name="ck_organization_memberships_status",
            ),
            sa.ForeignKeyConstraint(
                ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.ForeignKeyConstraint(
                ["organization_id"], ["organizations.id"], ondelete="RESTRICT"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "organization_id",
                "user_id",
                name="uq_organization_memberships_organization_user",
            ),
            sa.UniqueConstraint(
                "id",
                "organization_id",
                name="uq_organization_memberships_id_organization",
            ),
        )
    if not _has_index(
        "organization_memberships", "ix_organization_memberships_user_status"
    ):
        op.create_index(
            "ix_organization_memberships_user_status",
            "organization_memberships",
            ["user_id", "status"],
        )
    if not _has_index(
        "organization_memberships",
        "ix_organization_memberships_organization_status",
    ):
        op.create_index(
            "ix_organization_memberships_organization_status",
            "organization_memberships",
            ["organization_id", "status"],
        )

    if not _has_table("branch_memberships"):
        op.create_table(
            "branch_memberships",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("organization_membership_id", sa.Integer(), nullable=False),
            sa.Column("organization_id", sa.Integer(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint(
                f"status IN ({_quoted(MEMBERSHIP_STATUSES)})",
                name="ck_branch_memberships_status",
            ),
            sa.ForeignKeyConstraint(
                ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.ForeignKeyConstraint(
                ["organization_membership_id", "organization_id"],
                ["organization_memberships.id", "organization_memberships.organization_id"],
                name="fk_branch_memberships_membership_organization",
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["shop_id", "organization_id"],
                ["shops.id", "shops.organization_id"],
                name="fk_branch_memberships_shop_organization",
                ondelete="RESTRICT",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "organization_membership_id",
                "shop_id",
                name="uq_branch_memberships_membership_shop",
            ),
        )
    if not _has_index("branch_memberships", "ix_branch_memberships_shop_status"):
        op.create_index(
            "ix_branch_memberships_shop_status",
            "branch_memberships",
            ["shop_id", "status"],
        )
    if not _has_index(
        "branch_memberships", "ix_branch_memberships_membership_status"
    ):
        op.create_index(
            "ix_branch_memberships_membership_status",
            "branch_memberships",
            ["organization_membership_id", "status"],
        )


def _backfill(bind) -> None:
    bind.execute(
        sa.text(
            """
            INSERT INTO organization_memberships (
                organization_id, user_id, role, status, created_by_user_id, created_at, updated_at
            )
            SELECT s.organization_id, u.id, 'owner', 'active', NULL, u.created_at, u.updated_at
            FROM users AS u
            JOIN shops AS s ON s.id = u.shop_id
            WHERE u.role = 'owner'
            ORDER BY u.id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO branch_memberships (
                organization_membership_id, organization_id, shop_id, status,
                created_by_user_id, created_at, updated_at
            )
            SELECT om.id, om.organization_id, u.shop_id, 'active', NULL, u.created_at, u.updated_at
            FROM users AS u
            JOIN shops AS s ON s.id = u.shop_id
            JOIN organization_memberships AS om
              ON om.user_id = u.id AND om.organization_id = s.organization_id
            WHERE u.role = 'owner'
            ORDER BY u.id
            """
        )
    )


def _validate_backfill(bind) -> None:
    eligible = bind.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE shop_id IS NOT NULL AND role = 'owner'")
    ).scalar_one()
    organization_memberships = bind.execute(
        sa.text("SELECT COUNT(*) FROM organization_memberships")
    ).scalar_one()
    branch_memberships = bind.execute(
        sa.text("SELECT COUNT(*) FROM branch_memberships")
    ).scalar_one()
    if organization_memberships != eligible or branch_memberships != eligible:
        raise RuntimeError(
            "Membership backfill count mismatch: "
            f"eligible={eligible}, organization_memberships={organization_memberships}, "
            f"branch_memberships={branch_memberships}"
        )

    invalid = bind.execute(
        sa.text(
            """
            SELECT bm.id
            FROM branch_memberships AS bm
            JOIN organization_memberships AS om ON om.id = bm.organization_membership_id
            JOIN shops AS s ON s.id = bm.shop_id
            WHERE bm.organization_id <> om.organization_id
               OR bm.organization_id <> s.organization_id
            LIMIT 1
            """
        )
    ).first()
    if invalid:
        raise RuntimeError(f"Cross-organization branch membership detected: {invalid.id}")

    missing = bind.execute(
        sa.text(
            """
            SELECT u.id
            FROM users AS u
            JOIN shops AS s ON s.id = u.shop_id
            LEFT JOIN organization_memberships AS om
              ON om.user_id = u.id AND om.organization_id = s.organization_id
            LEFT JOIN branch_memberships AS bm
              ON bm.organization_membership_id = om.id AND bm.shop_id = u.shop_id
            WHERE u.role = 'owner' AND (om.id IS NULL OR bm.id IS NULL)
            LIMIT 1
            """
        )
    ).first()
    if missing:
        raise RuntimeError(f"Membership backfill missed user {missing.id}")

    super_admin_membership = bind.execute(
        sa.text(
            """
            SELECT om.id
            FROM organization_memberships AS om
            JOIN users AS u ON u.id = om.user_id
            WHERE u.role = 'super_admin'
            LIMIT 1
            """
        )
    ).first()
    if super_admin_membership:
        raise RuntimeError("Platform super-admin received a tenant membership")


def upgrade() -> None:
    bind = op.get_bind()
    _validate_legacy_users(bind)
    _create_schema()
    _backfill(bind)
    _validate_backfill(bind)


def downgrade() -> None:
    op.drop_index(
        "ix_branch_memberships_membership_status",
        table_name="branch_memberships",
    )
    op.drop_index("ix_branch_memberships_shop_status", table_name="branch_memberships")
    op.drop_table("branch_memberships")
    op.drop_index(
        "ix_organization_memberships_organization_status",
        table_name="organization_memberships",
    )
    op.drop_index(
        "ix_organization_memberships_user_status",
        table_name="organization_memberships",
    )
    op.drop_table("organization_memberships")
    op.drop_index("uq_shops_id_organization", table_name="shops")
