from sqlalchemy import Column, ForeignKeyConstraint, Index, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Organization(Base, IDMixin, TimestampMixin):
    __tablename__ = "organizations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["commercial_source_shop_id", "id"],
            ["shops.id", "shops.organization_id"],
            name="fk_organizations_commercial_source_shop_organization",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        Index(
            "ix_organizations_commercial_source_shop_id",
            "commercial_source_shop_id",
        ),
    )

    # This primary key also participates in the composite source FK. Without
    # ``ignore_fk`` SQLAlchemy disables integer autoincrement for new tenants.
    id = Column(Integer, primary_key=True, index=True, autoincrement="ignore_fk")
    name = Column(String(150), nullable=False)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    commercial_source_shop_id = Column(Integer, nullable=True)

    shops = relationship(
        "Shop",
        back_populates="organization",
        passive_deletes=True,
        foreign_keys="Shop.organization_id",
    )
    commercial_source_shop = relationship(
        "Shop",
        foreign_keys=[commercial_source_shop_id],
        primaryjoin=(
            "and_(Organization.commercial_source_shop_id == Shop.id, "
            "Organization.id == Shop.organization_id)"
        ),
        post_update=True,
        uselist=False,
    )
    memberships = relationship(
        "OrganizationMembership",
        back_populates="organization",
        passive_deletes=True,
    )
