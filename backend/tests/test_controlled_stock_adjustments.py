from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.business_audit_log import BusinessAuditAction, BusinessAuditLog
from app.models.invoice_return import InvoiceReturnItem
from app.models.stock_adjustment_request import StockAdjustmentRequest
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.invoice import InvoiceCreate, InvoiceReturnCreate
from app.schemas.product import ProductCreate
from app.schemas.stock import PhysicalStockCountCreate, StockAdjustmentCreate
from app.services.invoice_service import create_invoice, create_invoice_return
from app.services.product_service import create_product
from app.services.stock_service import (
    apply_stock_movement,
    create_stock_adjustment,
    reconcile_physical_stock_count,
    reconcile_stock_balances,
)


def _product(db, user, *, sku: str, stock: int = 10):
    return create_product(
        ProductCreate(
            name=f"Adjustment {sku}",
            sku=sku,
            category="General",
            buying_price=Decimal("40.00"),
            mrp=Decimal("100.00"),
            selling_price=Decimal("100.00"),
            stock_quantity=stock,
            low_stock_threshold=1,
            unit="pcs",
        ),
        user,
        db,
    )


def _adjust(*, key: str, direction: str, quantity: int, reason: str, notes=None):
    return StockAdjustmentCreate(
        client_request_id=key,
        direction=direction,
        quantity=quantity,
        reason=reason,
        notes=notes,
    )


def _count(*, key: str, quantity: int, reason: str = "manual_correction", notes=None):
    return PhysicalStockCountCreate(
        client_request_id=key,
        counted_quantity=quantity,
        reason=reason,
        notes=notes,
    )


def _movement_rows(db, product_id):
    return (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product_id)
        .order_by(StockMovement.id)
        .all()
    )


def test_adjustment_in_found_stock_updates_balance_and_ledger(db_session, make_user):
    user = make_user(email="adjust-in@example.com")
    product = _product(db_session, user, sku="ADJ-IN", stock=8)

    result = create_stock_adjustment(
        db_session,
        product_id=product.id,
        payload=_adjust(key="adjust-in-key", direction="in", quantity=3, reason="found_stock"),
        current_user=user,
    )

    db_session.refresh(product)
    assert (result["quantity_before"], result["quantity_delta"], result["quantity_after"]) == (8, 3, 11)
    assert product.stock_quantity == 11
    assert _movement_rows(db_session, product.id)[-1].movement_type == StockMovementType.ADJUSTMENT_IN
    assert reconcile_stock_balances(db_session, shop_id=user.shop_id)["mismatch_count"] == 0


@pytest.mark.parametrize("reason", ["damaged", "defective", "expired", "lost", "theft_shrinkage"])
def test_adjustment_out_controlled_reasons(db_session, make_user, reason):
    user = make_user(email=f"adjust-out-{reason}@example.com")
    product = _product(db_session, user, sku=f"OUT-{reason}", stock=8)

    result = create_stock_adjustment(
        db_session,
        product_id=product.id,
        payload=_adjust(key=f"out-{reason}-key", direction="out", quantity=2, reason=reason),
        current_user=user,
    )

    assert result["quantity_after"] == 6
    assert result["movement_type"] == StockMovementType.ADJUSTMENT_OUT


def test_adjustment_out_cannot_make_stock_negative(db_session, make_user):
    user = make_user(email="adjust-negative@example.com")
    product = _product(db_session, user, sku="NO-NEGATIVE", stock=1)
    movement_count = len(_movement_rows(db_session, product.id))

    with pytest.raises(HTTPException) as exc:
        create_stock_adjustment(
            db_session,
            product_id=product.id,
            payload=_adjust(key="negative-key", direction="out", quantity=2, reason="damaged"),
            current_user=user,
        )

    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product)
    assert product.stock_quantity == 1
    assert len(_movement_rows(db_session, product.id)) == movement_count
    assert db_session.query(StockAdjustmentRequest).filter_by(client_request_id="negative-key").count() == 0


def test_adjustment_reason_is_required_and_other_requires_notes():
    with pytest.raises(ValidationError):
        StockAdjustmentCreate(
            client_request_id="missing-reason-key",
            direction="in",
            quantity=1,
            reason="",
        )
    with pytest.raises(ValidationError):
        StockAdjustmentCreate(
            client_request_id="other-reason-key",
            direction="out",
            quantity=1,
            reason="other",
        )
    with pytest.raises(ValidationError):
        PhysicalStockCountCreate(
            client_request_id="other-count-key",
            counted_quantity=4,
            reason="other",
        )


