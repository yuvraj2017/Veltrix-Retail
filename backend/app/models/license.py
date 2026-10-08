from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class ShopLicense(Base, IDMixin, TimestampMixin):
    __tablename__ = "shop_licenses"
    __table_args__ = (
        Index("ix_shop_licenses_shop_status", "shop_id", "status"),
        CheckConstraint(
            "status IN ('pending', 'active', 'suspended', 'expired', 'revoked')",
            name="ck_shop_licenses_status",
        ),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(
        ForeignKey("shop_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    license_key_hash = Column(String(128), nullable=False, unique=True, index=True)
    license_key_prefix = Column(String(20), nullable=False)
    license_key_suffix = Column(String(20), nullable=False)
    masked_key = Column(String(80), nullable=False)

    status = Column(String(30), nullable=False, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    shop = relationship("Shop")
    subscription = relationship("ShopSubscription", back_populates="licenses")
