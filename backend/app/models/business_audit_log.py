from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BusinessAuditLog(Base):
    """Append-only tenant audit trail for business actions.

    This is intentionally separate from AdminAuditLog. Platform/super-admin
    actions stay in admin_audit_logs; shop business actions land here.
    """

    __tablename__ = "business_audit_logs"

    __table_args__ = (
        Index("ix_business_audit_logs_shop_created", "shop_id", "created_at"),
        Index(
            "ix_business_audit_logs_shop_entity",
            "shop_id",
            "entity_type",
            "entity_id",
        ),
        Index("ix_business_audit_logs_shop_action_created", "shop_id", "action", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)

    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_email = Column(String(150), nullable=True)

    action = Column(String(80), nullable=False, index=True)
    entity_type = Column(String(80), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True, index=True)

    summary = Column(Text, nullable=True)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    audit_metadata = Column("metadata", JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    shop = relationship("Shop")
    actor = relationship("User")


class BusinessAuditAction:
    INVOICE_CREATED = "invoice.created"
    INVOICE_UPDATED = "invoice.updated"
    INVOICE_CANCELLED = "invoice.cancelled"
    PAYMENT_RECEIVED = "payment.received"
    RETURN_CREATED = "return.created"
    REFUND_ISSUED = "refund.issued"
    CREDIT_NOTE_CREATED = "credit_note.created"
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    INVENTORY_ADJUSTED = "inventory.adjusted"
    INVENTORY_COUNT_RECONCILED = "inventory.count_reconciled"
    PURCHASE_ORDER_CREATED = "purchase_order.created"
    PURCHASE_ORDER_UPDATED = "purchase_order.updated"
    PURCHASE_ORDER_CANCELLED = "purchase_order.cancelled"
    GOODS_RECEIPT_CREATED = "goods_receipt.created"
    PURCHASE_RETURN_CREATED = "purchase_return.created"
    VENDOR_BILL_CREATED = "vendor_bill.created"
    VENDOR_BILL_UPDATED = "vendor_bill.updated"
    VENDOR_PAYMENT_CREATED = "vendor_payment.created"

    ALL = (
        INVOICE_CREATED,
        INVOICE_UPDATED,
        INVOICE_CANCELLED,
        PAYMENT_RECEIVED,
        RETURN_CREATED,
        REFUND_ISSUED,
        CREDIT_NOTE_CREATED,
        PRODUCT_CREATED,
        PRODUCT_UPDATED,
        INVENTORY_ADJUSTED,
        INVENTORY_COUNT_RECONCILED,
        PURCHASE_ORDER_CREATED,
        PURCHASE_ORDER_UPDATED,
        PURCHASE_ORDER_CANCELLED,
        GOODS_RECEIPT_CREATED,
        PURCHASE_RETURN_CREATED,
        VENDOR_BILL_CREATED,
        VENDOR_BILL_UPDATED,
        VENDOR_PAYMENT_CREATED,
    )
