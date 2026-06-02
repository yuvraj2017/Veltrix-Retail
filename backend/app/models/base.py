from sqlalchemy import Column, DateTime, Integer, func


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class IDMixin:
    id = Column(Integer, primary_key=True, index=True)