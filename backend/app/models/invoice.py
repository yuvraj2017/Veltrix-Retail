from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    shop_id = Column(
        Integer,
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    invoice_number = Column(String(50), nullable=False, index=True)

    customer_id = Column(
        Integer,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_name_snapshot = Column(String(220), nullable=False)
    customer_phone_snapshot = Column(String(20), nullable=False)
    customer_email_snapshot = Column(String(150), nullable=True)
    customer_address_snapshot = Column(Text, nullable=True)
    customer_city_snapshot = Column(String(100), nullable=True)
    customer_state_snapshot = Column(String(100), nullable=True)
    customer_pincode_snapshot = Column(String(20), nullable=True)
    customer_gst_number_snapshot = Column(String(50), nullable=True)

    invoice_date = Column(Date, nullable=False, server_default=func.current_date())

    subtotal_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_tax_amount = Column(Numeric(12, 2), nullable=False, default=0)
    billed_amount = Column(Numeric(12, 2), nullable=False, default=0)
    extra_discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    final_amount = Column(Numeric(12, 2), nullable=False, default=0)

    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    remaining_amount = Column(Numeric(12, 2), nullable=False, default=0)

    total_buy_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_profit = Column(Numeric(12, 2), nullable=False, default=0)

    payment_status = Column(String(20), nullable=False, default="pending")
    payment_mode = Column(String(30), nullable=True)
    invoice_status = Column(String(20), nullable=False, default="draft")

    notes = Column(Text, nullable=True)

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer = relationship("Customer", back_populates="invoices")
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    sales_analytics = relationship(
        "ProductSalesAnalytics",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
