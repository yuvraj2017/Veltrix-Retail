from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Plan(Base, IDMixin, TimestampMixin):
    __tablename__ = "plans"

    code = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    monthly_price = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    annual_price = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    currency = Column(String(3), nullable=False, default="INR", server_default="INR")

    trial_days = Column(Integer, nullable=False, default=0, server_default="0")
    grace_period_days = Column(Integer, nullable=False, default=0, server_default="0")

    is_active = Column(Boolean, nullable=False, default=True, server_default="true", index=True)
    is_archived = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    display_order = Column(Integer, nullable=False, default=0, server_default="0")

    entitlements = relationship(
        "PlanEntitlement",
        back_populates="plan",
        cascade="all, delete-orphan",
    )
    subscriptions = relationship("ShopSubscription", back_populates="plan")
