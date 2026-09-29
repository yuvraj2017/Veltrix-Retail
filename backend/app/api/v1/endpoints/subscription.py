from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_shop_user
from app.models.user import User
from app.schemas.subscription import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    PaymentVerificationResponse,
    PublicPlanResponse,
    RazorpayVerifyPaymentRequest,
    ShopSubscriptionOverviewResponse,
    UpiPaymentReferenceRequest,
)
from app.services import commercial_service

router = APIRouter(prefix="/subscription", tags=["Subscription"])


@router.get("/me", response_model=ShopSubscriptionOverviewResponse)
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shop_user),
):
    return commercial_service.build_shop_subscription_overview(db, current_user.shop_id)


@router.get("/plans", response_model=list[PublicPlanResponse])
def list_available_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shop_user),
):
    return commercial_service.list_public_plan_catalog(db)


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout_session(
    payload: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shop_user),
):
    return commercial_service.create_checkout_session(
        db,
        current_user.shop_id,
        payload,
    )


@router.post("/payments/razorpay/verify", response_model=PaymentVerificationResponse)
def verify_razorpay_payment(
    payload: RazorpayVerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shop_user),
):
    return commercial_service.verify_razorpay_payment(
        db,
        current_user.shop_id,
        payload,
    )


@router.post("/payments/upi/submit", response_model=PaymentVerificationResponse)
def submit_upi_payment_reference(
    payload: UpiPaymentReferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shop_user),
):
    return commercial_service.submit_upi_payment_reference(
        db,
        current_user.shop_id,
        payload,
    )


@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    return commercial_service.handle_razorpay_webhook(
        db,
        raw_body=raw_body,
        signature=request.headers.get("X-Razorpay-Signature"),
    )
