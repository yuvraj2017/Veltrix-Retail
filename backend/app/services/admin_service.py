"""Platform administration: cross-shop user access control.

Scope note
----------
Every other service in this application is scoped to ``current_user.shop_id``,
because registration creates a shop plus its owner and each shop is a tenant.
This service is the deliberate exception: a super admin is a platform operator
who reviews signups across all shops, so these queries are intentionally not
shop-scoped. Tenant isolation everywhere else is untouched.

Security model
--------------
Authorisation is enforced by the ``require_super_admin`` dependency before any
function here runs (see app/api/deps.py), giving:

    authenticate -> verify status -> verify role -> validate -> act -> audit

On top of that, every mutation below re-validates the target's *current* state
against the transition table, which is what makes repeated actions safe: a
second approval of an already-approved account is a 409, not a silent no-op.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status as http_status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.user_status import (
    UserRole,
    UserStatus,
    allowed_targets,
    derive_is_active,
    is_super_admin,
    is_transition_allowed,
    normalize_role,
    normalize_status,
)
from app.models.admin_audit_log import AdminAuditLog, AuditAction
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.services import audit_service

DEFAULT_ADMIN_PAGE_SIZE = 20
MAX_ADMIN_PAGE_SIZE = 100

RECENT_REGISTRATION_DAYS = 7

# Cancelled invoices are excluded from every figure below, matching how
# customer_service._invoice_scope already treats them, so the admin view and
# the shop owner's own reports agree.
_LIVE_INVOICE = Invoice.invoice_status != "cancelled"

# How many shops the dashboard ranks by revenue.
TOP_SHOP_COUNT = 5

# Which audit action a given target state corresponds to.
_STATUS_ACTIONS = {
    UserStatus.ACTIVE: AuditAction.USER_APPROVED,
    UserStatus.REJECTED: AuditAction.USER_REJECTED,
    UserStatus.SUSPENDED: AuditAction.USER_SUSPENDED,
    UserStatus.DISABLED: AuditAction.USER_DISABLED,
}

_ADMIN_USER_SORTS = {
    "created_desc": (User.created_at.desc(),),
    "created_asc": (User.created_at.asc(),),
    "name_asc": (User.full_name.asc(),),
    "name_desc": (User.full_name.desc(),),
    "last_login_desc": (User.last_login_at.desc().nullslast(),),
}

# Human-readable verb per target state, used in refusal messages.
_ACTION_LABELS = {
    UserStatus.ACTIVE: "reactivate",
    UserStatus.REJECTED: "reject",
    UserStatus.SUSPENDED: "suspend",
    UserStatus.DISABLED: "disable",
}

# Losing access is what can strand the platform; approving cannot.
_ACCESS_REMOVING_STATUSES = (
    UserStatus.SUSPENDED,
    UserStatus.DISABLED,
    UserStatus.REJECTED,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _money(value) -> Decimal:
    """Quantise to paise, matching the rest of the application's money handling."""
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


def _count_active_super_admins(db: Session, excluding_user_id: int | None = None) -> int:
    query = db.query(func.count(User.id)).filter(
        User.role == UserRole.SUPER_ADMIN,
        User.status == UserStatus.ACTIVE,
    )

    if excluding_user_id is not None:
        query = query.filter(User.id != excluding_user_id)

    return query.scalar() or 0


def _guard_not_self(actor: User, target: User, action_label: str) -> None:
    """Refuse administrators acting on their own account.

    Two reasons: a super admin must not be able to lock themselves out, and
    self-service role changes are the classic privilege-escalation path.
    """
    if actor.id == target.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=f"You cannot {action_label} your own account",
        )


def _guard_last_super_admin(db: Session, target: User, action_label: str) -> None:
    """Never let the platform lose its last usable super admin."""
    if not is_super_admin(target.role):
        return

    if _count_active_super_admins(db, excluding_user_id=target.id) == 0:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot {action_label} the only remaining active super admin. "
                "Promote another super admin first."
            ),
        )


# ---------------------------------------------------------------------------
# Business metrics
# ---------------------------------------------------------------------------

_EMPTY_METRICS = {
    "invoice_count": 0,
    "total_revenue": Decimal("0.00"),
    "total_profit": Decimal("0.00"),
    "collected_amount": Decimal("0.00"),
    "outstanding_amount": Decimal("0.00"),
    "product_count": 0,
    "customer_count": 0,
    "last_invoice_date": None,
}


