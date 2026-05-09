from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# from app.db.base_class import Base
from app.core.database import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)

    vendor_name = Column(String(150), nullable=False, index=True)
    company_name = Column(String(150), nullable=True)
    email = Column(String(150), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    tax_number = Column(String(100), nullable=True)

    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)

    payment_terms = Column(String(100), nullable=True)
    default_reminder_days = Column(Integer, nullable=False, default=7)
    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    bills = relationship("VendorBill", back_populates="vendor", cascade="all, delete-orphan")