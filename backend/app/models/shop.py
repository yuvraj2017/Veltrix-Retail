from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Shop(Base, IDMixin, TimestampMixin):
    __tablename__ = "shops"

    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False)
    whatsapp_number = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    logo_url = Column(String(255), nullable=True)

    users = relationship("User", back_populates="shop", cascade="all, delete-orphan")