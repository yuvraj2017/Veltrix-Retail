from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    __table_args__ = (
        Index(
            "uq_invoice_payments_shop_invoice_request",
            "shop_id",
            "invoice_id",
            "client_request_id",
            unique=True,
        ),
        Index("ix_invoice_payments_shop_invoice", "shop_id", "invoice_id"),
        Index("ix_invoice_payments_shop_received", "shop_id", "received_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)
    payment_reference = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="completed")

    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)

    received_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
    actor = relationship("User")
