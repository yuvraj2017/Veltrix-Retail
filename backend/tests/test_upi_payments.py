import json
from decimal import Decimal

from app.core.user_status import UserStatus
from app.models.commercial_event import PaymentGatewayConfig, SubscriptionPayment
from app.models.plan import Plan
from app.services.secret_service import decrypt_secret


def _paid_plan(db_session) -> Plan:
    plan = Plan(
        code="upi-pro",
        name="UPI Pro",
        monthly_price=Decimal("499.00"),
        annual_price=Decimal("4990.00"),
        currency="INR",
        is_active=True,
        is_archived=False,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)
    return plan


def _configure_upi(client, admin_headers):
    return client.post(
        "/api/v1/admin/payment-gateways",
        headers=admin_headers,
        json={
            "provider": "upi_manual",
            "display_name": "Direct UPI",
            "settings": {
                "upi_id": "billing@bank",
                "payee_name": "Purple Retail",
                "merchant_code": "7399",
                "note_prefix": "Plan payment",
                "instructions": "Use the exact amount and submit the UTR.",
            },
            "is_active": True,
            "is_test_mode": False,
        },
    )


def test_admin_can_configure_encrypted_upi_gateway(client, admin_headers, db_session):
    response = _configure_upi(client, admin_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "upi_manual"
    assert body["settings"]["upi_id"] == "billing@bank"
    assert body["key_secret_masked"] is None

    row = db_session.query(PaymentGatewayConfig).one()
    assert "billing@bank" not in row.settings_encrypted
    assert json.loads(decrypt_secret(row.settings_encrypted))["upi_id"] == "billing@bank"


def test_upi_checkout_submission_and_admin_approval(
    client,
    admin_headers,
    make_user,
    auth_headers,
    db_session,
):
    owner = make_user(email="upi-owner@example.com", status=UserStatus.ACTIVE)
    owner_headers = auth_headers(owner.email)
    plan = _paid_plan(db_session)
    assert _configure_upi(client, admin_headers).status_code == 200

    checkout = client.post(
        "/api/v1/subscription/checkout",
        headers=owner_headers,
        json={"plan_id": plan.id, "billing_interval": "monthly"},
    )
    assert checkout.status_code == 200, checkout.text
    session = checkout.json()
    assert session["provider"] == "upi_manual"
    assert session["metadata"]["upi_id"] == "billing@bank"
    assert session["metadata"]["amount"] == "499.00"
    assert session["metadata"]["upi_uri"].startswith("upi://pay?")

    payment_id = session["metadata"]["payment_id"]
    submitted = client.post(
        "/api/v1/subscription/payments/upi/submit",
        headers=owner_headers,
        json={"payment_id": payment_id, "customer_reference": "123456789012"},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"

    payment = (
        db_session.query(SubscriptionPayment)
        .filter(SubscriptionPayment.provider_payment_id == payment_id)
        .one()
    )
    assert payment.status == "submitted"
    assert payment.customer_reference == "123456789012"

    denied = client.post(
        f"/api/v1/admin/payments/{payment.id}/upi-review",
        headers=owner_headers,
        json={"status": "succeeded"},
    )
    assert denied.status_code == 403

    approved = client.post(
        f"/api/v1/admin/payments/{payment.id}/upi-review",
        headers=admin_headers,
        json={"status": "succeeded", "reason": "UTR matched bank statement"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "verified"
    assert approved.json()["subscription"]["plan_id"] == plan.id

    overview = client.get("/api/v1/subscription/me", headers=owner_headers)
    assert overview.status_code == 200
    assert overview.json()["plan"]["id"] == plan.id
    assert overview.json()["subscription"]["provider"] == "upi_manual"
    assert overview.json()["license"]["status"] == "active"


def test_upi_reference_is_unique_and_shop_scoped(
    client,
    admin_headers,
    make_user,
    auth_headers,
    db_session,
):
    first = make_user(email="upi-first@example.com", status=UserStatus.ACTIVE)
    second = make_user(email="upi-second@example.com", status=UserStatus.ACTIVE)
    first_headers = auth_headers(first.email)
    second_headers = auth_headers(second.email)
    plan = _paid_plan(db_session)
    assert _configure_upi(client, admin_headers).status_code == 200

    first_checkout = client.post(
        "/api/v1/subscription/checkout",
        headers=first_headers,
        json={"plan_id": plan.id, "billing_interval": "monthly"},
    ).json()
    second_checkout = client.post(
        "/api/v1/subscription/checkout",
        headers=second_headers,
        json={"plan_id": plan.id, "billing_interval": "monthly"},
    ).json()

    stolen = client.post(
        "/api/v1/subscription/payments/upi/submit",
        headers=second_headers,
        json={
            "payment_id": first_checkout["metadata"]["payment_id"],
            "customer_reference": "ABC123456789",
        },
    )
    assert stolen.status_code == 404

    assert client.post(
        "/api/v1/subscription/payments/upi/submit",
        headers=first_headers,
        json={
            "payment_id": first_checkout["metadata"]["payment_id"],
            "customer_reference": "ABC123456789",
        },
    ).status_code == 200

    duplicate = client.post(
        "/api/v1/subscription/payments/upi/submit",
        headers=second_headers,
        json={
            "payment_id": second_checkout["metadata"]["payment_id"],
            "customer_reference": "ABC123456789",
        },
    )
    assert duplicate.status_code == 409


def test_upi_payment_can_be_rejected_without_changing_plan(
    client,
    admin_headers,
    make_user,
    auth_headers,
    db_session,
):
    owner = make_user(email="upi-reject@example.com", status=UserStatus.ACTIVE)
    owner_headers = auth_headers(owner.email)
    original_plan_id = client.get("/api/v1/subscription/me", headers=owner_headers).json()["plan"]["id"]
    plan = _paid_plan(db_session)
    assert _configure_upi(client, admin_headers).status_code == 200

    checkout = client.post(
        "/api/v1/subscription/checkout",
        headers=owner_headers,
        json={"plan_id": plan.id, "billing_interval": "annual"},
    ).json()
    payment_id = checkout["metadata"]["payment_id"]
    client.post(
        "/api/v1/subscription/payments/upi/submit",
        headers=owner_headers,
        json={"payment_id": payment_id, "customer_reference": "998877665544"},
    )
    payment = db_session.query(SubscriptionPayment).filter_by(provider_payment_id=payment_id).one()

    rejected = client.post(
        f"/api/v1/admin/payments/{payment.id}/upi-review",
        headers=admin_headers,
        json={"status": "failed", "reason": "Reference was not found"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert client.get("/api/v1/subscription/me", headers=owner_headers).json()["plan"]["id"] == original_plan_id
