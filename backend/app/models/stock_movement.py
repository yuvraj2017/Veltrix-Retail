from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StockMovementType:
    OPENING_BALANCE = "opening_balance"
    SALE = "sale"
    SALE_RETURN = "sale_return"
    DRAFT_RESERVE = "draft_reserve"
    DRAFT_RELEASE = "draft_release"
    ADJUSTMENT_IN = "adjustment_in"
    ADJUSTMENT_OUT = "adjustment_out"
    PURCHASE_RECEIPT = "purchase_receipt"
    PURCHASE_RETURN = "purchase_return"

    ALL = (
        OPENING_BALANCE,
        SALE,
        SALE_RETURN,
        DRAFT_RESERVE,
        DRAFT_RELEASE,
        ADJUSTMENT_IN,
        ADJUSTMENT_OUT,
        PURCHASE_RECEIPT,
        PURCHASE_RETURN,
    )


class StockMovement(Base):
    __tablename__ = "stock_movements"

    __table_args__ = (
        CheckConstraint("quantity_before >= 0", name="ck_stock_movements_before_non_negative"),
        CheckConstraint("quantity_after >= 0", name="ck_stock_movements_after_non_negative"),
        CheckConstraint(
            "quantity_after = quantity_before + quantity_delta",
            name="ck_stock_movements_balance_math",
        ),
        CheckConstraint(
            "movement_type IN ('opening_balance', 'sale', 'sale_return', 'draft_reserve', "
            "'draft_release', 'adjustment_in', 'adjustment_out', 'purchase_receipt', "
            "'purchase_return')",
            name="ck_stock_movements_type",
        ),
        Index(
            "uq_stock_movements_shop_client_request",
            "shop_id",
            "client_request_id",
            unique=True,
        ),
        Index("ix_stock_movements_shop_product_occurred", "shop_id", "product_id", "occurred_at"),
        Index("ix_stock_movements_shop_reference", "shop_id", "reference_type", "reference_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    movement_type = Column(String(30), nullable=False, index=True)
    quantity_delta = Column(Integer, nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)

    reference_type = Column(String(50), nullable=False)
    reference_id = Column(Integer, nullable=True)
    reference_line_id = Column(Integer, nullable=True)
    reason = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    client_request_id = Column(String(150), nullable=True)

    created_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    product = relationship("Product")
    actor = relationship("User")