def _fetch_shop_metrics(db: Session, shop_ids: list[int]) -> dict[int, dict]:
    """Trading performance for the given shops, keyed by shop id.

    Three grouped queries for the whole page rather than a per-row lookup:
    a 20-row page costs 3 queries, not 60. The alternative -- correlated
    subqueries in the user list -- would scale with page size.
    """
    if not shop_ids:
        return {}

    metrics: dict[int, dict] = {
        shop_id: dict(_EMPTY_METRICS) for shop_id in shop_ids
    }

    invoice_rows = (
        db.query(
            Invoice.shop_id.label("shop_id"),
            func.count(Invoice.id).label("invoice_count"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("revenue"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("profit"),
            func.coalesce(func.sum(Invoice.paid_amount), 0).label("collected"),
            func.coalesce(func.sum(Invoice.remaining_amount), 0).label("outstanding"),
            func.max(Invoice.invoice_date).label("last_invoice_date"),
        )
        .filter(Invoice.shop_id.in_(shop_ids), _LIVE_INVOICE)
        .group_by(Invoice.shop_id)
        .all()
    )

    for row in invoice_rows:
        metrics[row.shop_id].update(
            {
                "invoice_count": int(row.invoice_count or 0),
                "total_revenue": _money(row.revenue),
                "total_profit": _money(row.profit),
                "collected_amount": _money(row.collected),
                "outstanding_amount": _money(row.outstanding),
                "last_invoice_date": row.last_invoice_date,
            }
        )

    for row in (
        db.query(Product.shop_id, func.count(Product.id))
        .filter(Product.shop_id.in_(shop_ids))
        .group_by(Product.shop_id)
        .all()
    ):
        metrics[row[0]]["product_count"] = int(row[1] or 0)

    for row in (
        db.query(Customer.shop_id, func.count(Customer.id))
        .filter(Customer.shop_id.in_(shop_ids))
        .group_by(Customer.shop_id)
        .all()
    ):
        metrics[row[0]]["customer_count"] = int(row[1] or 0)

    return metrics


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------

def _serialize_user_row(
    user: User, shop_name: str | None, metrics: dict | None = None
) -> dict:
    """Admin list shape. Carries no credential material by construction.

    `metrics` is absent for a super admin, who owns no shop and therefore has
    no trading figures.
    """
    row = {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": normalize_role(user.role),
        "status": normalize_status(user.status),
        "shop_id": user.shop_id,
        "shop_name": shop_name,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "allowed_transitions": list(allowed_targets(user.status)),
    }
    row.update(metrics or dict(_EMPTY_METRICS))
    row["has_shop"] = user.shop_id is not None
    return row


def _serialize_user_with_shop_lookup(user: User, db: Session) -> dict:
    shop = (
        db.query(Shop).filter(Shop.id == user.shop_id).first()
        if user.shop_id
        else None
    )
    metrics = (
        _fetch_shop_metrics(db, [user.shop_id]).get(user.shop_id)
        if user.shop_id
        else None
    )
    return _serialize_user_row(user, shop.name if shop else None, metrics)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def list_users(
    db: Session,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    role_filter: str | None = None,
    sort_by: str = "created_desc",
    page: int = 1,
    page_size: int = DEFAULT_ADMIN_PAGE_SIZE,
):
    """Paginated, filtered, sorted -- all in SQL.

    Deliberately never returns the whole table: the browser gets one page, so
    this stays flat as the platform grows.
    """
    if status_filter:
        normalized = status_filter.strip().lower()
        if normalized not in UserStatus.ALL:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"status must be one of: {', '.join(UserStatus.ALL)}",
            )
        status_filter = normalized

    if role_filter:
        normalized_role = role_filter.strip().lower()
        if normalized_role not in UserRole.ALL:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"role must be one of: {', '.join(UserRole.ALL)}",
            )
        role_filter = normalized_role

    # Shop name comes along in the same query -- an outer join keeps users
    # whose shop row has gone missing visible rather than silently dropping
    # them from an administrative view.
    query = db.query(User, Shop.name.label("shop_name")).outerjoin(
        Shop, Shop.id == User.shop_id
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
                Shop.name.ilike(term),
            )
        )

    if status_filter:
        query = query.filter(User.status == status_filter)

    if role_filter:
        query = query.filter(User.role == role_filter)

    total = query.count()

    page = max(page, 1)
    page_size = max(min(page_size, MAX_ADMIN_PAGE_SIZE), 1)

    order_by = _ADMIN_USER_SORTS.get(sort_by, _ADMIN_USER_SORTS["created_desc"])

    rows = (
        query.order_by(*order_by, User.id.desc())  # id tiebreak = stable paging
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # One metrics fetch for the whole page.
    page_shop_ids = [row.User.shop_id for row in rows if row.User.shop_id]
    metrics_by_shop = _fetch_shop_metrics(db, page_shop_ids)

    return {
        "items": [
            _serialize_user_row(
                row.User,
                row.shop_name,
                metrics_by_shop.get(row.User.shop_id),
            )
            for row in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_user_detail(user_id: int, db: Session, current_user: User):
    user = _get_user_or_404(user_id, db)
    shop = (
        db.query(Shop).filter(Shop.id == user.shop_id).first()
        if user.shop_id
        else None
    )
    metrics = (
        _fetch_shop_metrics(db, [user.shop_id]).get(user.shop_id, dict(_EMPTY_METRICS))
        if user.shop_id
        else dict(_EMPTY_METRICS)
    )

    # A role change is offered only when it would actually be permitted: not on
    # your own account, and not if it would strip the last super admin.
    can_change_role = current_user.id != user.id
    if can_change_role and is_super_admin(user.role):
        can_change_role = _count_active_super_admins(db, excluding_user_id=user.id) > 0

    return {
        "id": user.id,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "role": normalize_role(user.role),
        "status": normalize_status(user.status),
        "status_reason": user.status_reason,
        "status_changed_at": user.status_changed_at,
        "profile_image_url": user.profile_image_url,
        "timezone": user.timezone,
        "language": user.language,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "last_login_at": user.last_login_at,
        "shop_id": user.shop_id,
        "shop_name": shop.name if shop else None,
        "shop_category": shop.category if shop else None,
        "shop_email": shop.email if shop else None,
        "shop_phone": shop.phone if shop else None,
        "shop_address": shop.address if shop else None,
        "has_shop": user.shop_id is not None,
        "allowed_transitions": list(allowed_targets(user.status)),
        "can_change_role": can_change_role,
        "audit_trail": audit_service.get_user_audit_trail(db, user.id),
        **metrics,
    }


def get_admin_stats(db: Session):
    """Operational overview. Every figure is a live query -- no fabricated data.

    One pass over `users` with FILTER clauses produces all six status counts,
    matching how the dashboard and invoice stats endpoints in this codebase
    already collapse many aggregates into a single round trip.
    """
    today = date.today()
    window_start = today - timedelta(days=RECENT_REGISTRATION_DAYS - 1)

    row = db.query(
        func.count(User.id).label("total_users"),
        func.coalesce(
            func.count(User.id).filter(User.status == UserStatus.PENDING), 0
        ).label("pending_users"),
        func.coalesce(
            func.count(User.id).filter(User.status == UserStatus.ACTIVE), 0
        ).label("active_users"),
        func.coalesce(
            func.count(User.id).filter(User.status == UserStatus.SUSPENDED), 0
        ).label("suspended_users"),
        func.coalesce(
            func.count(User.id).filter(User.status == UserStatus.REJECTED), 0
        ).label("rejected_users"),
        func.coalesce(
            func.count(User.id).filter(User.status == UserStatus.DISABLED), 0
        ).label("disabled_users"),
        func.coalesce(
            func.count(User.id).filter(User.role == UserRole.SUPER_ADMIN), 0
        ).label("super_admin_count"),
        func.coalesce(
            func.count(User.id).filter(User.role == UserRole.OWNER), 0
        ).label("shop_owner_count"),
    ).one()

    # Every shop belongs to a shop owner; super admins have none, so this is
    # simply the number of shops on the platform.
    total_shops = db.query(func.count(Shop.id)).scalar() or 0

    registration_rows = (
        db.query(
            func.date(User.created_at).label("day"),
            func.count(User.id).label("count"),
        )
        .filter(func.date(User.created_at) >= window_start)
        .group_by(func.date(User.created_at))
        .all()
    )

    def _as_date(value):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return date.fromisoformat(str(value))

    counts_by_day = {_as_date(r.day): int(r.count or 0) for r in registration_rows}

    # Days with no signups are filled with zeros so the series always spans the
    # full window rather than collapsing to whatever days happen to have data.
    recent_registrations = []
    for offset in range(RECENT_REGISTRATION_DAYS):
        day = window_start + timedelta(days=offset)
        recent_registrations.append(
            {
                "label": day.strftime("%a").upper()[:3],
                "day": day,
                "count": counts_by_day.get(day, 0),
            }
        )

    activity_window = _utcnow() - timedelta(days=RECENT_REGISTRATION_DAYS)

    # Platform-wide trading totals: one pass over every live invoice.
    trading = db.query(
        func.count(Invoice.id).label("invoice_count"),
        func.coalesce(func.sum(Invoice.final_amount), 0).label("revenue"),
        func.coalesce(func.sum(Invoice.total_profit), 0).label("profit"),
        func.coalesce(func.sum(Invoice.paid_amount), 0).label("collected"),
        func.coalesce(func.sum(Invoice.remaining_amount), 0).label("outstanding"),
        func.coalesce(
            func.sum(Invoice.final_amount).filter(
                Invoice.invoice_date >= window_start
            ),
            0,
        ).label("revenue_last_7_days"),
    ).filter(_LIVE_INVOICE).one()

    # Which shops are actually carrying the platform. Joined to shops and
    # users so the ranking can name the owner, not just the shop.
    top_shop_rows = (
        db.query(
            Invoice.shop_id.label("shop_id"),
            Shop.name.label("shop_name"),
            func.count(Invoice.id).label("invoice_count"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("revenue"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("profit"),
        )
        .outerjoin(Shop, Shop.id == Invoice.shop_id)
        .filter(_LIVE_INVOICE)
        .group_by(Invoice.shop_id, Shop.name)
        .order_by(func.coalesce(func.sum(Invoice.final_amount), 0).desc())
        .limit(TOP_SHOP_COUNT)
        .all()
    )

    # One lookup maps the ranked shops back to their owners.
    owner_by_shop = {
        row.shop_id: row
        for row in db.query(
            User.shop_id.label("shop_id"),
            User.id.label("user_id"),
            User.full_name.label("full_name"),
            User.email.label("email"),
        )
        .filter(User.shop_id.in_([r.shop_id for r in top_shop_rows] or [0]))
        .all()
    }

    top_shops = []
    for shop_row in top_shop_rows:
        owner = owner_by_shop.get(shop_row.shop_id)
        top_shops.append(
            {
                "shop_id": shop_row.shop_id,
                "shop_name": shop_row.shop_name,
                "owner_user_id": owner.user_id if owner else None,
                "owner_name": owner.full_name if owner else None,
                "owner_email": owner.email if owner else None,
                "invoice_count": int(shop_row.invoice_count or 0),
                "total_revenue": _money(shop_row.revenue),
                "total_profit": _money(shop_row.profit),
            }
        )

    return {
        "total_users": row.total_users or 0,
        "pending_users": row.pending_users or 0,
        "active_users": row.active_users or 0,
        "suspended_users": row.suspended_users or 0,
        "rejected_users": row.rejected_users or 0,
        "disabled_users": row.disabled_users or 0,
        "total_shops": total_shops,
        "super_admin_count": row.super_admin_count or 0,
        "shop_owner_count": row.shop_owner_count or 0,
        "registrations_last_7_days": sum(counts_by_day.values()),
        "recent_registrations": recent_registrations,
        "admin_actions_last_7_days": audit_service.count_actions_since(
            db, activity_window
        ),
        "platform_invoice_count": int(trading.invoice_count or 0),
        "platform_revenue": _money(trading.revenue),
        "platform_profit": _money(trading.profit),
        "platform_collected": _money(trading.collected),
        "platform_outstanding": _money(trading.outstanding),
        "platform_revenue_last_7_days": _money(trading.revenue_last_7_days),
        "top_shops": top_shops,
        "recent_activity": (
            db.query(AdminAuditLog)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .limit(8)
            .all()
        ),
    }


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------

def change_user_status(
    user_id: int,
    target_status: str,
    db: Session,
    current_user: User,
    *,
    reason: str | None = None,
    ip_address: str | None = None,
):
    """Move one account to `target_status`, or refuse.

    The order of checks matters:
      1. target exists
      2. not acting on yourself (lock-out / escalation guard)
      3. not stranding the platform without a super admin
      4. the transition is legal from the CURRENT state (blocks double-actions)
      5. apply, mirror `is_active`, audit -- all in one transaction
    """
    target = _get_user_or_404(user_id, db)
    current_status = normalize_status(target.status)
    action_label = _ACTION_LABELS.get(target_status, "modify")

    _guard_not_self(current_user, target, action_label)

    if target_status in _ACCESS_REMOVING_STATUSES:
        _guard_last_super_admin(db, target, action_label)

    if not is_transition_allowed(current_status, target_status):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot change status from '{current_status}' to "
                f"'{target_status}'. Allowed next states: "
                f"{', '.join(allowed_targets(current_status)) or 'none'}."
            ),
        )

    # Approving a PENDING account is a different event from reactivating a
    # SUSPENDED one, even though both land on ACTIVE.
    if target_status == UserStatus.ACTIVE:
        action = (
            AuditAction.USER_APPROVED
            if current_status == UserStatus.PENDING
            else AuditAction.USER_REACTIVATED
        )
    else:
        action = _STATUS_ACTIONS[target_status]

    # Returning to ACTIVE is a fresh start: clear the note explaining the old
    # state so a reactivated account does not keep displaying why it was once
    # suspended.
    stored_reason = None
    if target_status != UserStatus.ACTIVE and isinstance(reason, str):
        stored_reason = reason.strip() or None

    target.status = target_status
    target.is_active = derive_is_active(target_status)
    target.status_reason = stored_reason
    target.status_changed_at = _utcnow()

    audit_service.record_admin_action(
        db,
        actor=current_user,
        action=action,
        target=target,
        previous_value=current_status,
        new_value=target_status,
        reason=reason,
        ip_address=ip_address,
    )

    db.commit()
    db.refresh(target)

    messages = {
        AuditAction.USER_APPROVED: "User approved successfully",
        AuditAction.USER_REJECTED: "User rejected successfully",
        AuditAction.USER_SUSPENDED: "User suspended successfully",
        AuditAction.USER_REACTIVATED: "User reactivated successfully",
        AuditAction.USER_DISABLED: "User disabled successfully",
    }

    return {
        "message": messages[action],
        "user": _serialize_user_with_shop_lookup(target, db),
    }


def change_user_role(
    user_id: int,
    new_role: str,
    db: Session,
    current_user: User,
    *,
    ip_address: str | None = None,
):
    """Assign a role. Never self-service.

    Privilege escalation is blocked structurally rather than by inspecting the
    requested value: only a super admin reaches this function at all, and no
    one may change their own role. So a regular user cannot promote themselves
    (403 at the dependency) and a super admin cannot quietly rewrite their own
    entry either.
    """
    normalized_role = (new_role or "").strip().lower()

    if normalized_role not in UserRole.ALL:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"role must be one of: {', '.join(UserRole.ALL)}",
        )

    target = _get_user_or_404(user_id, db)

    _guard_not_self(current_user, target, "change the role of")

    previous_role = normalize_role(target.role)

    if previous_role == normalized_role:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"User already has the '{normalized_role}' role",
        )

    # Demoting the last super admin would leave the platform unadministrable.
    if previous_role == UserRole.SUPER_ADMIN:
        _guard_last_super_admin(db, target, "demote")

    # Promotion only makes sense for an account that can actually sign in.
    if (
        normalized_role == UserRole.SUPER_ADMIN
        and normalize_status(target.status) != UserStatus.ACTIVE
    ):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Only an active user can be promoted to super admin",
        )

    target.role = normalized_role

    audit_service.record_admin_action(
        db,
        actor=current_user,
        action=AuditAction.ROLE_CHANGED,
        target=target,
        previous_value=previous_role,
        new_value=normalized_role,
        ip_address=ip_address,
    )

    db.commit()
    db.refresh(target)

    return {
        "message": f"Role updated to '{normalized_role}'",
        "user": _serialize_user_with_shop_lookup(target, db),
    }
