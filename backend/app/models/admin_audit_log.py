from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AdminAuditLog(Base):
    """An append-only record of one administrative action.

    Actor and target emails are denormalised alongside the foreign keys on
    purpose: the FKs are ``ON DELETE SET NULL``, so without the copies an
    audit trail would lose its subject the moment an account was removed --
    which is exactly when the trail matters most.

    Nothing sensitive is stored here. No password hashes, no tokens, no
    secrets: only who did what to whom, when, and optionally why.
    """

    __tablename__ = "admin_audit_logs"

    # Newest-first listing is the only read pattern, plus per-user drill-down
    # on the user details page.
    __table_args__ = (
        Index("ix_admin_audit_logs_created_at", "created_at"),
        Index("ix_admin_audit_logs_target_user_id", "target_user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    actor_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_email = Column(String(150), nullable=False)

    action = Column(String(50), nullable=False, index=True)

    target_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_email = Column(String(150), nullable=True)
    target_entity_type = Column(String(80), nullable=True)
    target_entity_id = Column(Integer, nullable=True)

    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    reason = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    actor = relationship("User", foreign_keys=[actor_user_id])
    target = relationship("User", foreign_keys=[target_user_id])


class AuditAction:
    """Auditable administrative events."""

    USER_REGISTERED = "USER_REGISTERED"
    USER_APPROVED = "USER_APPROVED"
    USER_REJECTED = "USER_REJECTED"
    USER_SUSPENDED = "USER_SUSPENDED"
    USER_REACTIVATED = "USER_REACTIVATED"
    USER_DISABLED = "USER_DISABLED"
    ROLE_CHANGED = "ROLE_CHANGED"
    PLAN_CHANGED = "PLAN_CHANGED"
    ENTITLEMENT_CHANGED = "ENTITLEMENT_CHANGED"
    SUBSCRIPTION_CHANGED = "SUBSCRIPTION_CHANGED"
    LICENSE_CHANGED = "LICENSE_CHANGED"
    SHOP_ENTITLEMENT_OVERRIDE_CHANGED = "SHOP_ENTITLEMENT_OVERRIDE_CHANGED"
    PAYMENT_CHANGED = "PAYMENT_CHANGED"
    COMMERCIAL_SOURCE_CHANGED = "COMMERCIAL_SOURCE_CHANGED"

    ALL = (
        USER_REGISTERED,
        USER_APPROVED,
        USER_REJECTED,
        USER_SUSPENDED,
        USER_REACTIVATED,
        USER_DISABLED,
        ROLE_CHANGED,
        PLAN_CHANGED,
        ENTITLEMENT_CHANGED,
        SUBSCRIPTION_CHANGED,
        LICENSE_CHANGED,
        SHOP_ENTITLEMENT_OVERRIDE_CHANGED,
        PAYMENT_CHANGED,
        COMMERCIAL_SOURCE_CHANGED,
    )
