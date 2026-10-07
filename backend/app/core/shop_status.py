class ShopStatus:
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"

    ALL = (PENDING, ACTIVE, INACTIVE)


def normalize_shop_status(value: str | None) -> str:
    candidate = str(value or "").strip().lower()
    if candidate not in ShopStatus.ALL:
        raise ValueError("Unsupported shop lifecycle status")
    return candidate

