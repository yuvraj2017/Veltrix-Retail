from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class VendorBillPayment(Base):
    __tablename__ = "vendor_bill_payments"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_bill_id = Column(Integer, ForeignKey("vendor_bills.id", ondelete="CASCADE"), nullable=False, index=True)

    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    payment_mode = Column(String(50), nullable=True)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    bill = relationship("VendorBill", back_populates="payments")