@pytest.mark.parametrize(
    ("counted", "expected_delta", "expected_type"),
    [
        (7, -3, StockMovementType.ADJUSTMENT_OUT),
        (13, 3, StockMovementType.ADJUSTMENT_IN),
    ],
)
def test_physical_count_calculates_direction_from_locked_balance(
    db_session, make_user, counted, expected_delta, expected_type
):
    user = make_user(email=f"physical-{counted}@example.com")
    product = _product(db_session, user, sku=f"COUNT-{counted}", stock=10)

    result = reconcile_physical_stock_count(
        db_session,
        product_id=product.id,
        payload=_count(key=f"physical-count-{counted}", quantity=counted),
        current_user=user,
    )

    assert result["quantity_delta"] == expected_delta
    assert result["quantity_after"] == counted
    assert result["movement_type"] == expected_type


def test_equal_physical_count_is_recorded_without_zero_movement(db_session, make_user):
    user = make_user(email="physical-equal@example.com")
    product = _product(db_session, user, sku="COUNT-EQUAL", stock=10)
    before_count = len(_movement_rows(db_session, product.id))
    payload = _count(key="physical-equal-key", quantity=10)

    first = reconcile_physical_stock_count(
        db_session, product_id=product.id, payload=payload, current_user=user
    )
    replay = reconcile_physical_stock_count(
        db_session, product_id=product.id, payload=payload, current_user=user
    )

    assert first["quantity_delta"] == 0
    assert first["movement_id"] is None
    assert replay["replayed"] is True
    assert len(_movement_rows(db_session, product.id)) == before_count
    assert (
        db_session.query(BusinessAuditLog)
        .filter(BusinessAuditLog.action == BusinessAuditAction.INVENTORY_COUNT_RECONCILED)
        .count()
        == 1
    )


def test_physical_count_uses_current_balance_not_stale_frontend_balance(db_session, make_user):
    user = make_user(email="physical-stale@example.com")
    product = _product(db_session, user, sku="COUNT-STALE", stock=10)
    apply_stock_movement(
        db_session,
        product=product,
        shop_id=user.shop_id,
        movement_type=StockMovementType.SALE,
        quantity_delta=-2,
        reference_type="test_sale",
        reference_id=1,
        actor=user,
        client_request_id="stale-count-sale",
    )
    db_session.commit()

    result = reconcile_physical_stock_count(
        db_session,
        product_id=product.id,
        payload=_count(key="stale-count-request", quantity=10),
        current_user=user,
    )

    assert (result["quantity_before"], result["quantity_delta"], result["quantity_after"]) == (8, 2, 10)


def test_adjustment_retry_is_idempotent_and_audited_once(db_session, make_user):
    user = make_user(email="adjust-replay@example.com")
    product = _product(db_session, user, sku="ADJ-REPLAY", stock=5)
    payload = _adjust(key="adjust-replay-key", direction="in", quantity=2, reason="found_stock")

    first = create_stock_adjustment(
        db_session, product_id=product.id, payload=payload, current_user=user
    )
    replay = create_stock_adjustment(
        db_session, product_id=product.id, payload=payload, current_user=user
    )

    db_session.refresh(product)
    assert replay["id"] == first["id"]
    assert replay["replayed"] is True
    assert product.stock_quantity == 7
    assert len([row for row in _movement_rows(db_session, product.id) if row.movement_type == StockMovementType.ADJUSTMENT_IN]) == 1
    assert (
        db_session.query(BusinessAuditLog)
        .filter(
            BusinessAuditLog.action == BusinessAuditAction.INVENTORY_ADJUSTED,
            BusinessAuditLog.entity_id == product.id,
        )
        .count()
        == 1
    )


def test_same_adjustment_key_with_different_payload_conflicts(db_session, make_user):
    user = make_user(email="adjust-conflict@example.com")
    product = _product(db_session, user, sku="ADJ-CONFLICT", stock=5)
    create_stock_adjustment(
        db_session,
        product_id=product.id,
        payload=_adjust(key="adjust-conflict-key", direction="in", quantity=1, reason="found_stock"),
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        create_stock_adjustment(
            db_session,
            product_id=product.id,
            payload=_adjust(key="adjust-conflict-key", direction="in", quantity=3, reason="found_stock"),
            current_user=user,
        )

    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product)
    assert product.stock_quantity == 6


