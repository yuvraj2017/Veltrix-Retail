from __future__ import annotations

import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.invoice_return import InvoiceReturn
from app.models.product import Product
from app.models.purchase import (
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReturn,
    PurchaseReturnItem,
    VendorCredit,
)
from app.models.stock_adjustment_request import StockAdjustmentRequest
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_bill import VendorBill


MONEY = Decimal("0.01")
INCOMING_PO_STATUSES = ("ordered", "partially_received")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _date_bounds(date_from: date | None, date_to: date | None):
    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc
    start = (
        datetime.combine(date_from, time.min, tzinfo=local_timezone).astimezone(timezone.utc)
        if date_from
        else None
    )
    end = (
        datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=local_timezone).astimezone(
            timezone.utc
        )
        if date_to
        else None
    )
    return start, end


def _incoming_quantity_subquery(db: Session, shop_id: int):
    return (
        db.query(
            PurchaseOrderItem.product_id.label("product_id"),
            func.coalesce(
                func.sum(PurchaseOrderItem.ordered_quantity - PurchaseOrderItem.received_quantity),
                0,
            ).label("incoming_quantity"),
        )
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
        .filter(
            PurchaseOrder.shop_id == shop_id,
            PurchaseOrder.status.in_(INCOMING_PO_STATUSES),
            PurchaseOrderItem.received_quantity < PurchaseOrderItem.ordered_quantity,
        )
        .group_by(PurchaseOrderItem.product_id)
        .subquery()
    )


def _ledger_subquery(db: Session, shop_id: int):
    return (
        db.query(
            StockMovement.product_id.label("product_id"),
            func.coalesce(func.sum(StockMovement.quantity_delta), 0).label("ledger_balance"),
        )
        .filter(StockMovement.shop_id == shop_id)
        .group_by(StockMovement.product_id)
        .subquery()
    )


def get_inventory_summary(db: Session, *, shop_id: int):
    ledger = _ledger_subquery(db, shop_id)
    product_totals = (
        db.query(
            func.count(Product.id),
            func.coalesce(func.sum(Product.stock_quantity), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Product.stock_quantity > 0)
                            & (Product.stock_quantity <= Product.low_stock_threshold),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(case((Product.stock_quantity == 0, 1), else_=0)),
                0,
            ),
            func.coalesce(func.sum(Product.stock_quantity * Product.buying_price), 0),
        )
        .filter(Product.shop_id == shop_id, Product.is_active.is_(True))
        .one()
    )
    mismatch_count = (
        db.query(func.count(Product.id))
        .outerjoin(ledger, ledger.c.product_id == Product.id)
        .filter(
            Product.shop_id == shop_id,
            Product.stock_quantity != func.coalesce(ledger.c.ledger_balance, 0),
        )
        .scalar()
        or 0
    )
    po_counts = dict(
        db.query(PurchaseOrder.status, func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.shop_id == shop_id)
        .group_by(PurchaseOrder.status)
        .all()
    )
    unapplied_credit = (
        db.query(func.coalesce(func.sum(VendorCredit.amount - VendorCredit.applied_amount), 0))
        .filter(VendorCredit.shop_id == shop_id, VendorCredit.status != "applied")
        .scalar()
    )
    return {
        "active_products": int(product_totals[0] or 0),
        "total_sellable_units": int(product_totals[1] or 0),
        "low_stock_products": int(product_totals[2] or 0),
        "out_of_stock_products": int(product_totals[3] or 0),
        "current_inventory_value": _money(product_totals[4]),
        "reconciliation_mismatches": int(mismatch_count),
        "open_purchase_orders": int(po_counts.get("draft", 0) + po_counts.get("ordered", 0)),
        "partially_received_purchase_orders": int(po_counts.get("partially_received", 0)),
        "unapplied_vendor_credit": _money(unapplied_credit),
        "valuation_basis": "Current sellable quantity x current product buying price",
    }


def _stock_status(product: Product) -> str:
    stock = int(product.stock_quantity or 0)
    threshold = int(product.low_stock_threshold or 0)
    if stock == 0:
        return "out_of_stock"
    if stock <= threshold:
        return "low_stock"
    return "normal"


def _product_item(product: Product, incoming_quantity=0):
    stock = int(product.stock_quantity or 0)
    threshold = int(product.low_stock_threshold or 0)
    return {
        "product_id": product.id,
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "category": product.category,
        "is_active": bool(product.is_active),
        "stock_quantity": stock,
        "low_stock_threshold": threshold,
        "stock_status": _stock_status(product),
        "threshold_gap": max(threshold - stock, 0),
        "buying_price": _money(product.buying_price),
        "inventory_value": _money(stock * _money(product.buying_price)),
        "incoming_quantity": int(incoming_quantity or 0),
    }


