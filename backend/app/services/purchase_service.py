from __future__ import annotations

import hashlib
import json
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.business_audit_log import BusinessAuditAction
from app.models.product import Product
from app.models.purchase import (
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderSequence,
    PurchaseReturn,
    PurchaseReturnItem,
    PurchaseReturnSequence,
    VendorCredit,
)
from app.models.stock_movement import StockMovementType
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.purchase import (
    GoodsReceiptCreate,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseReturnCreate,
)
from app.services.business_audit_service import record_business_audit
from app.services.stock_service import apply_stock_movement, assert_stock_ledger_integrity


MONEY = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _fingerprint(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _format_po_number(order_date: date, sequence: int) -> str:
    return f"PO-{order_date.strftime('%Y%m%d')}-{sequence:03d}"


def _format_purchase_return_number(return_date: date, sequence: int) -> str:
    return f"PR-{return_date.strftime('%Y%m%d')}-{sequence:03d}"


def _allocate_po_sequence(db: Session, *, shop_id: int, order_date: date) -> int:
    if db.get_bind().dialect.name == "postgresql":
        statement = (
            postgresql_insert(PurchaseOrderSequence)
            .values(shop_id=shop_id, sequence_date=order_date, last_number=1)
            .on_conflict_do_update(
                index_elements=[PurchaseOrderSequence.shop_id, PurchaseOrderSequence.sequence_date],
                set_={
                    "last_number": PurchaseOrderSequence.last_number + 1,
                    "updated_at": func.now(),
                },
            )
            .returning(PurchaseOrderSequence.last_number)
        )
        return int(db.execute(statement).scalar_one())

    sequence = (
        db.query(PurchaseOrderSequence)
        .filter(
            PurchaseOrderSequence.shop_id == shop_id,
            PurchaseOrderSequence.sequence_date == order_date,
        )
        .with_for_update()
        .one_or_none()
    )
    if sequence:
        sequence.last_number += 1
        db.flush()
        return int(sequence.last_number)
    try:
        with db.begin_nested():
            sequence = PurchaseOrderSequence(
                shop_id=shop_id,
                sequence_date=order_date,
                last_number=1,
            )
            db.add(sequence)
            db.flush()
            return 1
    except IntegrityError:
        sequence = (
            db.query(PurchaseOrderSequence)
            .filter(
                PurchaseOrderSequence.shop_id == shop_id,
                PurchaseOrderSequence.sequence_date == order_date,
            )
            .with_for_update()
            .one()
        )
        sequence.last_number += 1
        db.flush()
        return int(sequence.last_number)


def _allocate_purchase_return_sequence(db: Session, *, shop_id: int, return_date: date) -> int:
    if db.get_bind().dialect.name == "postgresql":
        statement = (
            postgresql_insert(PurchaseReturnSequence)
            .values(shop_id=shop_id, sequence_date=return_date, last_number=1)
            .on_conflict_do_update(
                index_elements=[PurchaseReturnSequence.shop_id, PurchaseReturnSequence.sequence_date],
                set_={
                    "last_number": PurchaseReturnSequence.last_number + 1,
                    "updated_at": func.now(),
                },
            )
            .returning(PurchaseReturnSequence.last_number)
        )
        return int(db.execute(statement).scalar_one())

    sequence = (
        db.query(PurchaseReturnSequence)
        .filter(
            PurchaseReturnSequence.shop_id == shop_id,
            PurchaseReturnSequence.sequence_date == return_date,
        )
        .with_for_update()
        .one_or_none()
    )
    if sequence:
        sequence.last_number += 1
        db.flush()
        return int(sequence.last_number)
    try:
        with db.begin_nested():
            sequence = PurchaseReturnSequence(
                shop_id=shop_id,
                sequence_date=return_date,
                last_number=1,
            )
            db.add(sequence)
            db.flush()
            return 1
    except IntegrityError:
        sequence = (
            db.query(PurchaseReturnSequence)
            .filter(
                PurchaseReturnSequence.shop_id == shop_id,
                PurchaseReturnSequence.sequence_date == return_date,
            )
            .with_for_update()
            .one()
        )
        sequence.last_number += 1
        db.flush()
        return int(sequence.last_number)

def _vendor(db: Session, *, shop_id: int, vendor_id: int) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.shop_id == shop_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if not vendor.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inactive vendors cannot be used")
    return vendor


def _products(db: Session, *, shop_id: int, product_ids: list[int]) -> dict[int, Product]:
    rows = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.id.in_(sorted(product_ids)))
        .order_by(Product.id)
        .all()
    )
    products = {row.id: row for row in rows}
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more products were not found")
    if any(not row.is_active for row in rows):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inactive products cannot be purchased")
    return products


