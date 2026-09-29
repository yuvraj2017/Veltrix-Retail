from sqlalchemy import Column, Date, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class InvoiceSequence(Base, IDMixin, TimestampMixin):
    __tablename__ = "invoice_sequences"
    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "sequence_date",
            name="uq_invoice_sequences_shop_date",
        ),
        Index("ix_invoice_sequences_shop_date", "shop_id", "sequence_date"),
    )

    shop_id = Column(
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence_date = Column(Date, nullable=False)
    last_number = Column(Integer, nullable=False, default=0, server_default="0")

    shop = relationship("Shop")
