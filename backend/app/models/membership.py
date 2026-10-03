from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.membership import MembershipRole, MembershipStatus
from app.models.base import IDMixin, TimestampMixin


def _sql_values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class OrganizationMembership(Base, IDMixin, TimestampMixin):
    __tablename__ = "organization_memberships"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_organization_memberships_organization_user",
        ),
        UniqueConstraint(
            "id",
            "organization_id",
            name="uq_organization_memberships_id_organization",
        ),
        CheckConstraint(
            f"role IN ({_sql_values(MembershipRole.ALL)})",
            name="ck_organization_memberships_role",
        ),
        CheckConstraint(
            f"status IN ({_sql_values(MembershipStatus.ALL)})",
            name="ck_organization_memberships_status",
        ),
        Index(
            "ix_organization_memberships_user_status",
            "user_id",
            "status",
        ),
        Index(
            "ix_organization_memberships_organization_status",
            "organization_id",
            "status",
        ),
    )

    organization_id = Column(
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id = Column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    role = Column(String(40), nullable=False)
    status = Column(String(20), nullable=False)
    created_by_user_id = Column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    organization = relationship("Organization", back_populates="memberships")
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    branch_memberships = relationship(
        "BranchMembership",
        back_populates="organization_membership",
        passive_deletes=True,
        overlaps="branch_memberships,shop",
    )


class BranchMembership(Base, IDMixin, TimestampMixin):
    __tablename__ = "branch_memberships"

    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_membership_id", "organization_id"],
            [
                "organization_memberships.id",
                "organization_memberships.organization_id",
            ],
            name="fk_branch_memberships_membership_organization",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["shop_id", "organization_id"],
            ["shops.id", "shops.organization_id"],
            name="fk_branch_memberships_shop_organization",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "organization_membership_id",
            "shop_id",
            name="uq_branch_memberships_membership_shop",
        ),
        CheckConstraint(
            f"status IN ({_sql_values(MembershipStatus.ALL)})",
            name="ck_branch_memberships_status",
        ),
        Index(
            "ix_branch_memberships_shop_status",
            "shop_id",
            "status",
        ),
        Index(
            "ix_branch_memberships_membership_status",
            "organization_membership_id",
            "status",
        ),
    )

    organization_membership_id = Column(Integer, nullable=False)
    organization_id = Column(Integer, nullable=False)
    shop_id = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)
    created_by_user_id = Column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    organization_membership = relationship(
        "OrganizationMembership",
        back_populates="branch_memberships",
        foreign_keys=[organization_membership_id, organization_id],
        overlaps="branch_memberships,shop",
    )
    shop = relationship(
        "Shop",
        back_populates="branch_memberships",
        foreign_keys=[shop_id, organization_id],
        overlaps="branch_memberships,organization_membership",
    )
    created_by = relationship("User", foreign_keys=[created_by_user_id])