def _locked_products(db: Session, *, shop_id: int, product_ids: list[int]) -> dict[int, Product]:
    rows = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.id.in_(sorted(set(product_ids))))
        .order_by(Product.id)
        .with_for_update()
        .all()
    )
    products = {row.id: row for row in rows}
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more products were not found")
    if any(not row.is_active for row in rows):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inactive products cannot be received")
    return products


def _po_query(db: Session, *, shop_id: int):
    return db.query(PurchaseOrder).options(selectinload(PurchaseOrder.items)).filter(
        PurchaseOrder.shop_id == shop_id
    )


def get_purchase_order(db: Session, *, po_id: int, current_user: User) -> PurchaseOrder:
    po = _po_query(db, shop_id=current_user.shop_id).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po


def list_purchase_orders(
    db: Session,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 50,
    status_filter: str | None = None,
):
    query = _po_query(db, shop_id=current_user.shop_id)
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)
    total = query.count()
    items = (
        query.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _replace_po_items(
    db: Session,
    *,
    po: PurchaseOrder,
    item_payloads,
    shop_id: int,
) -> None:
    products = _products(
        db,
        shop_id=shop_id,
        product_ids=[item.product_id for item in item_payloads],
    )
    po.items.clear()
    db.flush()
    subtotal = Decimal("0.00")
    for payload in item_payloads:
        product = products[payload.product_id]
        cost = _money(payload.unit_cost)
        line_total = _money(cost * payload.ordered_quantity)
        subtotal += line_total
        po.items.append(
            PurchaseOrderItem(
                product_id=product.id,
                product_name=product.name,
                product_sku=product.sku,
                ordered_quantity=payload.ordered_quantity,
                received_quantity=0,
                unit_cost=cost,
                line_total=line_total,
            )
        )
    po.subtotal = _money(subtotal)
    po.total_amount = _money(po.subtotal + _money(po.tax_amount))


def create_purchase_order(
    db: Session, *, payload: PurchaseOrderCreate, current_user: User
) -> PurchaseOrder:
    _vendor(db, shop_id=current_user.shop_id, vendor_id=payload.vendor_id)
    sequence = _allocate_po_sequence(
        db,
        shop_id=current_user.shop_id,
        order_date=payload.order_date,
    )
    po = PurchaseOrder(
        shop_id=current_user.shop_id,
        vendor_id=payload.vendor_id,
        purchase_order_number=_format_po_number(payload.order_date, sequence),
        order_date=payload.order_date,
        expected_date=payload.expected_date,
        status=payload.status,
        notes=payload.notes,
        tax_amount=_money(payload.tax_amount),
        created_by=current_user.id,
    )
    db.add(po)
    _replace_po_items(
        db,
        po=po,
        item_payloads=payload.items,
        shop_id=current_user.shop_id,
    )
    db.flush()
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PURCHASE_ORDER_CREATED,
        entity_type="purchase_order",
        entity_id=po.id,
        summary=f"Purchase order {po.purchase_order_number} created",
        after_data={
            "status": po.status,
            "vendor_id": po.vendor_id,
            "item_count": len(po.items),
            "total_amount": po.total_amount,
        },
    )
    db.commit()
    return get_purchase_order(db, po_id=po.id, current_user=current_user)


