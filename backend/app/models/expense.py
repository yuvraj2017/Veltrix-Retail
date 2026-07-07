from sqlalchemy import Column, Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Expense(Base, IDMixin, TimestampMixin):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_user_expense_date", "user_id", "expense_date"),
        Index("ix_expenses_shop_expense_date", "shop_id", "expense_date"),
    )

    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    payment_mode = Column(String(50), nullable=True, index=True)
    notes = Column(Text, nullable=True)

    user = relationship("User")
    shop = relationship("Shop")