def list_inventory_products(
    db: Session,
    *,
    shop_id: int,
    search: str | None = None,
    stock_status: str | None = None,
    active_only: bool = True,
    page: int = 1,
    page_size: int = 50,
):
    incoming = _incoming_quantity_subquery(db, shop_id)
    query = (
        db.query(Product, func.coalesce(incoming.c.incoming_quantity, 0))
        .outerjoin(incoming, incoming.c.product_id == Product.id)
        .filter(Product.shop_id == shop_id)
    )
    if active_only:
        query = query.filter(Product.is_active.is_(True))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(Product.name.ilike(pattern), Product.sku.ilike(pattern), Product.barcode.ilike(pattern))
        )
    if stock_status == "out_of_stock":
        query = query.filter(Product.stock_quantity == 0)
    elif stock_status == "actionable":
        query = query.filter(Product.stock_quantity <= Product.low_stock_threshold)
    elif stock_status == "low_stock":
        query = query.filter(
            Product.stock_quantity > 0,
            Product.stock_quantity <= Product.low_stock_threshold,
        )
    elif stock_status == "normal":
        query = query.filter(Product.stock_quantity > Product.low_stock_threshold)
    elif stock_status not in {None, "all"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid stock status")

    total = query.count()
    rows = (
        query.order_by(Product.stock_quantity.asc(), Product.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [_product_item(product, incoming_quantity) for product, incoming_quantity in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _movement_reference_maps(db: Session, shop_id: int, rows: list[tuple[StockMovement, Product, User | None]]):
    grouped: dict[str, set[int]] = {}
    for movement, _, _ in rows:
        if movement.reference_id is not None:
            grouped.setdefault(movement.reference_type, set()).add(movement.reference_id)

    labels: dict[tuple[str, int], tuple[str, str | None]] = {}
    for row in db.query(Invoice.id, Invoice.invoice_number).filter(
        Invoice.shop_id == shop_id, Invoice.id.in_(grouped.get("invoice", {-1}))
    ):
        labels[("invoice", row.id)] = (row.invoice_number, f"/billing/{row.id}/preview")
    for row in db.query(InvoiceReturn.id, InvoiceReturn.return_number, InvoiceReturn.invoice_id).filter(
        InvoiceReturn.shop_id == shop_id,
        InvoiceReturn.id.in_(grouped.get("invoice_return", {-1})),
    ):
        labels[("invoice_return", row.id)] = (row.return_number, f"/billing/{row.invoice_id}/preview")
    for receipt, po in db.query(GoodsReceipt, PurchaseOrder).join(
        PurchaseOrder, PurchaseOrder.id == GoodsReceipt.purchase_order_id
    ).filter(
        GoodsReceipt.shop_id == shop_id,
        GoodsReceipt.id.in_(grouped.get("goods_receipt", {-1})),
    ):
        labels[("goods_receipt", receipt.id)] = (
            f"{receipt.receipt_number} / {po.purchase_order_number}",
            f"/purchase-orders?selected={po.id}",
        )
    for purchase_return, po in db.query(PurchaseReturn, PurchaseOrder).join(
        PurchaseOrder, PurchaseOrder.id == PurchaseReturn.purchase_order_id
    ).filter(
        PurchaseReturn.shop_id == shop_id,
        PurchaseReturn.id.in_(grouped.get("purchase_return", {-1})),
    ):
        labels[("purchase_return", purchase_return.id)] = (
            f"{purchase_return.return_number} / {po.purchase_order_number}",
            f"/purchase-orders?selected={po.id}",
        )
    for request in db.query(StockAdjustmentRequest).filter(
        StockAdjustmentRequest.shop_id == shop_id,
        StockAdjustmentRequest.id.in_(grouped.get("stock_adjustment_request", {-1})),
    ):
        labels[("stock_adjustment_request", request.id)] = (
            f"{request.operation_type.replace('_', ' ').title()} / {request.reason.replace('_', ' ')}",
            f"/products?product={request.product_id}",
        )
    return labels


def list_inventory_movements(
    db: Session,
    *,
    shop_id: int,
    search: str | None = None,
    product_id: int | None = None,
    movement_type: str | None = None,
    direction: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 50,
):
    query = (
        db.query(StockMovement, Product, User)
        .join(Product, Product.id == StockMovement.product_id)
        .outerjoin(User, User.id == StockMovement.created_by)
        .filter(StockMovement.shop_id == shop_id, Product.shop_id == shop_id)
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern), Product.barcode.ilike(pattern)))
    if product_id is not None:
        query = query.filter(StockMovement.product_id == product_id)
    if movement_type:
        if movement_type not in StockMovementType.ALL:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid movement type")
        query = query.filter(StockMovement.movement_type == movement_type)
    if direction == "in":
        query = query.filter(StockMovement.quantity_delta > 0)
    elif direction == "out":
        query = query.filter(StockMovement.quantity_delta < 0)
    elif direction not in {None, "all"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid movement direction")
    start, end = _date_bounds(date_from, date_to)
    if start:
        query = query.filter(StockMovement.occurred_at >= start)
    if end:
        query = query.filter(StockMovement.occurred_at < end)
    total = query.count()
    rows = (
        query.order_by(StockMovement.occurred_at.desc(), StockMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    references = _movement_reference_maps(db, shop_id, rows)
    items = []
    for movement, product, actor in rows:
        label, url = references.get(
            (movement.reference_type, movement.reference_id),
            (movement.reason or movement.reference_type.replace("_", " ").title(), None),
        )
        items.append(
            {
                "id": movement.id,
                "product_id": product.id,
                "product_name": product.name,
                "product_sku": product.sku,
                "movement_type": movement.movement_type,
                "quantity_before": movement.quantity_before,
                "quantity_delta": movement.quantity_delta,
                "quantity_after": movement.quantity_after,
                "direction": "in" if movement.quantity_delta > 0 else "out" if movement.quantity_delta < 0 else "zero",
                "reason": movement.reason,
                "notes": movement.notes,
                "reference_type": movement.reference_type,
                "reference_label": label,
                "reference_url": url,
                "actor_name": actor.full_name if actor else None,
                "occurred_at": movement.occurred_at,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def list_reconciliation_report(
    db: Session,
    *,
    shop_id: int,
    search: str | None = None,
    mismatches_only: bool = False,
    page: int = 1,
    page_size: int = 50,
):
    ledger = _ledger_subquery(db, shop_id)
    ledger_balance = func.coalesce(ledger.c.ledger_balance, 0)
    query = (
        db.query(Product, ledger_balance)
        .outerjoin(ledger, ledger.c.product_id == Product.id)
        .filter(Product.shop_id == shop_id)
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern)))
    if mismatches_only:
        query = query.filter(Product.stock_quantity != ledger_balance)
    total = query.count()
    rows = query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for product, ledger_value in rows:
        current = int(product.stock_quantity or 0)
        ledger_current = int(ledger_value or 0)
        items.append(
            {
                "product_id": product.id,
                "sku": product.sku,
                "product_name": product.name,
                "current_balance": current,
                "ledger_balance": ledger_current,
                "difference": current - ledger_current,
                "matches": current == ledger_current,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_inventory_activity(db: Session, *, shop_id: int, date_from: date, date_to: date):
    if date_to < date_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="date_to cannot be before date_from")
    start, end = _date_bounds(date_from, date_to)
    rows = (
        db.query(StockMovement.movement_type, func.coalesce(func.sum(StockMovement.quantity_delta), 0))
        .filter(
            StockMovement.shop_id == shop_id,
            StockMovement.occurred_at >= start,
            StockMovement.occurred_at < end,
        )
        .group_by(StockMovement.movement_type)
        .all()
    )
    totals = {movement_type: int(value or 0) for movement_type, value in rows}
    current_units = (
        db.query(func.coalesce(func.sum(Product.stock_quantity), 0))
        .filter(Product.shop_id == shop_id, Product.is_active.is_(True))
        .scalar()
        or 0
    )
    return {
        "date_from": date_from,
        "date_to": date_to,
        "opening_balance_units": max(totals.get(StockMovementType.OPENING_BALANCE, 0), 0),
        "units_sold": abs(min(totals.get(StockMovementType.SALE, 0), 0)),
        "customer_return_units_restocked": max(totals.get(StockMovementType.SALE_RETURN, 0), 0),
        "purchase_units_received": max(totals.get(StockMovementType.PURCHASE_RECEIPT, 0), 0),
        "purchase_units_returned": abs(min(totals.get(StockMovementType.PURCHASE_RETURN, 0), 0)),
        "adjustment_in_units": max(totals.get(StockMovementType.ADJUSTMENT_IN, 0), 0),
        "adjustment_out_units": abs(min(totals.get(StockMovementType.ADJUSTMENT_OUT, 0), 0)),
        "draft_reserved_units": abs(min(totals.get(StockMovementType.DRAFT_RESERVE, 0), 0)),
        "draft_released_units": max(totals.get(StockMovementType.DRAFT_RELEASE, 0), 0),
        "net_movement": sum(totals.values()),
        "current_sellable_units": int(current_units),
    }


def list_purchasing_report(
    db: Session,
    *,
    shop_id: int,
    search: str | None = None,
    vendor_id: int | None = None,
    status_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 50,
):
    item_totals = (
        db.query(
            PurchaseOrderItem.purchase_order_id.label("po_id"),
            func.sum(PurchaseOrderItem.ordered_quantity).label("ordered_quantity"),
            func.sum(PurchaseOrderItem.received_quantity).label("received_quantity"),
        )
        .group_by(PurchaseOrderItem.purchase_order_id)
        .subquery()
    )
    return_totals = (
        db.query(
            PurchaseReturn.purchase_order_id.label("po_id"),
            func.sum(PurchaseReturnItem.returned_quantity).label("return_quantity"),
            func.sum(PurchaseReturnItem.line_total).label("return_value"),
        )
        .join(PurchaseReturnItem, PurchaseReturnItem.purchase_return_id == PurchaseReturn.id)
        .filter(PurchaseReturn.shop_id == shop_id)
        .group_by(PurchaseReturn.purchase_order_id)
        .subquery()
    )
    query = (
        db.query(
            PurchaseOrder,
            Vendor,
            func.coalesce(item_totals.c.ordered_quantity, 0),
            func.coalesce(item_totals.c.received_quantity, 0),
            func.coalesce(return_totals.c.return_quantity, 0),
            func.coalesce(return_totals.c.return_value, 0),
        )
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .outerjoin(item_totals, item_totals.c.po_id == PurchaseOrder.id)
        .outerjoin(return_totals, return_totals.c.po_id == PurchaseOrder.id)
        .filter(PurchaseOrder.shop_id == shop_id, Vendor.shop_id == shop_id)
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(PurchaseOrder.purchase_order_number.ilike(pattern), Vendor.vendor_name.ilike(pattern)))
    if vendor_id is not None:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)
    if date_from:
        query = query.filter(PurchaseOrder.order_date >= date_from)
    if date_to:
        query = query.filter(PurchaseOrder.order_date <= date_to)
    total = query.count()
    rows = query.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    today = date.today()
    items = []
    for po, vendor, ordered, received, returned, return_value in rows:
        items.append(
            {
                "purchase_order_id": po.id,
                "purchase_order_number": po.purchase_order_number,
                "vendor_id": vendor.id,
                "vendor_name": vendor.vendor_name,
                "order_date": po.order_date,
                "expected_date": po.expected_date,
                "status": po.status,
                "ordered_quantity": int(ordered or 0),
                "received_quantity": int(received or 0),
                "remaining_quantity": max(int(ordered or 0) - int(received or 0), 0),
                "ordered_value": _money(po.total_amount),
                "purchase_return_quantity": int(returned or 0),
                "purchase_return_value": _money(return_value),
                "overdue_expected_receipt": bool(
                    po.expected_date and po.expected_date < today and po.status in INCOMING_PO_STATUSES
                ),
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def list_vendor_purchasing_insights(
    db: Session,
    *,
    shop_id: int,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    po = db.query(
        PurchaseOrder.vendor_id.label("vendor_id"),
        func.count(PurchaseOrder.id).label("po_count"),
        func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("ordered_value"),
    ).filter(PurchaseOrder.shop_id == shop_id).group_by(PurchaseOrder.vendor_id).subquery()
    received = db.query(
        PurchaseOrder.vendor_id.label("vendor_id"),
        func.coalesce(func.sum(GoodsReceiptItem.received_quantity * GoodsReceiptItem.unit_cost), 0).label("received_value"),
    ).join(GoodsReceipt, GoodsReceipt.id == GoodsReceiptItem.goods_receipt_id).join(
        PurchaseOrder, PurchaseOrder.id == GoodsReceipt.purchase_order_id
    ).filter(GoodsReceipt.shop_id == shop_id).group_by(PurchaseOrder.vendor_id).subquery()
    returned = db.query(
        PurchaseReturn.vendor_id.label("vendor_id"),
        func.coalesce(func.sum(PurchaseReturn.total_amount), 0).label("return_value"),
    ).filter(PurchaseReturn.shop_id == shop_id).group_by(PurchaseReturn.vendor_id).subquery()
    bills = db.query(
        VendorBill.vendor_id.label("vendor_id"),
        func.coalesce(func.sum(VendorBill.remaining_amount), 0).label("outstanding"),
    ).filter(VendorBill.shop_id == shop_id).group_by(VendorBill.vendor_id).subquery()
    credits = db.query(
        VendorCredit.vendor_id.label("vendor_id"),
        func.coalesce(func.sum(VendorCredit.amount - VendorCredit.applied_amount), 0).label("credit"),
    ).filter(VendorCredit.shop_id == shop_id, VendorCredit.status != "applied").group_by(VendorCredit.vendor_id).subquery()
    query = db.query(
        Vendor,
        func.coalesce(po.c.po_count, 0),
        func.coalesce(po.c.ordered_value, 0),
        func.coalesce(received.c.received_value, 0),
        func.coalesce(returned.c.return_value, 0),
        func.coalesce(bills.c.outstanding, 0),
        func.coalesce(credits.c.credit, 0),
    ).outerjoin(po, po.c.vendor_id == Vendor.id).outerjoin(
        received, received.c.vendor_id == Vendor.id
    ).outerjoin(returned, returned.c.vendor_id == Vendor.id).outerjoin(
        bills, bills.c.vendor_id == Vendor.id
    ).outerjoin(credits, credits.c.vendor_id == Vendor.id).filter(Vendor.shop_id == shop_id)
    if search:
        query = query.filter(Vendor.vendor_name.ilike(f"%{search.strip()}%"))
    total = query.count()
    rows = query.order_by(Vendor.vendor_name).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "vendor_id": vendor.id,
                "vendor_name": vendor.vendor_name,
                "purchase_order_count": int(po_count or 0),
                "ordered_value": _money(ordered_value),
                "received_value": _money(received_value),
                "purchase_return_value": _money(return_value),
                "outstanding_vendor_bills": _money(outstanding),
                "unapplied_vendor_credit": _money(credit),
            }
            for vendor, po_count, ordered_value, received_value, return_value, outstanding, credit in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_product_inventory_detail(db: Session, *, shop_id: int, product_id: int):
    incoming = _incoming_quantity_subquery(db, shop_id)
    row = db.query(Product, func.coalesce(incoming.c.incoming_quantity, 0)).outerjoin(
        incoming, incoming.c.product_id == Product.id
    ).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product, incoming_quantity = row
    reconciliation = list_reconciliation_report(
        db, shop_id=shop_id, search=product.sku, page=1, page_size=100000
    )["items"]
    reconciliation_item = next(item for item in reconciliation if item["product_id"] == product.id)
    movements = list_inventory_movements(
        db, shop_id=shop_id, product_id=product.id, page=1, page_size=10
    )["items"]
    receipts = db.query(GoodsReceiptItem, GoodsReceipt, PurchaseOrder).join(
        GoodsReceipt, GoodsReceipt.id == GoodsReceiptItem.goods_receipt_id
    ).join(PurchaseOrder, PurchaseOrder.id == GoodsReceipt.purchase_order_id).filter(
        GoodsReceipt.shop_id == shop_id, GoodsReceiptItem.product_id == product.id
    ).order_by(GoodsReceipt.created_at.desc()).limit(5).all()
    returns = db.query(PurchaseReturnItem, PurchaseReturn, PurchaseOrder).join(
        PurchaseReturn, PurchaseReturn.id == PurchaseReturnItem.purchase_return_id
    ).join(PurchaseOrder, PurchaseOrder.id == PurchaseReturn.purchase_order_id).filter(
        PurchaseReturn.shop_id == shop_id, PurchaseReturnItem.product_id == product.id
    ).order_by(PurchaseReturn.created_at.desc()).limit(5).all()
    return {
        "product": _product_item(product, incoming_quantity),
        "reconciliation": reconciliation_item,
        "recent_movements": movements,
        "recent_receipts": [
            {
                "receipt_number": receipt.receipt_number,
                "purchase_order_number": po.purchase_order_number,
                "received_date": receipt.received_date,
                "quantity": item.received_quantity,
                "unit_cost": _money(item.unit_cost),
            }
            for item, receipt, po in receipts
        ],
        "recent_purchase_returns": [
            {
                "return_number": purchase_return.return_number,
                "purchase_order_number": po.purchase_order_number,
                "return_date": purchase_return.return_date,
                "quantity": item.returned_quantity,
                "value": _money(item.line_total),
            }
            for item, purchase_return, po in returns
        ],
    }


def csv_text(headers: list[str], rows: list[list[object]]) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()
