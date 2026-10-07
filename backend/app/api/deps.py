from jose import JWTError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.core.permissions import ENDPOINT_PERMISSION_POLICIES
from app.core.user_status import (
    can_login,
    is_super_admin,
    login_refusal_message,
    normalize_role,
)
from app.services.entitlement_service import evaluate_shop_access
from app.services.authorization_service import (
    TenantAuthorizationContext,
    resolve_tenant_authorization_context,
)
from app.models.user import User

bearer_scheme = HTTPBearer()

# Marker prefix on account-status refusals. The frontend axios interceptor keys
# off this to clear the stored session and return the person to the login page,
# rather than leaving a suspended user staring at a page whose every request
# fails. Plain authorisation failures deliberately do NOT carry it.
ACCOUNT_INACTIVE_CODE = "account_inactive"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # A malformed `sub` is an invalid token, not a server error.
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # This is what makes administrative action take effect immediately.
    #
    # Access tokens are stateless JWTs with no server-side session record, so
    # there is nothing to revoke -- but this dependency already re-reads the
    # user row on every single request, so checking `status` here means a
    # suspension, rejection or disable applies on the target's very next
    # request. No token versioning, no session table, no second auth mechanism.
    #
    # `status` is authoritative; `is_active` is its legacy mirror and is checked
    # too so that any row changed by hand through SQL is still honoured.
    if not can_login(user.status) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{ACCOUNT_INACTIVE_CODE}: {login_refusal_message(user.status)}",
        )

    try:
        normalize_role(user.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account role is invalid and requires administrator review",
        )

    return user


def get_tenant_authorization_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantAuthorizationContext:
    return resolve_tenant_authorization_context(db, current_user)


def get_shop_user(
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
) -> User:
    """Compatibility gate backed by active organization/branch membership."""
    return context.user


def _enforce_commercial_access(context: TenantAuthorizationContext, db: Session) -> None:
    access = evaluate_shop_access(context.shop.id, db)
    if not access.allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": access.code,
                "message": access.message or "This shop does not currently have access.",
                "details": {"shop_id": context.shop.id},
            },
        )


def _authorize(
    *,
    context: TenantAuthorizationContext,
    permission: str,
    db: Session,
    require_entitlement: bool,
) -> User:
    if permission not in context.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )
    if require_entitlement:
        _enforce_commercial_access(context, db)
    return context.user


def require_permission(permission: str, *, require_entitlement: bool = True):
    """Create a reusable capability dependency for non-registered routes."""

    def dependency(
        context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
        db: Session = Depends(get_db),
    ) -> User:
        return _authorize(
            context=context,
            permission=permission,
            db=db,
            require_entitlement=require_entitlement,
        )

    dependency.required_permission = permission
    dependency.require_entitlement = require_entitlement
    return dependency


def require_active_shop_access(
    request: Request,
    context: TenantAuthorizationContext = Depends(get_tenant_authorization_context),
    db: Session = Depends(get_db),
) -> User:
    """Apply the explicit policy registered for the selected tenant endpoint."""
    route = request.scope.get("route")
    endpoint_name = getattr(route, "name", None)
    policy = ENDPOINT_PERMISSION_POLICIES.get(endpoint_name)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint has no tenant authorization policy",
        )
    return _authorize(
        context=context,
        permission=policy.permission,
        db=db,
        require_entitlement=policy.require_entitlement,
    )


def require_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Authorisation gate for every administrative endpoint.

    Depends on `get_current_user`, so authentication and the account-status
    check have both already run by the time the role is examined:

        authenticate -> verify status -> verify role -> validate -> act

    This is the real security boundary. The frontend hiding a nav item is only
    UX layering: a regular user calling an admin route directly lands here and
    is refused.
    """
    if not is_super_admin(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )

    return current_user
