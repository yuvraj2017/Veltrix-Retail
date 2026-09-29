"""Create or promote the first super admin.

This deliberately has no API equivalent: the first super admin cannot be
created through HTTP, because doing so would mean shipping an unauthenticated
route that mints platform-level privilege. Bootstrapping therefore requires
shell access to the server.

Usage (from the backend/ directory, with the venv active):

    python -m scripts.create_super_admin --email you@example.com

    # promote an existing account instead of creating one
    python -m scripts.create_super_admin --email existing@example.com --promote

The password is read interactively and never taken from argv, so it does not
land in shell history or the process table.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from datetime import datetime, timezone

# Allow running as `python scripts/create_super_admin.py` as well as `-m`.
if __package__ in (None, ""):
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.core.user_status import UserRole, UserStatus  # noqa: E402
from app.models.admin_audit_log import AdminAuditLog, AuditAction  # noqa: E402
from app.models.user import User  # noqa: E402

MIN_PASSWORD_LENGTH = 12


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _prompt_password() -> str:
    password = getpass.getpass("Password: ")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )

    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")

    return password


def _find_by_email(db, email: str) -> User | None:
    """Case-insensitive lookup.

    Registration lowercases addresses, but a few rows predate that and are
    stored with mixed case (e.g. `Yash@gmail.com`). An exact match would
    miss those and wrongly report that the account does not exist.
    """
    return db.query(User).filter(func.lower(User.email) == email).first()


def promote(db, email: str) -> int:
    user = _find_by_email(db, email)

    if not user:
        raise SystemExit(f"No account found for {email}.")

    if user.role == UserRole.SUPER_ADMIN and user.status == UserStatus.ACTIVE:
        print(f"{user.email} is already an active super admin. Nothing to do.")
        return 0

    previous_role = user.role
    previous_status = user.status
    previous_shop_id = user.shop_id

    user.role = UserRole.SUPER_ADMIN
    user.status = UserStatus.ACTIVE
    user.is_active = True
    user.status_changed_at = _utcnow()
    user.status_reason = None
    # Detached from any shop: the account is now a platform operator. The
    # shop row itself is left untouched -- only this user stops pointing at it.
    user.shop_id = None

    db.add(
        AdminAuditLog(
            actor_user_id=user.id,
            actor_email=user.email,
            action=AuditAction.ROLE_CHANGED,
            target_user_id=user.id,
            target_email=user.email,
            previous_value=previous_role,
            new_value=UserRole.SUPER_ADMIN,
            reason="Promoted via create_super_admin bootstrap script",
        )
    )

    db.commit()
    print(
        f"Promoted {user.email}: role {previous_role} -> {UserRole.SUPER_ADMIN}, "
        f"status {previous_status} -> {UserStatus.ACTIVE}"
    )
    if previous_shop_id is not None:
        print(
            f"Detached from shop id {previous_shop_id}; the shop record itself "
            "was not modified."
        )
    print("Sign in with this account and you will land on /admin.")
    return 0


def create(db, email: str, name: str) -> int:
    if _find_by_email(db, email):
        raise SystemExit(
            f"An account already exists for {email}. Re-run with --promote to "
            "grant it super admin instead."
        )

    password = _prompt_password()

    parts = name.strip().split()
    user = User(
        # No shop: a super admin operates the platform rather than trading on
        # it. Shop-scoped routes are gated by get_shop_user, so this account
        # simply has no business surface of its own.
        shop_id=None,
        full_name=name.strip(),
        first_name=parts[0] if parts else None,
        last_name=" ".join(parts[1:]) or None if len(parts) > 1 else None,
        email=email,
        password_hash=hash_password(password),
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        is_active=True,
        status_changed_at=_utcnow(),
    )
    db.add(user)
    db.flush()

    db.add(
        AdminAuditLog(
            actor_user_id=user.id,
            actor_email=user.email,
            action=AuditAction.ROLE_CHANGED,
            target_user_id=user.id,
            target_email=user.email,
            previous_value=None,
            new_value=UserRole.SUPER_ADMIN,
            reason="Created via create_super_admin bootstrap script",
        )
    )

    db.commit()
    print(f"Created super admin {user.email} (user id {user.id}, no shop).")
    print("Sign in with this account and you will land on /admin.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create or promote a super admin. Password is prompted, never passed as an argument."
    )
    parser.add_argument("--email", required=True, help="Account email address")
    parser.add_argument(
        "--name",
        default="Platform Administrator",
        help="Full name (only used when creating a new account)",
    )
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Promote an existing account instead of creating one",
    )
    args = parser.parse_args()

    email = args.email.strip().lower()
    db = SessionLocal()

    try:
        return promote(db, email) if args.promote else create(db, email, args.name)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
