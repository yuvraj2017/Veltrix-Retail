"""Append-only audit trail for administrative actions.

Records are written in the same transaction as the change they describe, so an
action and its audit entry either both land or neither does.

Nothing sensitive is ever recorded here: no password hashes, no tokens, no
SMTP or JWT secrets. Only actor, action, target, timestamp, the values either
side of the change, and an optional administrator note.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.admin_audit_log import AdminAuditLog
from app.models.user import User


def record_admin_action(
    db: Session,
    *,
    actor: User,
    action: str,
    target: User | None = None,
    target_entity_type: str | None = None,
    target_entity_id: int | None = None,
    previous_value: str | None = None,
    new_value: str | None = None,
    reason: str | None = None,
    ip_address: str | None = None,
) -> AdminAuditLog:
    """Stage one audit row. The caller owns the commit.

    Emails are copied in alongside the foreign keys because those are
    ``ON DELETE SET NULL`` -- without the copies, deleting an account would
    blank out the very history that explains what happened to it.
    """
    entry = AdminAuditLog(
        actor_user_id=actor.id,
        actor_email=actor.email,
        action=action,
        target_user_id=target.id if target else None,
        target_email=target.email if target else None,
        target_entity_type=target_entity_type,
        target_entity_id=target_entity_id,
        previous_value=previous_value,
        new_value=new_value,
        reason=(reason.strip() or None) if isinstance(reason, str) else None,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry


def list_audit_logs(
    db: Session,
    *,
    action: str | None = None,
    actor_id: int | None = None,
    target_user_id: int | None = None,
    page: int = 1,
    page_size: int = 25,
):
    """Newest-first, server-side paginated.

    Served by ix_admin_audit_logs_created_at; btree scans backwards, so an
    ascending index satisfies the DESC ordering.
    """
    query = db.query(AdminAuditLog)

    if action:
        query = query.filter(AdminAuditLog.action == action)

    if actor_id:
        query = query.filter(AdminAuditLog.actor_user_id == actor_id)

    if target_user_id:
        query = query.filter(AdminAuditLog.target_user_id == target_user_id)

    total = query.count()

    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)

    items = (
        query.order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
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


def get_user_audit_trail(db: Session, user_id: int, limit: int = 20):
    """The most recent entries where this account was the target."""
    return (
        db.query(AdminAuditLog)
        .filter(AdminAuditLog.target_user_id == user_id)
        .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
        .limit(limit)
        .all()
    )


def count_actions_since(db: Session, since) -> int:
    return (
        db.query(func.count(AdminAuditLog.id))
        .filter(AdminAuditLog.created_at >= since)
        .scalar()
    ) or 0
