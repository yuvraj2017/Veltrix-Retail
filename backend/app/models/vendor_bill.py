from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class VendorBill(Base):
    __tablename__ = "vendor_bills"
    __table_args__ = (
        UniqueConstraint("shop_id", "bill_number", name="uq_vendor_bills_shop_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)

    bill_number = Column(String(100), nullable=False)
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)

    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    remaining_amount = Column(Numeric(12, 2), nullable=False, default=0)

    status = Column(String(20), nullable=False, default="pending")

    payment_mode = Column(String(50), nullable=True)
    payment_reference = Column(String(100), nullable=True)
    reminder_days_before = Column(Integer, nullable=False, default=7)

    attachment_url = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="bills")
    payments = relationship("VendorBillPayment", back_populates="bill")
