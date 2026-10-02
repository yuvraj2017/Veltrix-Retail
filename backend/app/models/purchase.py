from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class PurchaseOrderSequence(Base, IDMixin, TimestampMixin):
    __tablename__ = "purchase_order_sequences"
    __table_args__ = (
        UniqueConstraint("shop_id", "sequence_date", name="uq_purchase_order_sequences_shop_date"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_date = Column(Date, nullable=False)
    last_number = Column(Integer, nullable=False, default=0, server_default="0")


class PurchaseReturnSequence(Base, IDMixin, TimestampMixin):
    __tablename__ = "purchase_return_sequences"
    __table_args__ = (
        UniqueConstraint("shop_id", "sequence_date", name="uq_purchase_return_sequences_shop_date"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_date = Column(Date, nullable=False)
    last_number = Column(Integer, nullable=False, default=0, server_default="0")


class PurchaseOrder(Base, IDMixin, TimestampMixin):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("shop_id", "purchase_order_number", name="uq_purchase_orders_shop_number"),
        CheckConstraint(
            "status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')",
            name="ck_purchase_orders_status",
        ),
        Index("ix_purchase_orders_shop_status_date", "shop_id", "status", "order_date"),
    )

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_number = Column(String(40), nullable=False)
    order_date = Column(Date, nullable=False)
    expected_date = Column(Date, nullable=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft")
    notes = Column(Text, nullable=True)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    total_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    created_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    vendor = relationship("Vendor")
    actor = relationship("User")
    items = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="PurchaseOrderItem.id",
    )
    receipts = relationship(
        "GoodsReceipt",
        back_populates="purchase_order",
        order_by="GoodsReceipt.id",
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        UniqueConstraint("purchase_order_id", "product_id", name="uq_purchase_order_items_product"),
        CheckConstraint("ordered_quantity > 0", name="ck_purchase_order_items_ordered_positive"),
        CheckConstraint("received_quantity >= 0", name="ck_purchase_order_items_received_non_negative"),
        CheckConstraint(
            "received_quantity <= ordered_quantity",
            name="ck_purchase_order_items_received_within_ordered",
        ),
        CheckConstraint("unit_cost >= 0", name="ck_purchase_order_items_unit_cost_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(100), nullable=False)
    ordered_quantity = Column(Integer, nullable=False)
    received_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    unit_cost = Column(Numeric(14, 2), nullable=False)
    line_total = Column(Numeric(14, 2), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"
    __table_args__ = (
        UniqueConstraint("shop_id", "receipt_number", name="uq_goods_receipts_shop_number"),
        UniqueConstraint(
            "shop_id",
            "purchase_order_id",
            "client_request_id",
            name="uq_goods_receipts_request_scope",
        ),
        Index("ix_goods_receipts_shop_po_created", "shop_id", "purchase_order_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_order_id = Column(
        ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    receipt_number = Column(String(60), nullable=False)
    received_date = Column(Date, nullable=False)
    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    notes = Column(Text, nullable=True)
    received_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    purchase_order = relationship("PurchaseOrder", back_populates="receipts")
    actor = relationship("User")
    items = relationship(
        "GoodsReceiptItem",
        back_populates="goods_receipt",
        cascade="all, delete-orphan",
        order_by="GoodsReceiptItem.id",
    )


class GoodsReceiptItem(Base):
    __tablename__ = "goods_receipt_items"
    __table_args__ = (
        UniqueConstraint(
            "goods_receipt_id",
            "purchase_order_item_id",
            name="uq_goods_receipt_items_po_item",
        ),
        CheckConstraint("received_quantity > 0", name="ck_goods_receipt_items_quantity_positive"),
        CheckConstraint("unit_cost >= 0", name="ck_goods_receipt_items_cost_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    goods_receipt_id = Column(
        ForeignKey("goods_receipts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purchase_order_item_id = Column(
        ForeignKey("purchase_order_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    product_id = Column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    received_quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(14, 2), nullable=False)

    goods_receipt = relationship("GoodsReceipt", back_populates="items")
    purchase_order_item = relationship("PurchaseOrderItem")
    product = relationship("Product")


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"
    __table_args__ = (
        UniqueConstraint("shop_id", "return_number", name="uq_purchase_returns_shop_number"),
        UniqueConstraint(
            "shop_id", "purchase_order_id", "client_request_id",
            name="uq_purchase_returns_request_scope",
        ),
        CheckConstraint(
            "reason IN ('damaged', 'defective', 'wrong_item', 'excess_quantity', "
            "'quality_issue', 'other')",
            name="ck_purchase_returns_reason",
        ),
        CheckConstraint("total_amount >= 0", name="ck_purchase_returns_total_non_negative"),
        Index("ix_purchase_returns_shop_po_created", "shop_id", "purchase_order_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_id = Column(
        ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    goods_receipt_id = Column(
        ForeignKey("goods_receipts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    return_number = Column(String(60), nullable=False)
    return_date = Column(Date, nullable=False)
    reason = Column(String(30), nullable=False)
    notes = Column(Text, nullable=True)
    client_request_id = Column(String(100), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    created_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    purchase_order = relationship("PurchaseOrder")
    goods_receipt = relationship("GoodsReceipt")
    vendor = relationship("Vendor")
    actor = relationship("User")
    items = relationship(
        "PurchaseReturnItem",
        back_populates="purchase_return",
        cascade="all, delete-orphan",
        order_by="PurchaseReturnItem.id",
    )
    credit = relationship("VendorCredit", back_populates="purchase_return", uselist=False)


class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"
    __table_args__ = (
        UniqueConstraint(
            "purchase_return_id", "goods_receipt_item_id",
            name="uq_purchase_return_items_receipt_item",
        ),
        CheckConstraint("returned_quantity > 0", name="ck_purchase_return_items_quantity_positive"),
        CheckConstraint("unit_cost >= 0", name="ck_purchase_return_items_cost_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_purchase_return_items_total_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    purchase_return_id = Column(
        ForeignKey("purchase_returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    goods_receipt_item_id = Column(
        ForeignKey("goods_receipt_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    returned_quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(14, 2), nullable=False)
    line_total = Column(Numeric(14, 2), nullable=False)

    purchase_return = relationship("PurchaseReturn", back_populates="items")
    goods_receipt_item = relationship("GoodsReceiptItem")
    product = relationship("Product")


class VendorCredit(Base):
    __tablename__ = "vendor_credits"
    __table_args__ = (
        UniqueConstraint("purchase_return_id", name="uq_vendor_credits_purchase_return"),
        CheckConstraint("amount >= 0", name="ck_vendor_credits_amount_non_negative"),
        CheckConstraint("applied_amount >= 0", name="ck_vendor_credits_applied_non_negative"),
        CheckConstraint("applied_amount <= amount", name="ck_vendor_credits_applied_within_amount"),
        CheckConstraint("status IN ('unapplied', 'partial', 'applied')", name="ck_vendor_credits_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_return_id = Column(
        ForeignKey("purchase_returns.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    vendor_bill_id = Column(ForeignKey("vendor_bills.id", ondelete="RESTRICT"), nullable=True, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    applied_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    status = Column(String(20), nullable=False, default="unapplied", server_default="unapplied")
    created_by = Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    purchase_return = relationship("PurchaseReturn", back_populates="credit")
    vendor = relationship("Vendor")
    vendor_bill = relationship("VendorBill")
    actor = relationship("User")
