"""Reusable domain error vocabulary for commercial access checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status


class DomainErrorCode:
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED"
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"
    LICENSE_INACTIVE = "LICENSE_INACTIVE"
    LICENSE_EXPIRED = "LICENSE_EXPIRED"
    SUBSCRIPTION_SUSPENDED = "SUBSCRIPTION_SUSPENDED"
    PLAN_LIMIT_REACHED = "PLAN_LIMIT_REACHED"
    FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE"
    SHOP_OVER_LIMIT = "SHOP_OVER_LIMIT"
    PAYMENT_REQUIRED = "PAYMENT_REQUIRED"
    ENTITLEMENT_NOT_CONFIGURED = "ENTITLEMENT_NOT_CONFIGURED"
    USAGE_UNSUPPORTED = "USAGE_UNSUPPORTED"


_DEFAULT_STATUS_BY_CODE = {
    DomainErrorCode.SUBSCRIPTION_REQUIRED: status.HTTP_402_PAYMENT_REQUIRED,
    DomainErrorCode.SUBSCRIPTION_EXPIRED: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.PAYMENT_REQUIRED: status.HTTP_402_PAYMENT_REQUIRED,
    DomainErrorCode.LICENSE_INACTIVE: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.LICENSE_EXPIRED: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.SUBSCRIPTION_SUSPENDED: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.PLAN_LIMIT_REACHED: status.HTTP_409_CONFLICT,
    DomainErrorCode.FEATURE_NOT_AVAILABLE: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.SHOP_OVER_LIMIT: status.HTTP_409_CONFLICT,
    DomainErrorCode.ENTITLEMENT_NOT_CONFIGURED: status.HTTP_403_FORBIDDEN,
    DomainErrorCode.USAGE_UNSUPPORTED: status.HTTP_409_CONFLICT,
}


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    status_code: int | None = None
    details: dict[str, Any] | None = None

    def to_http_exception(self) -> HTTPException:
        return HTTPException(
            status_code=self.status_code or _DEFAULT_STATUS_BY_CODE.get(
                self.code, status.HTTP_400_BAD_REQUEST
            ),
            detail={
                "code": self.code,
                "message": self.message,
                "details": self.details or {},
            },
        )
