"""Account status and role vocabulary, plus the legal transitions between states.

This module is the single source of truth for what an account status means and
which changes are allowed. Both the admin service and the auth service import
from here so the rules cannot drift apart.

Background: the ``users`` table already carried an ``is_active`` boolean, which
only ever answered "may this person log in". An approval workflow needs more
resolution than that -- a rejected signup and a suspended shop are both
"not active" but they are not the same thing, and they permit different next
moves. ``status`` therefore becomes authoritative and ``is_active`` is kept in
sync as a mirror (see ``derive_is_active``) so existing queries, the committed
SQL dumps, and any external tooling continue to read correctly.
"""

from __future__ import annotations


class UserStatus:
    """Account lifecycle states.

    PENDING   a fresh registration awaiting review. Cannot authenticate.
    ACTIVE    approved and usable. The only state that may authenticate.
    REJECTED  the signup was declined. Terminal.
    SUSPENDED access withdrawn, reversible. Cannot authenticate.
    DISABLED  access withdrawn for good. Terminal.
    """

    PENDING = "pending"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    DISABLED = "disabled"

    ALL = (PENDING, ACTIVE, REJECTED, SUSPENDED, DISABLED)

    # Terminal states accept no further transitions.
    TERMINAL = (REJECTED, DISABLED)


class UserRole:
    """Roles. Deliberately just two.

    OWNER       the shop owner -- the pre-existing default, unchanged.
    SUPER_ADMIN platform operator with cross-shop administrative control.

    A roles/permissions table would be over-engineering for two values; the
    existing ``users.role`` string column carries this fine.
    """

    OWNER = "owner"
    SUPER_ADMIN = "super_admin"

    ALL = (OWNER, SUPER_ADMIN)


# Only ACTIVE accounts may authenticate. Everything else is refused at login
# AND on every authenticated request (see app/api/deps.py).
LOGIN_ALLOWED_STATUSES = (UserStatus.ACTIVE,)


# Legal transitions. Anything absent from this map is rejected with 409, which
# is what makes double-approval and other repeated actions safe.
ALLOWED_TRANSITIONS: dict[str, tuple[str, ...]] = {
    UserStatus.PENDING: (UserStatus.ACTIVE, UserStatus.REJECTED),
    UserStatus.ACTIVE: (UserStatus.SUSPENDED, UserStatus.DISABLED),
    UserStatus.SUSPENDED: (UserStatus.ACTIVE, UserStatus.DISABLED),
    UserStatus.REJECTED: (),
    UserStatus.DISABLED: (),
}


# Human-readable refusal shown at login. Kept deliberately vague about *why* an
# account is unavailable in the rejected case, so the endpoint cannot be used to
# probe administrative decisions.
STATUS_LOGIN_MESSAGES: dict[str, str] = {
    UserStatus.PENDING: (
        "Your account is awaiting approval. You will be able to sign in once an "
        "administrator has reviewed your registration."
    ),
    UserStatus.REJECTED: (
        "This account is not available. Please contact support if you believe "
        "this is a mistake."
    ),
    UserStatus.SUSPENDED: (
        "Your account has been suspended. Please contact support for assistance."
    ),
    UserStatus.DISABLED: (
        "This account has been disabled. Please contact support for assistance."
    ),
}


def normalize_status(value: str | None) -> str:
    """Coerce a stored value into a known status, defaulting to ACTIVE.

    Rows written before this column existed are treated as ACTIVE: they could
    authenticate before the feature landed and must continue to.
    """
    if not value:
        return UserStatus.ACTIVE

    candidate = str(value).strip().lower()
    return candidate if candidate in UserStatus.ALL else UserStatus.ACTIVE


def normalize_role(value: str | None) -> str:
    """Coerce a stored value into a known role, defaulting to OWNER."""
    if not value:
        return UserRole.OWNER

    candidate = str(value).strip().lower()
    return candidate if candidate in UserRole.ALL else UserRole.OWNER


def can_login(status: str | None) -> bool:
    return normalize_status(status) in LOGIN_ALLOWED_STATUSES


def login_refusal_message(status: str | None) -> str:
    return STATUS_LOGIN_MESSAGES.get(
        normalize_status(status),
        "This account is not available. Please contact support for assistance.",
    )


def is_transition_allowed(current: str | None, target: str) -> bool:
    return target in ALLOWED_TRANSITIONS.get(normalize_status(current), ())


def allowed_targets(current: str | None) -> tuple[str, ...]:
    """The states an account may move to next.

    Drives the admin UI so only actions that make sense for the current state
    are offered -- and is re-checked server-side, since the UI is not a
    security boundary.
    """
    return ALLOWED_TRANSITIONS.get(normalize_status(current), ())


def derive_is_active(status: str | None) -> bool:
    """Keep the legacy ``is_active`` mirror consistent with ``status``."""
    return normalize_status(status) == UserStatus.ACTIVE


def is_super_admin(role: str | None) -> bool:
    return normalize_role(role) == UserRole.SUPER_ADMIN
