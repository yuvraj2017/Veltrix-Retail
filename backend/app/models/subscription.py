from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class ShopSubscription(Base, IDMixin, TimestampMixin):
    __tablename__ = "shop_subscriptions"
    __table_args__ = (
        Index("ix_shop_subscriptions_shop_status", "shop_id", "status"),
        Index("ix_shop_subscriptions_provider_subscription", "provider", "provider_subscription_id"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True)

    status = Column(String(30), nullable=False, index=True)
    billing_interval = Column(String(20), nullable=False)

    trial_start_at = Column(DateTime(timezone=True), nullable=True)
    trial_end_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancel_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    provider = Column(String(50), nullable=True)
    provider_customer_id = Column(String(150), nullable=True, index=True)
    provider_subscription_id = Column(String(150), nullable=True, index=True)

    shop = relationship("Shop")
    plan = relationship("Plan", back_populates="subscriptions")
    licenses = relationship(
        "ShopLicense",
        back_populates="subscription",
        cascade="all, delete-orphan",
    )
