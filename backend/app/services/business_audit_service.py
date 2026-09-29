from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.user import User


SENSITIVE_KEY_FRAGMENTS = (
    "authorization",
    "card",
    "credential",
    "hash",
    "jwt",
    "key",
    "otp",
    "password",
    "razorpay_secret",
    "reset",
    "secret",
    "smtp",
    "token",
)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower()
    return any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS)


def _sanitize_value(value: Any):
    if isinstance(value, dict):
        sanitized = {}
        for key, nested_value in value.items():
            key_text = str(key)
            if _is_sensitive_key(key_text):
                sanitized[key_text] = "<REDACTED>"
            else:
                sanitized[key_text] = _sanitize_value(nested_value)
        return sanitized

    if isinstance(value, (list, tuple, set)):
        return [_sanitize_value(item) for item in value]

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


def _sanitize_mapping(data: dict[str, Any] | None) -> dict[str, Any] | None:
    if not data:
        return None
    sanitized = _sanitize_value(data)
    return sanitized if sanitized else None


def record_business_audit(
    db: Session,
    *,
    shop_id: int,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    summary: str | None = None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> BusinessAuditLog:
    """Stage one tenant business audit row in the caller's transaction."""
    if action not in BusinessAuditAction.ALL:
        raise ValueError(f"Unsupported business audit action: {action}")

    entry = BusinessAuditLog(
        shop_id=shop_id,
        actor_user_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=(summary.strip() or None) if isinstance(summary, str) else None,
        before_data=_sanitize_mapping(before_data),
        after_data=_sanitize_mapping(after_data),
        audit_metadata=_sanitize_mapping(metadata),
    )
    db.add(entry)
    return entry


def list_business_audit_logs(
    db: Session,
    *,
    shop_id: int,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    page: int = 1,
    page_size: int = 25,
):
    query = db.query(BusinessAuditLog).filter(BusinessAuditLog.shop_id == shop_id)

    if action:
        query = query.filter(BusinessAuditLog.action == action)

    if entity_type:
        query = query.filter(BusinessAuditLog.entity_type == entity_type)

    if entity_id is not None:
        query = query.filter(BusinessAuditLog.entity_id == entity_id)

    total = query.count()

    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)

    items = (
        query.order_by(BusinessAuditLog.created_at.desc(), BusinessAuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
