"""License key generation and storage helpers.

The raw license key is generated with high entropy and is only returned by the
creation helper. The database stores a SHA-256 digest plus a masked display
form, so normal reads never expose the secret.
"""

from __future__ import annotations

import hashlib
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.subscription_status import LicenseStatus
from app.models.license import ShopLicense
from app.models.subscription import ShopSubscription

LICENSE_PREFIX = "PRPL"
LICENSE_RANDOM_LENGTH = 32
LICENSE_ALPHABET = string.ascii_uppercase + string.digits


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_license_key() -> str:
    random_part = "".join(
        secrets.choice(LICENSE_ALPHABET) for _ in range(LICENSE_RANDOM_LENGTH)
    )
    grouped = "-".join(
        random_part[index : index + 4] for index in range(0, len(random_part), 4)
    )
    return f"{LICENSE_PREFIX}-{grouped}"


def hash_license_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def mask_license_key(raw_key: str) -> str:
    prefix = raw_key[: len(LICENSE_PREFIX)]
    suffix = raw_key[-4:]
    return f"{prefix}-****-****-****-****-{suffix}"


def create_license_for_subscription(
    *,
    db: Session,
    subscription: ShopSubscription,
    status: str = LicenseStatus.ACTIVE,
) -> tuple[ShopLicense, str]:
    """Create one license row and return ``(license, raw_key)``.

    Callers may show the raw key exactly once if a future workflow needs it.
    Current application code stores only the license row and deliberately drops
    the raw value.
    """
    now = _utcnow()

    for _ in range(5):
        raw_key = generate_license_key()
        key_hash = hash_license_key(raw_key)
        if not db.query(ShopLicense).filter(ShopLicense.license_key_hash == key_hash).first():
            license_row = ShopLicense(
                shop_id=subscription.shop_id,
                subscription_id=subscription.id,
                license_key_hash=key_hash,
                license_key_prefix=LICENSE_PREFIX,
                license_key_suffix=raw_key[-4:],
                masked_key=mask_license_key(raw_key),
                status=status,
                issued_at=now,
                activated_at=now if status == LicenseStatus.ACTIVE else None,
            )
            db.add(license_row)
            return license_row, raw_key

    # With 32 base36 characters this should be unreachable; keeping an explicit
    # failure is still better than accidentally reusing a key.
    raise RuntimeError("Could not generate a unique license key")