def update_purchase_order(
    db: Session,
    *,
    po_id: int,
    payload: PurchaseOrderUpdate,
    current_user: User,
) -> PurchaseOrder:
    po = (
        _po_query(db, shop_id=current_user.shop_id)
        .filter(PurchaseOrder.id == po_id)
        .with_for_update()
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if po.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft purchase orders can be edited")

    before = {"status": po.status, "vendor_id": po.vendor_id, "total_amount": po.total_amount}
    changes = payload.model_dump(exclude_unset=True, exclude={"items"})
    items = payload.items if "items" in payload.model_fields_set else None
    if "vendor_id" in changes:
        _vendor(db, shop_id=current_user.shop_id, vendor_id=changes["vendor_id"])
    for field, value in changes.items():
        setattr(po, field, _money(value) if field == "tax_amount" else value)
    if po.expected_date and po.expected_date < po.order_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expected_date cannot be before order_date",
        )
    if items is not None:
        _replace_po_items(db, po=po, item_payloads=items, shop_id=current_user.shop_id)
    else:
        po.total_amount = _money(po.subtotal + _money(po.tax_amount))
    db.flush()
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PURCHASE_ORDER_UPDATED,
        entity_type="purchase_order",
        entity_id=po.id,
        summary=f"Purchase order {po.purchase_order_number} updated",
        before_data=before,
        after_data={"status": po.status, "vendor_id": po.vendor_id, "total_amount": po.total_amount},
    )
    db.commit()
    return get_purchase_order(db, po_id=po.id, current_user=current_user)


def cancel_purchase_order(db: Session, *, po_id: int, current_user: User) -> PurchaseOrder:
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if po.status == "cancelled":
        return get_purchase_order(db, po_id=po.id, current_user=current_user)
    if po.status in {"partially_received", "received"} or db.query(GoodsReceipt).filter_by(
        purchase_order_id=po.id
    ).count():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A purchase order with receipts cannot be cancelled",
        )
    previous_status = po.status
    po.status = "cancelled"
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PURCHASE_ORDER_CANCELLED,
        entity_type="purchase_order",
        entity_id=po.id,
        summary=f"Purchase order {po.purchase_order_number} cancelled",
        before_data={"status": previous_status},
        after_data={"status": "cancelled"},
    )
    db.commit()
    return get_purchase_order(db, po_id=po.id, current_user=current_user)


def _receipt_fingerprint(payload: GoodsReceiptCreate) -> str:
    return _fingerprint(
        {
            "received_date": payload.received_date.isoformat(),
            "notes": payload.notes,
            "items": sorted(
                [
                    {
                        "purchase_order_item_id": item.purchase_order_item_id,
                        "received_quantity": item.received_quantity,
                        "unit_cost": str(_money(item.unit_cost)) if item.unit_cost is not None else None,
                    }
                    for item in payload.items
                ],
                key=lambda item: item["purchase_order_item_id"],
            ),
        }
    )


