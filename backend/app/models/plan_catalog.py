from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class CatalogVersionStatus:
    DRAFT = "draft"
    PUBLISHED = "published"

    ALL = (DRAFT, PUBLISHED)


class PlanCatalogVersion(Base, IDMixin, TimestampMixin):
    __tablename__ = "plan_catalog_versions"
    __table_args__ = (
        UniqueConstraint(
            "plan_id",
            "version_number",
            name="uq_plan_catalog_versions_plan_version",
        ),
        UniqueConstraint(
            "id",
            "plan_id",
            name="uq_plan_catalog_versions_id_plan",
        ),
        CheckConstraint(
            "status IN ('draft', 'published')",
            name="ck_plan_catalog_versions_status",
        ),
        CheckConstraint(
            "monthly_price >= 0 AND annual_price >= 0",
            name="ck_plan_catalog_versions_prices_non_negative",
        ),
        CheckConstraint(
            "trial_days >= 0 AND grace_period_days >= 0",
            name="ck_plan_catalog_versions_terms_non_negative",
        ),
        CheckConstraint(
            "(status = 'published' AND published_at IS NOT NULL) OR "
            "(status = 'draft' AND published_at IS NULL)",
            name="ck_plan_catalog_versions_publication_state",
        ),
        Index(
            "ix_plan_catalog_versions_plan_status_version",
            "plan_id",
            "status",
            "version_number",
        ),
    )

    plan_id = Column(ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    version_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)

    monthly_price = Column(Numeric(12, 2), nullable=False)
    annual_price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    trial_days = Column(Integer, nullable=False, default=0, server_default="0")
    grace_period_days = Column(Integer, nullable=False, default=0, server_default="0")

    published_at = Column(DateTime(timezone=True), nullable=True)
    published_by_user_id = Column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    plan = relationship("Plan", back_populates="catalog_versions")
    published_by = relationship("User")
    entitlement_snapshots = relationship(
        "PlanCatalogEntitlementSnapshot",
        back_populates="catalog_version",
        cascade="all, delete-orphan",
        order_by="PlanCatalogEntitlementSnapshot.id",
    )


class PlanCatalogEntitlementSnapshot(Base, IDMixin, TimestampMixin):
    __tablename__ = "plan_catalog_entitlement_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "catalog_version_id",
            "entitlement_id",
            name="uq_plan_catalog_snapshot_version_entitlement",
        ),
        CheckConstraint(
            "kind IN ('limit', 'feature')",
            name="ck_plan_catalog_snapshot_kind",
        ),
        CheckConstraint(
            "value_type IN ('integer', 'decimal', 'boolean', 'string')",
            name="ck_plan_catalog_snapshot_value_type",
        ),
        CheckConstraint(
            "limit_value IS NULL OR limit_value >= 0",
            name="ck_plan_catalog_snapshot_limit_non_negative",
        ),
        CheckConstraint(
            "NOT (is_unlimited = true AND limit_value IS NOT NULL)",
            name="ck_plan_catalog_snapshot_unlimited_has_no_limit",
        ),
        Index(
            "ix_plan_catalog_snapshot_version_key",
            "catalog_version_id",
            "entitlement_key",
        ),
    )

    catalog_version_id = Column(
        ForeignKey("plan_catalog_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    entitlement_id = Column(
        ForeignKey("entitlement_definitions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    entitlement_key = Column(String(120), nullable=False)
    entitlement_name = Column(String(150), nullable=False)
    kind = Column(String(20), nullable=False)
    value_type = Column(String(20), nullable=False)
    resource_key = Column(String(100), nullable=True)
    limit_value = Column(Numeric(18, 2), nullable=True)
    is_unlimited = Column(Boolean, nullable=False, default=False, server_default="false")
    feature_enabled = Column(Boolean, nullable=True)

    catalog_version = relationship(
        "PlanCatalogVersion",
        back_populates="entitlement_snapshots",
    )
    entitlement = relationship("EntitlementDefinition")
