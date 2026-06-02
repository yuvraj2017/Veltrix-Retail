from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ProductSalesAnalytics(Base):
    __tablename__ = "product_sales_analytics"

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

    invoice_number = Column(String(50), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False, index=True)

    customer_id = Column(
        Integer,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_name = Column(String(220), nullable=True)
    customer_phone = Column(String(20), nullable=True)

    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    product_code = Column(String(100), nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    category = Column(String(150), nullable=True)

    buy_price = Column(Numeric(12, 2), nullable=False, default=0)
    mrp = Column(Numeric(12, 2), nullable=False, default=0)

    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)

    selling_price_per_unit = Column(Numeric(12, 2), nullable=False, default=0)
    quantity = Column(Numeric(12, 2), nullable=False, default=1)

    total_selling_price = Column(Numeric(12, 2), nullable=False, default=0)
    total_buy_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_profit = Column(Numeric(12, 2), nullable=False, default=0)

    payment_status = Column(String(20), nullable=False, default="pending")

    created_at = Column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )

    invoice = relationship("Invoice", back_populates="sales_analytics")