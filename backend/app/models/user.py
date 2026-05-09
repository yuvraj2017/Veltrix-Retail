from sqlalchemy import Boolean, Column, ForeignKey, String, Text
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
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
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)
    phone = Column(String(20), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="owner", server_default="owner")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    shop = relationship("Shop", back_populates="users")