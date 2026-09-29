from jose import JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.core.user_status import (
    can_login,
    is_super_admin,
    login_refusal_message,
)
from app.services.entitlement_service import evaluate_shop_access
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

    return user


def get_shop_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Gate for every shop-scoped route.

    A super admin operates the platform and owns no shop, so `shop_id` is
    NULL for them. Without this guard those accounts would fall through to
    the ordinary services, where a `shop_id IS NULL` filter silently returns
    empty lists on reads and a write would fail a NOT NULL constraint with a
    500. A clear refusal is better than either.

    This is not a permission check -- it is a "this route needs a shop"
    check. Shop owners pass it unchanged, so ordinary behaviour is
    completely unaffected.
    """
    if current_user.shop_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This area belongs to shop accounts. Your administrator "
                "account does not have a shop."
            ),
        )

    return current_user


def require_active_shop_access(
    current_user: User = Depends(get_shop_user),
    db: Session = Depends(get_db),
) -> User:
    """Gate for normal tenant business operations.

    Authentication and shop membership are handled by get_shop_user. This layer
    answers the SaaS question: may this shop use the operational app right now?
    Subscription recovery/payment routes intentionally keep get_shop_user so an
    expired customer can still renew.
    """
    access = evaluate_shop_access(current_user.shop_id, db)
    if not access.allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": access.code,
                "message": access.message or "This shop does not currently have access.",
                "details": {"shop_id": current_user.shop_id},
            },
        )

    return current_user


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
