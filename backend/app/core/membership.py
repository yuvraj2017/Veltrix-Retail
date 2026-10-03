"""Tenant membership vocabulary.

Membership roles are deliberately strict. Unlike the legacy user-role helper,
unknown values never fall back to owner access.
"""


class MembershipRole:
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"
    INVENTORY_MANAGER = "inventory_manager"
    PURCHASING_MANAGER = "purchasing_manager"
    REPORT_VIEWER = "report_viewer"

    ALL = (
        OWNER,
        ADMIN,
        MANAGER,
        CASHIER,
        INVENTORY_MANAGER,
        PURCHASING_MANAGER,
        REPORT_VIEWER,
    )


class MembershipStatus:
    ACTIVE = "active"
    INACTIVE = "inactive"

    ALL = (ACTIVE, INACTIVE)


def normalize_membership_role(value: str | None) -> str:
    candidate = str(value or "").strip().lower()
    if candidate not in MembershipRole.ALL:
        raise ValueError("Unsupported organization membership role")
    return candidate


def normalize_membership_status(value: str | None) -> str:
    candidate = str(value or "").strip().lower()
    if candidate not in MembershipStatus.ALL:
        raise ValueError("Unsupported membership status")
    return candidate