def test_adjustment_tenant_isolation_and_api_subscription_protection(
    db_session, make_user, client, auth_headers
):
    user_a = make_user(email="adjust-tenant-a@example.com")
    user_b = make_user(email="adjust-tenant-b@example.com")
    product_a = _product(db_session, user_a, sku="TENANT-A", stock=5)
    headers_b = auth_headers(user_b.email)

    response = client.post(
        f"/api/v1/inventory/products/{product_a.id}/adjustments",
        headers=headers_b,
        json={
            "client_request_id": "tenant-isolation-key",
            "direction": "in",
            "quantity": 1,
            "reason": "found_stock",
        },
    )

    assert response.status_code == 404
    db_session.refresh(product_a)
    assert product_a.stock_quantity == 5


def test_inactive_and_unknown_products_are_rejected(db_session, make_user):
    user = make_user(email="adjust-inactive@example.com")
    product = _product(db_session, user, sku="INACTIVE", stock=5)
    product.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as inactive:
        create_stock_adjustment(
            db_session,
            product_id=product.id,
            payload=_adjust(key="inactive-key", direction="in", quantity=1, reason="found_stock"),
            current_user=user,
        )
    assert inactive.value.status_code == 409
    db_session.rollback()

    with pytest.raises(HTTPException) as missing:
        create_stock_adjustment(
            db_session,
            product_id=999999,
            payload=_adjust(key="missing-key", direction="in", quantity=1, reason="found_stock"),
            current_user=user,
        )
    assert missing.value.status_code == 404


def test_ledger_mismatch_blocks_adjustment_without_auto_repair(db_session, make_user):
    user = make_user(email="adjust-mismatch@example.com")
    product = _product(db_session, user, sku="ADJ-MISMATCH", stock=5)
    product.stock_quantity = 4
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_stock_adjustment(
            db_session,
            product_id=product.id,
            payload=_adjust(key="mismatch-key", direction="in", quantity=1, reason="found_stock"),
            current_user=user,
        )

    assert exc.value.status_code == 409
    assert "integrity" in exc.value.detail.lower()
    db_session.rollback()
    assert reconcile_stock_balances(db_session, shop_id=user.shop_id)["mismatch_count"] == 1


def test_non_restocked_return_is_not_subtracted_again(db_session, make_user):
    user = make_user(email="non-restocked-adjust@example.com")
    product = _product(db_session, user, sku="NON-RESTOCK", stock=5)
    invoice = create_invoice(
        InvoiceCreate.model_validate(
            {
                "client_request_id": "non-restock-invoice",
                "customer": {"first_name": "Damaged", "phone": "9000099999"},
                "items": [
                    {
                        "product_id": product.id,
                        "product_code": product.sku,
                        "quantity": 2,
                        "discount_percentage": Decimal("0.00"),
                    }
                ],
                "invoice_date": date(2026, 10, 2),
                "payment_status": "pending",
                "paid_amount": Decimal("0.00"),
                "total_tax_amount": Decimal("0.00"),
                "invoice_status": "saved",
            }
        ),
        db_session,
        user,
    )
    returned = create_invoice_return(
        invoice.id,
        InvoiceReturnCreate.model_validate(
            {
                "client_request_id": "non-restock-return",
                "reason": "Damaged goods",
                "items": [
                    {
                        "invoice_item_id": invoice.items[0].id,
                        "quantity": 2,
                        "restocked_quantity": 0,
                        "disposition": "damaged",
                    }
                ],
            }
        ),
        db_session,
        user,
    )

    db_session.refresh(product)
    item = db_session.query(InvoiceReturnItem).filter_by(return_id=returned.id).one()
    assert item.non_restocked_quantity == 2
    assert product.stock_quantity == 3
    assert not any(
        row.movement_type == StockMovementType.ADJUSTMENT_OUT
        for row in _movement_rows(db_session, product.id)
    )


def test_return_to_sellable_is_explicit_adjustment_in(db_session, make_user):
    user = make_user(email="return-sellable@example.com")
    product = _product(db_session, user, sku="RETURN-SELLABLE", stock=3)

    result = create_stock_adjustment(
        db_session,
        product_id=product.id,
        payload=_adjust(
            key="return-sellable-key",
            direction="in",
            quantity=1,
            reason="return_to_sellable",
            notes="Inspected and approved",
        ),
        current_user=user,
    )

    assert result["quantity_after"] == 4
    movement = _movement_rows(db_session, product.id)[-1]
    assert (movement.movement_type, movement.reason) == (
        StockMovementType.ADJUSTMENT_IN,
        "return_to_sellable",
    )
