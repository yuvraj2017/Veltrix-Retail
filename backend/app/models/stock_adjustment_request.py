from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StockAdjustmentRequest(Base):
    __tablename__ = "stock_adjustment_requests"

    __table_args__ = (
        CheckConstraint(
            "operation_type IN ('adjustment', 'physical_count')",
            name="ck_stock_adjustment_requests_operation_type",
        ),
        CheckConstraint("quantity_before >= 0", name="ck_stock_adjustment_requests_before_non_negative"),
        CheckConstraint("quantity_after >= 0", name="ck_stock_adjustment_requests_after_non_negative"),
        CheckConstraint(
            "quantity_after = quantity_before + quantity_delta",
            name="ck_stock_adjustment_requests_balance_math",
        ),
        Index(
            "uq_stock_adjustment_requests_scope",
            "shop_id",
            "product_id",
            "client_request_id",
            unique=True,
        ),
        Index(
            "ix_stock_adjustment_requests_shop_product_created",
            "shop_id",
            "product_id",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    movement_id = Column(ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    operation_type = Column(String(30), nullable=False)
    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_delta = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    reason = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    product = relationship("Product")
    movement = relationship("StockMovement")
    actor = relationship("User")
