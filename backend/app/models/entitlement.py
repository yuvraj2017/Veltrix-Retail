from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class EntitlementKind:
    LIMIT = "limit"
    FEATURE = "feature"

    ALL = (LIMIT, FEATURE)


class EntitlementValueType:
    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    STRING = "string"

    ALL = (INTEGER, DECIMAL, BOOLEAN, STRING)


class EntitlementDefinition(Base, IDMixin, TimestampMixin):
    __tablename__ = "entitlement_definitions"

    key = Column(String(120), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    kind = Column(String(20), nullable=False, index=True)
    value_type = Column(String(20), nullable=False)
    resource_key = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true", index=True)

    plan_entitlements = relationship(
        "PlanEntitlement",
        back_populates="entitlement",
        cascade="all, delete-orphan",
    )


class PlanEntitlement(Base, IDMixin, TimestampMixin):
    __tablename__ = "plan_entitlements"
    __table_args__ = (
        UniqueConstraint(
            "plan_id",
            "entitlement_id",
            name="uq_plan_entitlements_plan_entitlement",
        ),
        CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_plan_entitlements_limit_non_negative",
        ),
        CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_plan_entitlements_unlimited_has_no_limit",
        ),
        Index("ix_plan_entitlements_plan_id", "plan_id"),
        Index("ix_plan_entitlements_entitlement_id", "entitlement_id"),
    )

    plan_id = Column(ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    entitlement_id = Column(
        ForeignKey("entitlement_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )

    limit_value = Column(Numeric(18, 2), nullable=True)
    is_unlimited = Column(Boolean, nullable=False, default=False, server_default="false")
    feature_enabled = Column(Boolean, nullable=True)

    plan = relationship("Plan", back_populates="entitlements")
    entitlement = relationship("EntitlementDefinition", back_populates="plan_entitlements")


class ShopEntitlementOverride(Base, IDMixin, TimestampMixin):
    __tablename__ = "shop_entitlement_overrides"
    __table_args__ = (
        CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_shop_entitlement_overrides_limit_non_negative",
        ),
        CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_shop_entitlement_overrides_unlimited_has_no_limit",
        ),
        Index("ix_shop_entitlement_overrides_shop_entitlement", "shop_id", "entitlement_id"),
        Index("ix_shop_entitlement_overrides_starts_ends", "starts_at", "ends_at"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    entitlement_id = Column(
        ForeignKey("entitlement_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    limit_value = Column(Numeric(18, 2), nullable=True)
    is_unlimited = Column(Boolean, nullable=False, default=False, server_default="false")
    feature_enabled = Column(Boolean, nullable=True)

    reason = Column(Text, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)

    created_by_user_id = Column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    shop = relationship("Shop")
    entitlement = relationship("EntitlementDefinition")
    created_by = relationship("User")
