from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from app.core.shop_status import ShopStatus
from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Shop(Base, IDMixin, TimestampMixin):
    __tablename__ = "shops"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'active', 'inactive')",
            name="ck_shops_status",
        ),
        Index("ix_shops_organization_id", "organization_id"),
        Index("ix_shops_organization_status", "organization_id", "status"),
        Index(
            "uq_shops_id_organization",
            "id",
            "organization_id",
            unique=True,
        ),
        Index(
            "uq_shops_organization_default_branch",
            "organization_id",
            unique=True,
            postgresql_where=text("is_default_branch"),
            sqlite_where=text("is_default_branch = 1"),
        ),
    )

    organization_id = Column(
        ForeignKey(
            "organizations.id",
            name="fk_shops_organization_id_organizations",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        nullable=False,
    )
    is_default_branch = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    status = Column(
        String(20),
        nullable=False,
        default=ShopStatus.ACTIVE,
        server_default=ShopStatus.ACTIVE,
    )

    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False)
    whatsapp_number = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    logo_url = Column(String(255), nullable=True)
    gst_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    gstin = Column(String(15), nullable=True)
    state = Column(String(100), nullable=True)
    gst_state_code = Column(String(2), nullable=True)

    organization = relationship(
        "Organization",
        back_populates="shops",
        foreign_keys=[organization_id],
    )
    users = relationship("User", back_populates="shop", cascade="all, delete-orphan")
    branch_memberships = relationship(
        "BranchMembership",
        back_populates="shop",
        passive_deletes=True,
        overlaps="branch_memberships,organization_membership",
    )
