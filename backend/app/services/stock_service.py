from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.business_audit_log import BusinessAuditAction
from app.models.stock_adjustment_request import StockAdjustmentRequest
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.user import User
from app.schemas.stock import (
    ADJUSTMENT_IN_REASONS,
    ADJUSTMENT_OUT_REASONS,
    PhysicalStockCountCreate,
    StockAdjustmentCreate,
)
from app.services.business_audit_service import record_business_audit


def _whole_quantity(value, *, field_name: str) -> int:
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a whole number.",
        ) from exc

    if quantity != quantity.to_integral_value():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a whole number.",
        )
    return int(quantity)


def apply_stock_movement(
    db: Session,
    *,
    product: Product,
    shop_id: int,
    movement_type: str,
    quantity_delta,
    reference_type: str,
    reference_id: int | None,
    actor: User | None,
    reference_line_id: int | None = None,
    reason: str | None = None,
    notes: str | None = None,
    client_request_id: str | None = None,
    allow_zero: bool = False,
) -> StockMovement:
    """Update sellable stock and append its explanation in the caller's transaction."""
    if product.shop_id != shop_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    locked_product = (
        db.query(Product)
        .filter(Product.id == product.id, Product.shop_id == shop_id)
        .with_for_update()
        .first()
    )
    if not locked_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product = locked_product
    if movement_type not in StockMovementType.ALL:
        raise ValueError(f"Unsupported stock movement type: {movement_type}")

    delta = _whole_quantity(quantity_delta, field_name="Stock movement quantity")
    if delta == 0 and not allow_zero:
        raise ValueError("Zero-quantity stock movements are not allowed")

    if client_request_id:
        existing = (
            db.query(StockMovement)
            .filter(
                StockMovement.shop_id == shop_id,
                StockMovement.client_request_id == client_request_id,
            )
            .first()
        )
        if existing:
            same_operation = (
                existing.product_id == product.id
                and existing.movement_type == movement_type
                and existing.quantity_delta == delta
                and existing.reference_type == reference_type
                and existing.reference_id == reference_id
                and existing.reference_line_id == reference_line_id
            )
            if not same_operation:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This stock operation key was already used for different movement data.",
                )
            return existing

    before = _whole_quantity(product.stock_quantity or 0, field_name="Current stock")
    after = before + delta
    if after < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for {product.name}. Available: {before}",
        )

    product.stock_quantity = after
    movement = StockMovement(
        shop_id=shop_id,
        product_id=product.id,
        movement_type=movement_type,
        quantity_delta=delta,
        quantity_before=before,
        quantity_after=after,
        reference_type=reference_type,
        reference_id=reference_id,
        reference_line_id=reference_line_id,
        reason=(reason.strip() or None) if isinstance(reason, str) else reason,
        notes=(notes.strip() or None) if isinstance(notes, str) else notes,
        client_request_id=client_request_id,
        created_by=actor.id if actor else None,
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(movement)
    db.flush()
    return movement


def record_opening_balance(
    db: Session,
    *,
    product: Product,
    shop_id: int,
    quantity,
    actor: User | None,
    reason: str = "Initial product stock",
) -> StockMovement:
    return apply_stock_movement(
        db,
        product=product,
        shop_id=shop_id,
        movement_type=StockMovementType.OPENING_BALANCE,
        quantity_delta=quantity,
        reference_type="product",
        reference_id=product.id,
        actor=actor,
        reason=reason,
        client_request_id=f"opening-product-{product.id}",
        allow_zero=True,
    )


def list_product_stock_movements(
    db: Session,
    *,
    shop_id: int,
    product_id: int,
    page: int = 1,
    page_size: int = 50,
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.shop_id == shop_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    query = db.query(StockMovement).filter(
        StockMovement.shop_id == shop_id,
        StockMovement.product_id == product_id,
    )
    total = query.count()
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)
    items = (
        query.order_by(StockMovement.occurred_at.desc(), StockMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def reconcile_stock_balances(db: Session, *, shop_id: int):
    ledger = (
        db.query(
            StockMovement.product_id,
            func.coalesce(func.sum(StockMovement.quantity_delta), 0).label("ledger_balance"),
        )
        .filter(StockMovement.shop_id == shop_id)
        .group_by(StockMovement.product_id)
        .subquery()
    )
    rows = (
        db.query(Product, func.coalesce(ledger.c.ledger_balance, 0))
        .outerjoin(ledger, ledger.c.product_id == Product.id)
        .filter(Product.shop_id == shop_id)
        .order_by(Product.id.asc())
        .all()
    )

    items = []
    for product, ledger_balance_value in rows:
        current_balance = int(product.stock_quantity or 0)
        ledger_balance = int(ledger_balance_value or 0)
        difference = current_balance - ledger_balance
        items.append(
            {
                "product_id": product.id,
                "sku": product.sku,
                "product_name": product.name,
                "current_balance": current_balance,
                "ledger_balance": ledger_balance,
                "difference": difference,
                "matches": difference == 0,
            }
        )

    return {
        "items": items,
        "checked_products": len(items),
        "mismatch_count": sum(1 for item in items if not item["matches"]),
    }


def _request_fingerprint(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _locked_product(db: Session, *, shop_id: int, product_id: int) -> Product:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.shop_id == shop_id)
        .with_for_update()
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _ledger_balance(db: Session, *, shop_id: int, product_id: int) -> int:
    value = (
        db.query(func.coalesce(func.sum(StockMovement.quantity_delta), 0))
        .filter(
            StockMovement.shop_id == shop_id,
            StockMovement.product_id == product_id,
        )
        .scalar()
    )
    return int(value or 0)


def _assert_ledger_integrity(db: Session, *, product: Product, shop_id: int) -> None:
    current = int(product.stock_quantity or 0)
    ledger = _ledger_balance(db, shop_id=shop_id, product_id=product.id)
    if ledger != current:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Inventory integrity check failed for this product. "
                f"Current stock is {current}, but the stock ledger balance is {ledger}. "
                "Investigate the mismatch before making an adjustment."
            ),
        )


def assert_stock_ledger_integrity(db: Session, *, product: Product, shop_id: int) -> None:
    """Public integrity guard for transactional inventory workflows."""
    _assert_ledger_integrity(db, product=product, shop_id=shop_id)


def _existing_adjustment_request(
    db: Session,
    *,
    shop_id: int,
    product_id: int,
    client_request_id: str,
    request_fingerprint: str,
) -> StockAdjustmentRequest | None:
    existing = (
        db.query(StockAdjustmentRequest)
        .filter(
            StockAdjustmentRequest.shop_id == shop_id,
            StockAdjustmentRequest.product_id == product_id,
            StockAdjustmentRequest.client_request_id == client_request_id,
        )
        .first()
    )
    if existing and existing.request_fingerprint != request_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This inventory request key was already used with different data.",
        )
    return existing


