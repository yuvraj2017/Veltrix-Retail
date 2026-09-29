from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class PasswordResetToken(Base, IDMixin, TimestampMixin):
    __tablename__ = "password_reset_tokens"

    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True, index=True)
    requested_from_ip = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)

    user = relationship("User")


Index(
    "ix_password_reset_tokens_user_id_used_at_expires_at",
    PasswordResetToken.user_id,
    PasswordResetToken.used_at,
    PasswordResetToken.expires_at,
)