def create_goods_receipt(
    db: Session,
    *,
    po_id: int,
    payload: GoodsReceiptCreate,
    current_user: User,
) -> GoodsReceipt:
    po = (
        db.query(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    fingerprint = _receipt_fingerprint(payload)
    existing = (
        db.query(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .filter(
            GoodsReceipt.shop_id == current_user.shop_id,
            GoodsReceipt.purchase_order_id == po.id,
            GoodsReceipt.client_request_id == payload.client_request_id,
        )
        .first()
    )
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This receipt request key was already used with different data",
            )
        return existing

    if po.status not in {"ordered", "partially_received"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only ordered or partially received purchase orders can receive goods",
        )

    po_items = {item.id: item for item in po.items}
    for payload_item in payload.items:
        if payload_item.purchase_order_item_id not in po_items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase order item not found",
            )

    products = _locked_products(
        db,
        shop_id=current_user.shop_id,
        product_ids=[po_items[item.purchase_order_item_id].product_id for item in payload.items],
    )
    for product in products.values():
        assert_stock_ledger_integrity(db, product=product, shop_id=current_user.shop_id)

    for payload_item in payload.items:
        po_item = po_items[payload_item.purchase_order_item_id]
        remaining = po_item.ordered_quantity - po_item.received_quantity
        if payload_item.received_quantity > remaining:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot receive {payload_item.received_quantity} units of {po_item.product_name}; "
                    f"only {remaining} remain"
                ),
            )

    receipt_index = (
        db.query(func.count(GoodsReceipt.id))
        .filter(GoodsReceipt.purchase_order_id == po.id)
        .scalar()
        or 0
    ) + 1
    receipt = GoodsReceipt(
        shop_id=current_user.shop_id,
        purchase_order_id=po.id,
        receipt_number=f"GR-{po.purchase_order_number[3:]}-{receipt_index:03d}",
        received_date=payload.received_date,
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
        notes=payload.notes,
        received_by=current_user.id,
    )
    db.add(receipt)
    db.flush()

    total_received = 0
    for payload_item in sorted(payload.items, key=lambda item: po_items[item.purchase_order_item_id].product_id):
        po_item = po_items[payload_item.purchase_order_item_id]
        unit_cost = _money(
            payload_item.unit_cost if payload_item.unit_cost is not None else po_item.unit_cost
        )
        receipt_item = GoodsReceiptItem(
            goods_receipt_id=receipt.id,
            purchase_order_item_id=po_item.id,
            product_id=po_item.product_id,
            received_quantity=payload_item.received_quantity,
            unit_cost=unit_cost,
        )
        db.add(receipt_item)
        db.flush()
        apply_stock_movement(
            db,
            product=products[po_item.product_id],
            shop_id=current_user.shop_id,
            movement_type=StockMovementType.PURCHASE_RECEIPT,
            quantity_delta=payload_item.received_quantity,
            reference_type="goods_receipt",
            reference_id=receipt.id,
            reference_line_id=receipt_item.id,
            actor=current_user,
            reason="Goods received against purchase order",
            notes=payload.notes,
            client_request_id=f"goods-receipt-item-{receipt_item.id}",
        )
        po_item.received_quantity += payload_item.received_quantity
        total_received += payload_item.received_quantity

    po.status = (
        "received"
        if all(item.received_quantity == item.ordered_quantity for item in po.items)
        else "partially_received"
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.GOODS_RECEIPT_CREATED,
        entity_type="goods_receipt",
        entity_id=receipt.id,
        summary=f"Goods receipt {receipt.receipt_number} posted",
        after_data={
            "purchase_order_id": po.id,
            "purchase_order_number": po.purchase_order_number,
            "receipt_number": receipt.receipt_number,
            "item_count": len(payload.items),
            "total_received_quantity": total_received,
            "purchase_order_status": po.status,
        },
    )
    db.commit()
    return (
        db.query(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .filter(GoodsReceipt.id == receipt.id, GoodsReceipt.shop_id == current_user.shop_id)
        .one()
    )


def list_goods_receipts(db: Session, *, po_id: int, current_user: User):
    get_purchase_order(db, po_id=po_id, current_user=current_user)
    return (
        db.query(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .filter(
            GoodsReceipt.shop_id == current_user.shop_id,
            GoodsReceipt.purchase_order_id == po_id,
        )
        .order_by(GoodsReceipt.created_at.desc(), GoodsReceipt.id.desc())
        .all()
    )


def _purchase_return_fingerprint(payload: PurchaseReturnCreate) -> str:
    return _fingerprint(
        {
            "return_date": payload.return_date.isoformat(),
            "reason": payload.reason,
            "notes": payload.notes,
            "items": sorted(
                [
                    {
                        "goods_receipt_item_id": item.goods_receipt_item_id,
                        "returned_quantity": item.returned_quantity,
                    }
                    for item in payload.items
                ],
                key=lambda item: item["goods_receipt_item_id"],
            ),
        }
    )


def _purchase_return_query(db: Session, *, shop_id: int):
    return (
        db.query(PurchaseReturn)
        .options(selectinload(PurchaseReturn.items), selectinload(PurchaseReturn.credit))
        .filter(PurchaseReturn.shop_id == shop_id)
    )


def list_purchase_returns(db: Session, *, po_id: int, current_user: User):
    get_purchase_order(db, po_id=po_id, current_user=current_user)
    return (
        _purchase_return_query(db, shop_id=current_user.shop_id)
        .filter(PurchaseReturn.purchase_order_id == po_id)
        .order_by(PurchaseReturn.created_at.desc(), PurchaseReturn.id.desc())
        .all()
    )


def get_purchase_return_eligibility(db: Session, *, po_id: int, current_user: User):
    po = get_purchase_order(db, po_id=po_id, current_user=current_user)
    rows = (
        db.query(GoodsReceiptItem, GoodsReceipt, PurchaseOrderItem, Product)
        .join(GoodsReceipt, GoodsReceipt.id == GoodsReceiptItem.goods_receipt_id)
        .join(PurchaseOrderItem, PurchaseOrderItem.id == GoodsReceiptItem.purchase_order_item_id)
        .join(Product, Product.id == GoodsReceiptItem.product_id)
        .filter(
            GoodsReceipt.shop_id == current_user.shop_id,
            GoodsReceipt.purchase_order_id == po.id,
            Product.shop_id == current_user.shop_id,
        )
        .order_by(GoodsReceipt.created_at, GoodsReceiptItem.id)
        .all()
    )
    result = []
    for receipt_item, receipt, po_item, product in rows:
        already_returned = int(
            db.query(func.coalesce(func.sum(PurchaseReturnItem.returned_quantity), 0))
            .join(PurchaseReturn, PurchaseReturn.id == PurchaseReturnItem.purchase_return_id)
            .filter(
                PurchaseReturn.shop_id == current_user.shop_id,
                PurchaseReturnItem.goods_receipt_item_id == receipt_item.id,
            )
            .scalar()
            or 0
        )
        result.append(
            {
                "goods_receipt_item_id": receipt_item.id,
                "goods_receipt_id": receipt.id,
                "receipt_number": receipt.receipt_number,
                "product_id": product.id,
                "product_name": po_item.product_name,
                "product_sku": po_item.product_sku,
                "ordered_quantity": po_item.ordered_quantity,
                "received_quantity": receipt_item.received_quantity,
                "already_returned_quantity": already_returned,
                "remaining_returnable_quantity": receipt_item.received_quantity - already_returned,
                "current_stock_quantity": product.stock_quantity,
                "unit_cost": receipt_item.unit_cost,
            }
        )
    return result


def create_purchase_return(
    db: Session,
    *,
    po_id: int,
    payload: PurchaseReturnCreate,
    current_user: User,
) -> PurchaseReturn:
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    fingerprint = _purchase_return_fingerprint(payload)
    existing = (
        _purchase_return_query(db, shop_id=current_user.shop_id)
        .filter(
            PurchaseReturn.purchase_order_id == po.id,
            PurchaseReturn.client_request_id == payload.client_request_id,
        )
        .first()
    )
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This purchase return request key was already used with different data",
            )
        return existing

    receipt_item_ids = sorted(item.goods_receipt_item_id for item in payload.items)
    receipt_rows = (
        db.query(GoodsReceiptItem, GoodsReceipt)
        .join(GoodsReceipt, GoodsReceipt.id == GoodsReceiptItem.goods_receipt_id)
        .filter(
            GoodsReceiptItem.id.in_(receipt_item_ids),
            GoodsReceipt.shop_id == current_user.shop_id,
            GoodsReceipt.purchase_order_id == po.id,
        )
        .order_by(GoodsReceiptItem.id)
        .all()
    )
    if len(receipt_rows) != len(receipt_item_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more goods receipt items were not found",
        )
    receipt_items = {item.id: (item, receipt) for item, receipt in receipt_rows}

    products = _locked_products(
        db,
        shop_id=current_user.shop_id,
        product_ids=[item.product_id for item, _ in receipt_rows],
    )
    for product in products.values():
        assert_stock_ledger_integrity(db, product=product, shop_id=current_user.shop_id)

    for item_payload in payload.items:
        receipt_item, _ = receipt_items[item_payload.goods_receipt_item_id]
        already_returned = int(
            db.query(func.coalesce(func.sum(PurchaseReturnItem.returned_quantity), 0))
            .filter(PurchaseReturnItem.goods_receipt_item_id == receipt_item.id)
            .scalar()
            or 0
        )
        remaining_returnable = receipt_item.received_quantity - already_returned
        if item_payload.returned_quantity > remaining_returnable:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot return {item_payload.returned_quantity} units; "
                    f"only {remaining_returnable} received units remain returnable"
                ),
            )
        if item_payload.returned_quantity > products[receipt_item.product_id].stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase return exceeds current sellable stock",
            )

    sequence = _allocate_purchase_return_sequence(
        db, shop_id=current_user.shop_id, return_date=payload.return_date
    )
    receipt_ids = {receipt.id for _, receipt in receipt_rows}
    purchase_return = PurchaseReturn(
        shop_id=current_user.shop_id,
        vendor_id=po.vendor_id,
        purchase_order_id=po.id,
        goods_receipt_id=next(iter(receipt_ids)) if len(receipt_ids) == 1 else None,
        return_number=_format_purchase_return_number(payload.return_date, sequence),
        return_date=payload.return_date,
        reason=payload.reason,
        notes=payload.notes,
        client_request_id=payload.client_request_id,
        request_fingerprint=fingerprint,
        total_amount=Decimal("0.00"),
        created_by=current_user.id,
    )
    db.add(purchase_return)
    db.flush()

    total_amount = Decimal("0.00")
    total_quantity = 0
    for item_payload in sorted(payload.items, key=lambda row: receipt_items[row.goods_receipt_item_id][0].product_id):
        receipt_item, _ = receipt_items[item_payload.goods_receipt_item_id]
        line_total = _money(receipt_item.unit_cost * item_payload.returned_quantity)
        return_item = PurchaseReturnItem(
            purchase_return_id=purchase_return.id,
            product_id=receipt_item.product_id,
            goods_receipt_item_id=receipt_item.id,
            returned_quantity=item_payload.returned_quantity,
            unit_cost=_money(receipt_item.unit_cost),
            line_total=line_total,
        )
        db.add(return_item)
        db.flush()
        apply_stock_movement(
            db,
            product=products[receipt_item.product_id],
            shop_id=current_user.shop_id,
            movement_type=StockMovementType.PURCHASE_RETURN,
            quantity_delta=-item_payload.returned_quantity,
            reference_type="purchase_return",
            reference_id=purchase_return.id,
            reference_line_id=return_item.id,
            actor=current_user,
            reason=payload.reason,
            notes=payload.notes,
            client_request_id=f"purchase-return-item-{return_item.id}",
        )
        total_amount += line_total
        total_quantity += item_payload.returned_quantity

    purchase_return.total_amount = _money(total_amount)
    db.add(
        VendorCredit(
            shop_id=current_user.shop_id,
            vendor_id=po.vendor_id,
            purchase_return_id=purchase_return.id,
            amount=purchase_return.total_amount,
            applied_amount=Decimal("0.00"),
            status="unapplied",
            created_by=current_user.id,
        )
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PURCHASE_RETURN_CREATED,
        entity_type="purchase_return",
        entity_id=purchase_return.id,
        summary=f"Purchase return {purchase_return.return_number} posted",
        after_data={
            "purchase_order_id": po.id,
            "vendor_id": po.vendor_id,
            "return_number": purchase_return.return_number,
            "item_count": len(payload.items),
            "total_quantity": total_quantity,
            "total_amount": purchase_return.total_amount,
            "reason": payload.reason,
        },
    )
    db.commit()
    return (
        _purchase_return_query(db, shop_id=current_user.shop_id)
        .filter(PurchaseReturn.id == purchase_return.id)
        .one()
    )
