from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InvoiceReversalSequence(Base):
    __tablename__ = "invoice_reversal_sequences"

    __table_args__ = (
        Index(
            "uq_invoice_reversal_sequences_scope",
            "shop_id",
            "sequence_type",
            "sequence_date",
            unique=True,
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_type = Column(String(20), nullable=False)
    sequence_date = Column(Date, nullable=False)
    last_number = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now())


class InvoiceReturn(Base):
    __tablename__ = "invoice_returns"

    __table_args__ = (
        Index("uq_invoice_returns_shop_request", "shop_id", "client_request_id", unique=True),
        Index("uq_invoice_returns_shop_return_number", "shop_id", "return_number", unique=True),
        Index("uq_invoice_returns_shop_credit_note_number", "shop_id", "credit_note_number", unique=True),
        Index("ix_invoice_returns_shop_invoice", "shop_id", "invoice_id"),
        Index("ix_invoice_returns_shop_created", "shop_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    return_number = Column(String(50), nullable=False, index=True)
    credit_note_number = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="completed")
    reason = Column(String(200), nullable=False)
    notes = Column(Text, nullable=True)

    subtotal_amount = Column(Numeric(12, 2), nullable=False, default=0)
    taxable_amount = Column(Numeric(12, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    sgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_tax_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_buy_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_profit = Column(Numeric(12, 2), nullable=False, default=0)

    applied_to_outstanding_amount = Column(Numeric(12, 2), nullable=False, default=0)
    refundable_amount = Column(Numeric(12, 2), nullable=False, default=0)

    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())

    invoice = relationship("Invoice", back_populates="returns")
    items = relationship("InvoiceReturnItem", back_populates="return_record", cascade="all, delete-orphan")
    refunds = relationship("InvoiceRefund", back_populates="return_record", cascade="all, delete-orphan")
    actor = relationship("User")


class InvoiceReturnItem(Base):
    __tablename__ = "invoice_return_items"

    __table_args__ = (
        Index("ix_invoice_return_items_shop_invoice_item", "shop_id", "invoice_item_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    return_id = Column(Integer, ForeignKey("invoice_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_item_id = Column(Integer, ForeignKey("invoice_items.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    product_code = Column(String(100), nullable=False)
    product_name_snapshot = Column(String(255), nullable=False)
    hsn_sac_snapshot = Column(String(20), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False)

    unit_taxable_value = Column(Numeric(12, 2), nullable=False, default=0)
    gst_rate = Column(Numeric(5, 2), nullable=False, default=0)
    cgst_rate = Column(Numeric(5, 2), nullable=False, default=0)
    sgst_rate = Column(Numeric(5, 2), nullable=False, default=0)
    igst_rate = Column(Numeric(5, 2), nullable=False, default=0)

    taxable_value = Column(Numeric(12, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    sgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_tax_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_buy_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_profit = Column(Numeric(12, 2), nullable=False, default=0)

    created_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())

    return_record = relationship("InvoiceReturn", back_populates="items")
    invoice_item = relationship("InvoiceItem")
    product = relationship("Product")


class InvoiceRefund(Base):
    __tablename__ = "invoice_refunds"

    __table_args__ = (
        Index("uq_invoice_refunds_shop_return_request", "shop_id", "return_id", "client_request_id", unique=True),
        Index("ix_invoice_refunds_shop_invoice", "shop_id", "invoice_id"),
        Index("ix_invoice_refunds_shop_return", "shop_id", "return_id"),
        Index("ix_invoice_refunds_shop_refunded", "shop_id", "refunded_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    return_id = Column(Integer, ForeignKey("invoice_returns.id", ondelete="CASCADE"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)
    refund_method = Column(String(30), nullable=False)
    reference = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="completed")

    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    refunded_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=False), nullable=False, server_default=func.now())

    invoice = relationship("Invoice")
    return_record = relationship("InvoiceReturn", back_populates="refunds")
    actor = relationship("User")
