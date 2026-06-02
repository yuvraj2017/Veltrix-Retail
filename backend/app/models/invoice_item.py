from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)

    shop_id = Column(
        Integer,
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    product_code = Column(String(100), nullable=False, index=True)
    product_name_snapshot = Column(String(255), nullable=False)
    category_snapshot = Column(String(150), nullable=True)
    unit_snapshot = Column(String(50), nullable=True)

    mrp = Column(Numeric(12, 2), nullable=False, default=0)
    buy_price = Column(Numeric(12, 2), nullable=False, default=0)

    quantity = Column(Numeric(12, 2), nullable=False, default=1)

    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0)
    discount_amount_per_unit = Column(Numeric(12, 2), nullable=False, default=0)
    total_discount_amount = Column(Numeric(12, 2), nullable=False, default=0)

    selling_price_per_unit = Column(Numeric(12, 2), nullable=False, default=0)
    total_selling_price = Column(Numeric(12, 2), nullable=False, default=0)

    total_buy_cost = Column(Numeric(12, 2), nullable=False, default=0)
    profit_per_unit = Column(Numeric(12, 2), nullable=False, default=0)
    total_profit = Column(Numeric(12, 2), nullable=False, default=0)

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

    invoice = relationship("Invoice", back_populates="items")