def _adjustment_result(request: StockAdjustmentRequest, *, replayed: bool) -> dict:
    movement_type = None
    if request.quantity_delta > 0:
        movement_type = StockMovementType.ADJUSTMENT_IN
    elif request.quantity_delta < 0:
        movement_type = StockMovementType.ADJUSTMENT_OUT
    return {
        "id": request.id,
        "product_id": request.product_id,
        "operation_type": request.operation_type,
        "movement_id": request.movement_id,
        "movement_type": movement_type,
        "quantity_before": request.quantity_before,
        "quantity_delta": request.quantity_delta,
        "quantity_after": request.quantity_after,
        "reason": request.reason,
        "notes": request.notes,
        "client_request_id": request.client_request_id,
        "replayed": replayed,
    }


def _validate_reason_for_delta(*, reason: str, notes: str | None, delta: int) -> None:
    allowed = ADJUSTMENT_IN_REASONS if delta > 0 else ADJUSTMENT_OUT_REASONS
    if delta == 0:
        allowed = ADJUSTMENT_IN_REASONS | ADJUSTMENT_OUT_REASONS
    if reason not in allowed:
        direction = "increase" if delta > 0 else "decrease" if delta < 0 else "count"
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Reason '{reason}' is not valid for a stock {direction}.",
        )
    if reason == "other" and not notes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Notes are required when reason is other.",
        )


