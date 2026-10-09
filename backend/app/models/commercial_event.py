from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class SubscriptionPaymentStatus:
    PENDING = "pending"
    SUBMITTED = "submitted"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"

    ALL = (PENDING, SUBMITTED, SUCCEEDED, FAILED, REFUNDED)


class SubscriptionPayment(Base, IDMixin, TimestampMixin):
    __tablename__ = "subscription_payments"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_payment_id",
            name="uq_subscription_payments_provider_payment",
        ),
        UniqueConstraint(
            "provider",
            "customer_reference",
            name="uq_subscription_payments_provider_customer_reference",
        ),
        UniqueConstraint(
            "provider",
            "provider_order_id",
            name="uq_subscription_payments_provider_order",
        ),
        UniqueConstraint(
            "provider",
            "provider_event_id",
            name="uq_subscription_payments_provider_event",
        ),
        CheckConstraint(
            "status IN ('pending', 'submitted', 'succeeded', 'failed', 'refunded')",
            name="ck_subscription_payments_status",
        ),
        CheckConstraint(
            "billing_interval IS NULL OR billing_interval IN ('monthly', 'annual', 'legacy')",
            name="ck_subscription_payments_billing_interval",
        ),
        CheckConstraint(
            "catalog_version_id IS NULL OR plan_id IS NOT NULL",
            name="ck_subscription_payments_catalog_version_has_plan",
        ),
        ForeignKeyConstraint(
            ["catalog_version_id", "plan_id"],
            ["plan_catalog_versions.id", "plan_catalog_versions.plan_id"],
            name="fk_subscription_payments_catalog_version_plan",
            ondelete="RESTRICT",
        ),
        Index("ix_subscription_payments_shop_status", "shop_id", "status"),
        Index("ix_subscription_payments_provider_event", "provider", "provider_event_id"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(ForeignKey("plans.id", ondelete="SET NULL"), nullable=True, index=True)
    catalog_version_id = Column(
        Integer,
        nullable=True,
        index=True,
    )
    subscription_id = Column(
        ForeignKey("shop_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    provider = Column(String(50), nullable=False)
    provider_payment_id = Column(String(150), nullable=False)
    provider_order_id = Column(String(150), nullable=True, index=True)
    provider_event_id = Column(String(150), nullable=True, index=True)

    status = Column(String(30), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    billing_interval = Column(String(20), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    customer_reference = Column(String(100), nullable=True, index=True)
    reviewed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    failure_reason = Column(Text, nullable=True)

    shop = relationship("Shop")
    plan = relationship("Plan")
    catalog_version = relationship("PlanCatalogVersion", viewonly=True, overlaps="plan")
    subscription = relationship("ShopSubscription")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])


class PaymentWebhookEvent(Base, IDMixin, TimestampMixin):
    __tablename__ = "payment_webhook_events"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_event_id",
            name="uq_payment_webhook_events_provider_event",
        ),
        CheckConstraint(
            "status IN ('processing', 'applied', 'duplicate')",
            name="ck_payment_webhook_events_status",
        ),
        Index("ix_payment_webhook_events_provider_created", "provider", "created_at"),
    )

    provider = Column(String(50), nullable=False)
    provider_event_id = Column(String(150), nullable=False)
    event_type = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="processing", server_default="processing")
    payment_id = Column(
        ForeignKey("subscription_payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload_sha256 = Column(String(64), nullable=False)

    payment = relationship("SubscriptionPayment")


class PaymentGatewayConfig(Base, IDMixin, TimestampMixin):
    __tablename__ = "payment_gateway_configs"
    __table_args__ = (
        UniqueConstraint("provider", name="uq_payment_gateway_configs_provider"),
        Index("ix_payment_gateway_configs_provider_active", "provider", "is_active"),
    )

    provider = Column(String(50), nullable=False)
    display_name = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_test_mode = Column(Boolean, nullable=False, default=True, server_default="true")

    key_id = Column(String(150), nullable=True)
    key_secret_encrypted = Column(Text, nullable=True)
    webhook_secret_encrypted = Column(Text, nullable=True)
    settings_encrypted = Column(Text, nullable=True)

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_by = relationship("User")


class SubscriptionEvent(Base, IDMixin, TimestampMixin):
    __tablename__ = "subscription_events"
    __table_args__ = (
        Index("ix_subscription_events_subscription_created", "subscription_id", "created_at"),
        Index("ix_subscription_events_provider_event", "provider", "provider_event_id"),
    )

    subscription_id = Column(
        ForeignKey("shop_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    provider = Column(String(50), nullable=True)
    provider_event_id = Column(String(150), nullable=True)
    reason = Column(Text, nullable=True)

    subscription = relationship("ShopSubscription")
    shop = relationship("Shop")


class LicenseEvent(Base, IDMixin, TimestampMixin):
    __tablename__ = "license_events"
    __table_args__ = (
        Index("ix_license_events_license_created", "license_id", "created_at"),
    )

    license_id = Column(
        ForeignKey("shop_licenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)

    license = relationship("ShopLicense")
    shop = relationship("Shop")
