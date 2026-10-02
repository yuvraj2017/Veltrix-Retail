from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InvoiceIdempotencyKey(Base):
    __tablename__ = "invoice_idempotency_keys"

    __table_args__ = (
        Index(
            "uq_invoice_idempotency_shop_request",
            "shop_id",
            "client_request_id",
            unique=True,
        ),
        Index("ix_invoice_idempotency_shop_created", "shop_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)

    shop_id = Column(
        Integer,
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), nullable=False, default="succeeded")

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

    invoice = relationship("Invoice")