def _record_controlled_adjustment(
    db: Session,
    *,
    product: Product,
    current_user: User,
    operation_type: str,
    client_request_id: str,
    request_fingerprint: str,
    delta: int,
    reason: str,
    notes: str | None,
) -> dict:
    before = int(product.stock_quantity or 0)
    after = before + delta
    if after < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Adjustment exceeds available stock. Available: {before}.",
        )

    request = StockAdjustmentRequest(
        shop_id=current_user.shop_id,
        product_id=product.id,
        operation_type=operation_type,
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
        quantity_before=before,
        quantity_delta=delta,
        quantity_after=after,
        reason=reason,
        notes=notes,
        created_by=current_user.id,
    )
    db.add(request)
    db.flush()

    movement = None
    if delta:
        movement = apply_stock_movement(
            db,
            product=product,
            shop_id=current_user.shop_id,
            movement_type=(
                StockMovementType.ADJUSTMENT_IN
                if delta > 0
                else StockMovementType.ADJUSTMENT_OUT
            ),
            quantity_delta=delta,
            reference_type="stock_adjustment_request",
            reference_id=request.id,
            actor=current_user,
            reason=reason,
            notes=notes,
            client_request_id=f"stock-adjustment-request-{request.id}",
        )
        request.movement_id = movement.id

    action = (
        BusinessAuditAction.INVENTORY_ADJUSTED
        if operation_type == "adjustment"
        else BusinessAuditAction.INVENTORY_COUNT_RECONCILED
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=action,
        entity_type="product",
        entity_id=product.id,
        summary=(
            f"Stock adjusted for {product.sku}"
            if operation_type == "adjustment"
            else f"Physical stock count recorded for {product.sku}"
        ),
        before_data={"stock_quantity": before},
        after_data={
            "stock_quantity": after,
            "quantity_delta": delta,
            "reason": reason,
            "notes": notes,
            "stock_adjustment_request_id": request.id,
        },
    )

    db.commit()
    db.refresh(request)
    return _adjustment_result(request, replayed=False)


def create_stock_adjustment(
    db: Session,
    *,
    product_id: int,
    payload: StockAdjustmentCreate,
    current_user: User,
) -> dict:
    fingerprint = _request_fingerprint(
        {
            "operation_type": "adjustment",
            "direction": payload.direction,
            "quantity": payload.quantity,
            "reason": payload.reason,
            "notes": payload.notes,
        }
    )
    product = _locked_product(db, shop_id=current_user.shop_id, product_id=product_id)
    existing = _existing_adjustment_request(
        db,
        shop_id=current_user.shop_id,
        product_id=product.id,
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
    )
    if existing:
        return _adjustment_result(existing, replayed=True)
    if not product.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inactive products cannot be adjusted.")

    _assert_ledger_integrity(db, product=product, shop_id=current_user.shop_id)
    delta = payload.quantity if payload.direction == "in" else -payload.quantity
    _validate_reason_for_delta(reason=payload.reason, notes=payload.notes, delta=delta)
    return _record_controlled_adjustment(
        db,
        product=product,
        current_user=current_user,
        operation_type="adjustment",
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
        delta=delta,
        reason=payload.reason,
        notes=payload.notes,
    )


def reconcile_physical_stock_count(
    db: Session,
    *,
    product_id: int,
    payload: PhysicalStockCountCreate,
    current_user: User,
) -> dict:
    fingerprint = _request_fingerprint(
        {
            "operation_type": "physical_count",
            "counted_quantity": payload.counted_quantity,
            "reason": payload.reason,
            "notes": payload.notes,
        }
    )
    product = _locked_product(db, shop_id=current_user.shop_id, product_id=product_id)
    existing = _existing_adjustment_request(
        db,
        shop_id=current_user.shop_id,
        product_id=product.id,
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
    )
    if existing:
        return _adjustment_result(existing, replayed=True)
    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inactive products cannot be reconciled.",
        )

    _assert_ledger_integrity(db, product=product, shop_id=current_user.shop_id)
    current = int(product.stock_quantity or 0)
    delta = payload.counted_quantity - current
    _validate_reason_for_delta(reason=payload.reason, notes=payload.notes, delta=delta)
    return _record_controlled_adjustment(
        db,
        product=product,
        current_user=current_user,
        operation_type="physical_count",
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
        delta=delta,
        reason=payload.reason,
        notes=payload.notes,
    )
