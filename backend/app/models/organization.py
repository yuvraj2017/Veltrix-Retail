from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Organization(Base, IDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name = Column(String(150), nullable=False)
    status = Column(String(20), nullable=False, default="active", server_default="active")

    shops = relationship("Shop", back_populates="organization", passive_deletes=True)
    memberships = relationship(
        "OrganizationMembership",
        back_populates="organization",
        passive_deletes=True,
    )
