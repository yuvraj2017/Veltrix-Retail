from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class User(Base, IDMixin, TimestampMixin):
    __tablename__ = "users"

    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    timezone = Column(String(100), nullable=True)
    language = Column(String(50), nullable=False, default="English (US)", server_default="English (US)")
    two_factor_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    # Nullable because a super admin is the platform operator, not a tenant:
    # they own no shop. Every other account is a shop owner and always has
    # one. Shop-scoped routes are gated by get_shop_user (app/api/deps.py),
    # so a shopless account cannot reach them.
    shop_id = Column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=True, index=True
    )
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)
    phone = Column(String(20), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="owner", server_default="owner")

    # Legacy access flag. Kept in sync with `status` (see
    # app/core/user_status.derive_is_active) so pre-existing queries and the
    # committed SQL dumps stay coherent; `status` is the authoritative field.
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    # Account lifecycle. Only "active" may authenticate -- enforced at login
    # and again on every authenticated request in app/api/deps.py.
    # server_default="active" is what backfills accounts that predate this
    # column: they could sign in before the approval workflow existed and must
    # continue to. New registrations set "pending" explicitly instead of
    # relying on this default.
    status = Column(
        String(20), nullable=False, default="active", server_default="active", index=True
    )

    # Why an administrator last changed this account's status. Administrator-only:
    # never returned by a non-admin endpoint.
    status_reason = Column(Text, nullable=True)
    status_changed_at = Column(DateTime(timezone=True), nullable=True)

    last_login_at = Column(DateTime(timezone=True), nullable=True)

    shop = relationship("Shop", back_populates="users")

    @property
    def organization(self):
        return self.shop.organization if self.shop is not None else None

    @property
    def organization_id(self):
        return self.shop.organization_id if self.shop is not None else None
