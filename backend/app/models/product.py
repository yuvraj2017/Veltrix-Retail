from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Product(Base, IDMixin, TimestampMixin):
    __tablename__ = "products"

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    sku = Column(String(100), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)

    buying_price = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    mrp = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    selling_price = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")

    stock_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    low_stock_threshold = Column(Integer, nullable=False, default=5, server_default="5")

    unit = Column(String(50), nullable=False, default="pcs", server_default="pcs")
    barcode = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    main_image_url = Column(String(255), nullable=True)

    total_units_sold = Column(Integer, nullable=False, default=0, server_default="0")
    total_sales_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    total_profit_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    last_sold_at = Column(DateTime(timezone=True), nullable=True)
    last_restocked_at = Column(DateTime(timezone=True), nullable=True)

    shop = relationship("Shop")
    images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )


class ProductImage(Base, IDMixin):
    __tablename__ = "product_images"

    product_id = Column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_main = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False)

    product = relationship("Product", back_populates="images")