import hashlib
import json
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.invoice_idempotency import InvoiceIdempotencyKey
from app.models.invoice_item import InvoiceItem
from app.models.invoice_payment import InvoicePayment
from app.models.invoice_return import (
    InvoiceRefund,
    InvoiceReturn,
    InvoiceReturnItem,
    InvoiceReversalSequence,
)
from app.models.invoice_sequence import InvoiceSequence
from app.models.product import Product
from app.models.product_sales_analytics import ProductSalesAnalytics
from app.models.shop import Shop
from app.models.stock_movement import StockMovementType
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCancelPayload,
    InvoiceCreate,
    InvoicePaymentCreate,
    InvoicePaymentInput,
    InvoiceRefundCreate,
    InvoiceReturnCreate,
    InvoiceUpdate,
)
from app.models.business_audit_log import BusinessAuditAction
from app.services.business_audit_service import record_business_audit
from app.services.customer_service import create_or_update_customer_from_invoice
from app.services.entitlement_service import ensure_can_create
from app.services.gst_service import GstLineInput, calculate_gst_invoice, resolve_gst_state_code
from app.services.stock_service import apply_stock_movement


FINALIZED_INVOICE_STATUS = "saved"
CANCELLED_INVOICE_STATUS = "cancelled"
EDITABLE_INVOICE_STATUS = "draft"
COMPLETED_PAYMENT_STATUS = "completed"
COMPLETED_RETURN_STATUS = "completed"
COMPLETED_REFUND_STATUS = "completed"
RETAIL_PAYMENT_METHODS = {"cash", "upi", "card", "bank_transfer", "other"}


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")

    if isinstance(value, Decimal):
        return value

    return Decimal(str(value))


def _money(value) -> Decimal:
    return _to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _decimal_fingerprint(value: Decimal) -> str:
    decimal_value = _to_decimal(value)
    if decimal_value == Decimal("0"):
        return "0"
    return format(decimal_value.normalize(), "f")


def _canonicalize_for_fingerprint(value):
    if isinstance(value, Decimal):
        return _decimal_fingerprint(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            key: _canonicalize_for_fingerprint(value[key])
            for key in sorted(value)
            if value[key] is not None
        }
    if isinstance(value, list):
        return [_canonicalize_for_fingerprint(item) for item in value]
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    return value


def _invoice_request_fingerprint(payload: InvoiceCreate) -> str:
    data = payload.model_dump(mode="python", exclude={"client_request_id", "total_tax_amount"})

    items = data.get("items") or []
    data["items"] = sorted(
        items,
        key=lambda item: json.dumps(
            _canonicalize_for_fingerprint(item),
            sort_keys=True,
            separators=(",", ":"),
        ),
    )

    canonical = _canonicalize_for_fingerprint(data)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _payment_request_fingerprint(invoice_id: int, payload: InvoicePaymentCreate) -> str:
    data = payload.model_dump(mode="python", exclude={"client_request_id"})
    data["invoice_id"] = invoice_id
    canonical = _canonicalize_for_fingerprint(data)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _return_request_fingerprint(invoice_id: int, payload: InvoiceReturnCreate) -> str:
    data = payload.model_dump(mode="python", exclude={"client_request_id"})
    data["invoice_id"] = invoice_id
    data["items"] = sorted(
        data.get("items") or [],
        key=lambda item: json.dumps(_canonicalize_for_fingerprint(item), sort_keys=True),
    )
    canonical = _canonicalize_for_fingerprint(data)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _refund_request_fingerprint(return_id: int, payload: InvoiceRefundCreate) -> str:
    data = payload.model_dump(mode="python", exclude={"client_request_id"})
    data["return_id"] = return_id
    canonical = _canonicalize_for_fingerprint(data)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _normalize_client_request_id(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    return cleaned or None


def _load_idempotent_invoice(
    db: Session,
    *,
    shop_id: int,
    client_request_id: str,
    request_fingerprint: str,
):
    existing = (
        db.query(InvoiceIdempotencyKey)
        .filter(
            InvoiceIdempotencyKey.shop_id == shop_id,
            InvoiceIdempotencyKey.client_request_id == client_request_id,
        )
        .first()
    )

    if not existing:
        return None

    if existing.request_fingerprint != request_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invoice request key was already used with different invoice data.",
        )

    if existing.invoice_id:
        invoice = (
            db.query(Invoice)
            .filter(
                Invoice.id == existing.invoice_id,
                Invoice.shop_id == shop_id,
            )
            .first()
        )
        if invoice:
            return invoice

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Invoice creation for this request is still in progress. Please retry shortly.",
    )


def _reserve_invoice_idempotency(
    db: Session,
    *,
    shop_id: int,
    client_request_id: str | None,
    request_fingerprint: str,
) -> InvoiceIdempotencyKey | None:
    if not client_request_id:
        return None

    record = InvoiceIdempotencyKey(
        shop_id=shop_id,
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
        status="started",
    )
    db.add(record)

    try:
        db.flush()
        return record
    except IntegrityError as exc:
        db.rollback()

        replay_invoice = _load_idempotent_invoice(
            db,
            shop_id=shop_id,
            client_request_id=client_request_id,
            request_fingerprint=request_fingerprint,
        )
        if replay_invoice:
            return replay_invoice

        raise exc


def _normalize_payment_method(value: str | None) -> str:
    method = (value or "other").strip().lower()
    if method == "mixed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use individual payment methods for payment ledger entries.",
        )
    if method not in RETAIL_PAYMENT_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported payment method.",
        )
    return method


def _payment_audit_snapshot(payment: InvoicePayment, invoice: Invoice) -> dict:
    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "payment_id": payment.id,
        "amount": _money(payment.amount),
        "payment_method": payment.payment_method,
        "payment_reference": payment.payment_reference,
        "status": payment.status,
        "received_at": payment.received_at,
    }


def _return_audit_snapshot(return_record: InvoiceReturn) -> dict:
    return {
        "invoice_id": return_record.invoice_id,
        "return_id": return_record.id,
        "return_number": return_record.return_number,
        "credit_note_number": return_record.credit_note_number,
        "reason": return_record.reason,
        "total_amount": _money(return_record.total_amount),
        "applied_to_outstanding_amount": _money(return_record.applied_to_outstanding_amount),
        "refundable_amount": _money(return_record.refundable_amount),
        "status": return_record.status,
    }


def _refund_audit_snapshot(refund: InvoiceRefund) -> dict:
    return {
        "invoice_id": refund.invoice_id,
        "return_id": refund.return_id,
        "refund_id": refund.id,
        "amount": _money(refund.amount),
        "refund_method": refund.refund_method,
        "reference": refund.reference,
        "status": refund.status,
        "refunded_at": refund.refunded_at,
    }


def _get_completed_invoice_payments(db: Session, invoice_id: int) -> list[InvoicePayment]:
    return (
        db.query(InvoicePayment)
        .filter(
            InvoicePayment.invoice_id == invoice_id,
            InvoicePayment.status == COMPLETED_PAYMENT_STATUS,
        )
        .order_by(InvoicePayment.received_at.asc(), InvoicePayment.id.asc())
        .all()
    )


def _get_completed_invoice_returns(db: Session, invoice_id: int) -> list[InvoiceReturn]:
    return (
        db.query(InvoiceReturn)
        .filter(
            InvoiceReturn.invoice_id == invoice_id,
            InvoiceReturn.status == COMPLETED_RETURN_STATUS,
        )
        .options(selectinload(InvoiceReturn.items), selectinload(InvoiceReturn.refunds))
        .order_by(InvoiceReturn.created_at.asc(), InvoiceReturn.id.asc())
        .all()
    )


def _get_completed_return_refunds(db: Session, return_id: int) -> list[InvoiceRefund]:
    return (
        db.query(InvoiceRefund)
        .filter(
            InvoiceRefund.return_id == return_id,
            InvoiceRefund.status == COMPLETED_REFUND_STATUS,
        )
        .order_by(InvoiceRefund.refunded_at.asc(), InvoiceRefund.id.asc())
        .all()
    )


def _completed_return_credit_total(db: Session, invoice_id: int) -> Decimal:
    value = (
        db.query(func.coalesce(func.sum(InvoiceReturn.total_amount), 0))
        .filter(
            InvoiceReturn.invoice_id == invoice_id,
            InvoiceReturn.status == COMPLETED_RETURN_STATUS,
        )
        .scalar()
    )
    return _money(value)


def _completed_invoice_refund_total(db: Session, invoice_id: int) -> Decimal:
    value = (
        db.query(func.coalesce(func.sum(InvoiceRefund.amount), 0))
        .filter(
            InvoiceRefund.invoice_id == invoice_id,
            InvoiceRefund.status == COMPLETED_REFUND_STATUS,
        )
        .scalar()
    )
    return _money(value)


def _net_invoice_outstanding(db: Session, invoice: Invoice) -> Decimal:
    return_credit_total = _completed_return_credit_total(db, invoice.id)
    refund_total = _completed_invoice_refund_total(db, invoice.id)
    net_outstanding = _money(
        _to_decimal(invoice.final_amount)
        - return_credit_total
        - _to_decimal(invoice.paid_amount)
        + refund_total
    )
    if net_outstanding < Decimal("0.00"):
        return Decimal("0.00")
    return net_outstanding


def _sync_invoice_outstanding_cache(invoice: Invoice, outstanding_amount: Decimal) -> None:
    invoice.remaining_amount = _money(max(_to_decimal(outstanding_amount), Decimal("0.00")))
    if invoice.remaining_amount == Decimal("0.00"):
        invoice.payment_status = "paid"
    elif _to_decimal(invoice.paid_amount) > Decimal("0.00"):
        invoice.payment_status = "partial"
    else:
        invoice.payment_status = "pending"


def _remaining_returnable_by_item(db: Session, invoice: Invoice) -> dict[int, Decimal]:
    returned_rows = (
        db.query(
            InvoiceReturnItem.invoice_item_id,
            func.coalesce(func.sum(InvoiceReturnItem.quantity), 0).label("returned_quantity"),
        )
        .join(InvoiceReturn, InvoiceReturn.id == InvoiceReturnItem.return_id)
        .filter(
            InvoiceReturn.shop_id == invoice.shop_id,
            InvoiceReturn.invoice_id == invoice.id,
            InvoiceReturn.status == COMPLETED_RETURN_STATUS,
        )
        .group_by(InvoiceReturnItem.invoice_item_id)
        .all()
    )
    returned_by_item = {
        int(row.invoice_item_id): _to_decimal(row.returned_quantity)
        for row in returned_rows
    }
    return {
        item.id: _to_decimal(item.quantity) - returned_by_item.get(item.id, Decimal("0.00"))
        for item in invoice.items
    }


def _format_reversal_number(prefix: str, sequence_date: date, sequence_number: int) -> str:
    return f"{prefix}-{sequence_date.strftime('%Y%m%d')}-{sequence_number:03d}"


def _allocate_reversal_sequence(
    db: Session,
    *,
    shop_id: int,
    sequence_date: date,
    sequence_type: str,
) -> int:
    bind = db.get_bind()

    if bind.dialect.name == "postgresql":
        statement = (
            postgresql_insert(InvoiceReversalSequence)
            .values(
                shop_id=shop_id,
                sequence_type=sequence_type,
                sequence_date=sequence_date,
                last_number=1,
            )
            .on_conflict_do_update(
                index_elements=[
                    InvoiceReversalSequence.shop_id,
                    InvoiceReversalSequence.sequence_type,
                    InvoiceReversalSequence.sequence_date,
                ],
                set_={
                    "last_number": InvoiceReversalSequence.last_number + 1,
                    "updated_at": func.now(),
                },
            )
            .returning(InvoiceReversalSequence.last_number)
        )
        return int(db.execute(statement).scalar_one())

    sequence = (
        db.query(InvoiceReversalSequence)
        .filter(
            InvoiceReversalSequence.shop_id == shop_id,
            InvoiceReversalSequence.sequence_type == sequence_type,
            InvoiceReversalSequence.sequence_date == sequence_date,
        )
        .with_for_update()
        .one_or_none()
    )
    if sequence:
        sequence.last_number = int(sequence.last_number or 0) + 1
        db.flush()
        return int(sequence.last_number)

    try:
        with db.begin_nested():
            sequence = InvoiceReversalSequence(
                shop_id=shop_id,
                sequence_type=sequence_type,
                sequence_date=sequence_date,
                last_number=1,
            )
            db.add(sequence)
            db.flush()
            return int(sequence.last_number)
    except IntegrityError:
        sequence = (
            db.query(InvoiceReversalSequence)
            .filter(
                InvoiceReversalSequence.shop_id == shop_id,
                InvoiceReversalSequence.sequence_type == sequence_type,
                InvoiceReversalSequence.sequence_date == sequence_date,
            )
            .with_for_update()
            .one()
        )
        sequence.last_number = int(sequence.last_number or 0) + 1
        db.flush()
        return int(sequence.last_number)


def _generate_return_number(db: Session, shop_id: int, sequence_date: date) -> str:
    number = _allocate_reversal_sequence(
        db,
        shop_id=shop_id,
        sequence_date=sequence_date,
        sequence_type="return",
    )
    return _format_reversal_number("RTN", sequence_date, number)


def _generate_credit_note_number(db: Session, shop_id: int, sequence_date: date) -> str:
    number = _allocate_reversal_sequence(
        db,
        shop_id=shop_id,
        sequence_date=sequence_date,
        sequence_type="credit_note",
    )
    return _format_reversal_number("CN", sequence_date, number)


def _derive_payment_mode(payments: list[InvoicePayment | dict]) -> str | None:
    methods = []
    for payment in payments:
        if isinstance(payment, dict):
            amount = _to_decimal(payment.get("amount"))
            method = payment.get("payment_method")
        else:
            amount = _to_decimal(payment.amount)
            method = payment.payment_method

        if amount > Decimal("0.00") and method:
            methods.append(method)

    distinct_methods = sorted(set(methods))
    if not distinct_methods:
        return None
    if len(distinct_methods) == 1:
        return distinct_methods[0]
    return "mixed"


def _derive_invoice_payment_summary(
    *,
    final_amount: Decimal,
    payments: list[InvoicePayment | dict],
) -> dict:
    paid_amount = _money(
        sum((_to_decimal(payment["amount"] if isinstance(payment, dict) else payment.amount) for payment in payments), Decimal("0.00"))
    )
    remaining_amount, payment_status = _calculate_payment_status(final_amount, paid_amount)
    return {
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "payment_status": payment_status,
        "payment_mode": _derive_payment_mode(payments),
    }


def _sync_invoice_payment_summary(db: Session, invoice: Invoice) -> dict:
    payments = _get_completed_invoice_payments(db, invoice.id)
    paid_amount = _money(
        sum((_to_decimal(payment.amount) for payment in payments), Decimal("0.00"))
    )
    invoice.paid_amount = paid_amount
    remaining_amount = _net_invoice_outstanding(db, invoice)
    if remaining_amount == Decimal("0.00"):
        payment_status = "paid"
    elif paid_amount > Decimal("0.00"):
        payment_status = "partial"
    else:
        payment_status = "pending"
    summary = {
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "payment_status": payment_status,
        "payment_mode": _derive_payment_mode(payments),
    }
    invoice.paid_amount = summary["paid_amount"]
    invoice.remaining_amount = summary["remaining_amount"]
    invoice.payment_status = summary["payment_status"]
    invoice.payment_mode = summary["payment_mode"]

    for analytics in getattr(invoice, "sales_analytics", []) or []:
        analytics.payment_status = invoice.payment_status

    return summary


def _build_initial_payment_entries(payload: InvoiceCreate, final_amount: Decimal) -> list[dict]:
    if payload.payments is not None:
        entries = [
            {
                "amount": _money(payment.amount),
                "payment_method": _normalize_payment_method(payment.payment_method),
                "payment_reference": payment.payment_reference,
                "notes": payment.notes,
                "received_at": payment.received_at,
            }
            for payment in payload.payments
        ]
    elif _to_decimal(payload.paid_amount) > Decimal("0.00"):
        entries = [
            {
                "amount": _money(payload.paid_amount),
                "payment_method": _normalize_payment_method(payload.payment_mode),
                "payment_reference": None,
                "notes": "Initial payment recorded during invoice creation",
                "received_at": None,
            }
        ]
    else:
        entries = []

    total = _money(sum((_to_decimal(entry["amount"]) for entry in entries), Decimal("0.00")))
    if total > _money(final_amount):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment amount cannot exceed invoice total.",
        )

    return entries


def _create_payment_row(
    *,
    db: Session,
    invoice: Invoice,
    current_user: User,
    amount: Decimal,
    payment_method: str,
    payment_reference: str | None = None,
    notes: str | None = None,
    received_at: datetime | None = None,
    client_request_id: str | None = None,
    request_fingerprint: str | None = None,
) -> InvoicePayment:
    payment = InvoicePayment(
        shop_id=current_user.shop_id,
        invoice_id=invoice.id,
        amount=_money(amount),
        payment_method=_normalize_payment_method(payment_method),
        payment_reference=payment_reference,
        notes=notes,
        status=COMPLETED_PAYMENT_STATUS,
        client_request_id=_normalize_client_request_id(client_request_id),
        request_fingerprint=request_fingerprint,
        received_at=received_at or _utcnow_naive(),
        created_by=current_user.id,
    )
    db.add(payment)
    db.flush()
    return payment


def _ensure_invoice_full_editable(invoice: Invoice):
    if invoice.invoice_status == CANCELLED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cancelled invoices cannot be edited.",
        )

    if invoice.invoice_status == FINALIZED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Finalized invoices cannot be edited. Use payment or return workflows instead.",
        )


def _invoice_audit_snapshot(invoice: Invoice, *, item_count: int | None = None) -> dict:
    if item_count is None:
        item_count = len(getattr(invoice, "items", []) or [])

    return {
        "invoice_number": invoice.invoice_number,
        "customer_id": invoice.customer_id,
        "invoice_status": invoice.invoice_status,
        "payment_status": invoice.payment_status,
        "payment_mode": invoice.payment_mode,
        "invoice_date": invoice.invoice_date,
        "tax_treatment": getattr(invoice, "tax_treatment", "non_gst"),
        "total_tax_amount": _money(invoice.total_tax_amount),
        "final_amount": _money(invoice.final_amount),
        "paid_amount": _money(invoice.paid_amount),
        "remaining_amount": _money(invoice.remaining_amount),
        "notes": invoice.notes,
        "item_count": item_count,
    }


def _get_product_code(product: Product) -> str:
    if getattr(product, "sku", None):
        return product.sku

    if getattr(product, "barcode", None):
        return product.barcode

    return str(product.id)


def _get_product_buying_price(product: Product) -> Decimal:
    if hasattr(product, "buying_price"):
        return _money(product.buying_price)

    if hasattr(product, "buy_price"):
        return _money(product.buy_price)

    return Decimal("0.00")


def _get_product_mrp(product: Product) -> Decimal:
    if hasattr(product, "mrp"):
        return _money(product.mrp)

    if hasattr(product, "selling_price"):
        return _money(product.selling_price)

    return Decimal("0.00")


def _get_product_stock(product: Product) -> Decimal:
    return _to_decimal(getattr(product, "stock_quantity", 0))


def _get_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found",
        )
    return shop


def _stock_quantity_int(quantity: Decimal) -> int:
    decimal_quantity = _to_decimal(quantity)
    if decimal_quantity != decimal_quantity.to_integral_value():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fractional stock quantities are not supported.",
        )
    return int(decimal_quantity)


def _convert_draft_reservation_to_sale(
    db: Session,
    *,
    invoice: Invoice,
    quantities_by_product: dict[int, Decimal],
    products_by_id: dict[int, Product],
    current_user: User,
) -> None:
    for product_id in sorted(quantities_by_product):
        quantity = _stock_quantity_int(quantities_by_product[product_id])
        if quantity <= 0:
            continue
        product = products_by_id[product_id]
        apply_stock_movement(
            db,
            product=product,
            shop_id=current_user.shop_id,
            quantity_delta=quantity,
            movement_type=StockMovementType.DRAFT_RELEASE,
            reference_type="invoice",
            reference_id=invoice.id,
            reason="Draft reservation finalized",
            client_request_id=f"draft-finalize-release-invoice-{invoice.id}-product-{product_id}",
            actor=current_user,
        )
        apply_stock_movement(
            db,
            product=product,
            shop_id=current_user.shop_id,
            quantity_delta=-quantity,
            movement_type=StockMovementType.SALE,
            reference_type="invoice",
            reference_id=invoice.id,
            reason="Finalized invoice sale",
            client_request_id=f"sale-invoice-{invoice.id}-product-{product_id}",
            actor=current_user,
        )


def _validate_stock_quantity(product: Product, requested_quantity: Decimal):
    if requested_quantity <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantity must be greater than zero for {product.name}",
        )

    if requested_quantity != requested_quantity.to_integral_value():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Fractional stock quantity is not supported for {product.name}. "
                "Enter a whole-number quantity."
            ),
        )


def _lock_products_for_invoice(
    db: Session,
    shop_id: int,
    product_ids: list[int],
    *,
    require_all: bool = True,
) -> dict[int, Product]:
    unique_product_ids = sorted({product_id for product_id in product_ids if product_id})
    if not unique_product_ids:
        return {}

    products = (
        db.query(Product)
        .filter(
            Product.shop_id == shop_id,
            Product.id.in_(unique_product_ids),
        )
        .order_by(Product.id.asc())
        .with_for_update()
        .all()
    )
    products_by_id = {product.id: product for product in products}

    if require_all:
        missing_ids = [product_id for product_id in unique_product_ids if product_id not in products_by_id]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )

    return products_by_id


def _aggregate_requested_quantities(items, products_by_id: dict[int, Product]) -> dict[int, Decimal]:
    requested_by_product: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))

    for item_payload in items:
        product = products_by_id.get(item_payload.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )

        requested_quantity = _to_decimal(item_payload.quantity)
        _validate_stock_quantity(product, requested_quantity)
        requested_by_product[product.id] += requested_quantity

    return dict(requested_by_product)


def _validate_available_stock(
    *,
    products_by_id: dict[int, Product],
    requested_by_product: dict[int, Decimal],
    restored_by_product: dict[int, Decimal] | None = None,
):
    restored_by_product = restored_by_product or {}

    for product_id, requested_quantity in requested_by_product.items():
        product = products_by_id[product_id]
        available_stock = _get_product_stock(product) + restored_by_product.get(
            product_id,
            Decimal("0.00"),
        )

        if requested_quantity > available_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for {product.name}. "
                    f"Available: {available_stock}, requested: {requested_quantity}"
                ),
            )


def _calculate_payment_status(final_amount: Decimal, paid_amount: Decimal) -> tuple[Decimal, str]:
    final_amount = _money(final_amount)
    paid_amount = _money(paid_amount)

    if paid_amount < Decimal("0.00"):
        paid_amount = Decimal("0.00")

    if paid_amount > final_amount:
        paid_amount = final_amount

    remaining_amount = _money(final_amount - paid_amount)

    if final_amount == Decimal("0.00") or remaining_amount == Decimal("0.00"):
        return remaining_amount, "paid"

    if paid_amount > Decimal("0.00"):
        return remaining_amount, "partial"

    return remaining_amount, "pending"


def _normalize_paid_amount(final_amount: Decimal, paid_amount: Decimal) -> Decimal:
    final_amount = _money(final_amount)
    paid_amount = _money(paid_amount)

    if paid_amount < Decimal("0.00"):
        return Decimal("0.00")

    if paid_amount > final_amount:
        return final_amount

    return paid_amount


def _resolve_invoice_amounts(
    *,
    subtotal_amount: Decimal,
    item_discount_amount: Decimal,
    total_tax_amount: Decimal,
    requested_total_payable_amount: Decimal | None,
    base_total_profit: Decimal,
):
    billed_amount = _money(subtotal_amount - item_discount_amount + total_tax_amount)

    if requested_total_payable_amount is None:
        final_amount = billed_amount
    else:
        final_amount = _money(requested_total_payable_amount)

    if final_amount > billed_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total payable cannot be greater than total billed amount",
        )

    extra_discount_amount = _money(billed_amount - final_amount)
    total_discount_amount = _money(item_discount_amount + extra_discount_amount)
    total_profit = _money(base_total_profit - extra_discount_amount)

    return {
        "billed_amount": billed_amount,
        "extra_discount_amount": extra_discount_amount,
        "total_discount_amount": total_discount_amount,
        "final_amount": final_amount,
        "total_profit": total_profit,
    }


def _calculate_invoice_gst(
    *,
    shop: Shop,
    customer_payload,
    prepared_items: list[dict],
    requested_taxable_payable_amount: Decimal | None,
):
    return calculate_gst_invoice(
        gst_enabled=bool(getattr(shop, "gst_enabled", False)),
        seller_gstin=getattr(shop, "gstin", None),
        seller_state=getattr(shop, "state", None),
        seller_state_code=getattr(shop, "gst_state_code", None),
        customer_gstin=getattr(customer_payload, "gst_number", None),
        customer_state=getattr(customer_payload, "state", None),
        customer_state_code=resolve_gst_state_code(
            gstin=getattr(customer_payload, "gst_number", None),
        ),
        lines=[
            GstLineInput(
                taxable_before_invoice_discount=prepared["total_selling_price"],
                gst_rate=prepared["gst_rate"],
            )
            for prepared in prepared_items
        ],
        requested_taxable_payable_amount=requested_taxable_payable_amount,
    )


def _apply_tax_lines(prepared_items: list[dict], tax_result):
    for prepared, tax_line in zip(prepared_items, tax_result.lines):
        prepared["taxable_value"] = tax_line.taxable_value
        prepared["gst_rate"] = tax_line.gst_rate
        prepared["cgst_rate"] = tax_line.cgst_rate
        prepared["cgst_amount"] = tax_line.cgst_amount
        prepared["sgst_rate"] = tax_line.sgst_rate
        prepared["sgst_amount"] = tax_line.sgst_amount
        prepared["igst_rate"] = tax_line.igst_rate
        prepared["igst_amount"] = tax_line.igst_amount
        prepared["total_tax_amount"] = tax_line.total_tax_amount


def _amounts_from_tax_result(
    *,
    item_discount_amount: Decimal,
    base_total_profit: Decimal,
    tax_result,
):
    extra_discount_amount = tax_result.extra_discount_amount
    billed_amount = _money(tax_result.final_amount + extra_discount_amount)
    return {
        "billed_amount": billed_amount,
        "extra_discount_amount": extra_discount_amount,
        "total_discount_amount": _money(item_discount_amount + extra_discount_amount),
        "final_amount": tax_result.final_amount,
        "total_profit": _money(base_total_profit - extra_discount_amount),
    }


def _adjust_customer_totals_after_invoice_edit(
    *,
    db: Session,
    shop_id: int,
    old_customer_id: int | None,
    new_customer_id: int | None,
    old_final_amount: Decimal,
    new_final_amount: Decimal,
):
    if old_customer_id == new_customer_id:
        if not new_customer_id:
            return

        customer = (
            db.query(Customer)
            .filter(Customer.id == new_customer_id, Customer.shop_id == shop_id)
            .first()
        )

        if customer:
            customer.total_spent = _money(
                _to_decimal(customer.total_spent) - _money(old_final_amount) + _money(new_final_amount)
            )
        return

    if old_customer_id:
        old_customer = (
            db.query(Customer)
            .filter(Customer.id == old_customer_id, Customer.shop_id == shop_id)
            .first()
        )

        if old_customer:
            old_customer.total_orders = max(int(old_customer.total_orders or 0) - 1, 0)
            old_customer.total_spent = _money(
                _to_decimal(old_customer.total_spent) - _money(old_final_amount)
            )

    if new_customer_id:
        new_customer = (
            db.query(Customer)
            .filter(Customer.id == new_customer_id, Customer.shop_id == shop_id)
            .first()
        )

        if new_customer:
            new_customer.total_orders = int(new_customer.total_orders or 0) + 1
            new_customer.total_spent = _money(
                _to_decimal(new_customer.total_spent) + _money(new_final_amount)
            )


def _resolve_invoice_item_pricing(
    *,
    mrp: Decimal,
    buy_price: Decimal,
    requested_quantity: Decimal,
    product_name: str,
    discount_percentage_input: Decimal | None = None,
    discount_amount_per_unit_input: Decimal | None = None,
    selling_price_per_unit_input: Decimal | None = None,
):
    if selling_price_per_unit_input is not None:
        selling_price_per_unit = _money(selling_price_per_unit_input)

        if selling_price_per_unit < Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selling price cannot be negative for {product_name}",
            )

        if selling_price_per_unit > mrp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selling price cannot be greater than MRP for {product_name}",
            )

        discount_amount_per_unit = _money(mrp - selling_price_per_unit)
        discount_percentage = (
            _money(discount_amount_per_unit * Decimal("100") / mrp)
            if mrp > Decimal("0.00")
            else Decimal("0.00")
        )
    elif discount_amount_per_unit_input is not None:
        discount_amount_per_unit = _money(discount_amount_per_unit_input)

        if discount_amount_per_unit > mrp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Discount cannot be greater than MRP for {product_name}",
            )

        selling_price_per_unit = _money(mrp - discount_amount_per_unit)
        discount_percentage = (
            _money(discount_amount_per_unit * Decimal("100") / mrp)
            if mrp > Decimal("0.00")
            else Decimal("0.00")
        )
    else:
        discount_percentage = _to_decimal(discount_percentage_input)
        discount_amount_per_unit = _money(
            mrp * discount_percentage / Decimal("100")
        )

        if discount_amount_per_unit > mrp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Discount cannot be greater than MRP for {product_name}",
            )

        selling_price_per_unit = _money(mrp - discount_amount_per_unit)

    total_item_discount = _money(discount_amount_per_unit * requested_quantity)
    total_selling_price = _money(selling_price_per_unit * requested_quantity)
    item_total_buy_cost = _money(buy_price * requested_quantity)
    profit_per_unit = _money(selling_price_per_unit - buy_price)
    item_total_profit = _money(total_selling_price - item_total_buy_cost)

    return {
        "discount_percentage": discount_percentage,
        "discount_amount_per_unit": discount_amount_per_unit,
        "selling_price_per_unit": selling_price_per_unit,
        "total_discount_amount": total_item_discount,
        "total_selling_price": total_selling_price,
        "total_buy_cost": item_total_buy_cost,
        "profit_per_unit": profit_per_unit,
        "total_profit": item_total_profit,
    }


def _format_invoice_number(invoice_date: date, sequence_number: int) -> str:
    """
    Format: INV-20260512-001
    Sequence is per shop and per date.
    """

    date_part = invoice_date.strftime("%Y%m%d")
    return f"INV-{date_part}-{sequence_number:03d}"


def _allocate_invoice_sequence(db: Session, shop_id: int, invoice_date: date) -> int:
    bind = db.get_bind()

    if bind.dialect.name == "postgresql":
        statement = (
            postgresql_insert(InvoiceSequence)
            .values(
                shop_id=shop_id,
                sequence_date=invoice_date,
                last_number=1,
            )
            .on_conflict_do_update(
                index_elements=[
                    InvoiceSequence.shop_id,
                    InvoiceSequence.sequence_date,
                ],
                set_={
                    "last_number": InvoiceSequence.last_number + 1,
                    "updated_at": func.now(),
                },
            )
            .returning(InvoiceSequence.last_number)
        )
        return int(db.execute(statement).scalar_one())

    sequence = (
        db.query(InvoiceSequence)
        .filter(
            InvoiceSequence.shop_id == shop_id,
            InvoiceSequence.sequence_date == invoice_date,
        )
        .with_for_update()
        .one_or_none()
    )

    if sequence:
        sequence.last_number = int(sequence.last_number or 0) + 1
        db.flush()
        return int(sequence.last_number)

    try:
        with db.begin_nested():
            sequence = InvoiceSequence(
                shop_id=shop_id,
                sequence_date=invoice_date,
                last_number=1,
            )
            db.add(sequence)
            db.flush()
            return int(sequence.last_number)
    except IntegrityError:
        sequence = (
            db.query(InvoiceSequence)
            .filter(
                InvoiceSequence.shop_id == shop_id,
                InvoiceSequence.sequence_date == invoice_date,
            )
            .with_for_update()
            .one()
        )
        sequence.last_number = int(sequence.last_number or 0) + 1
        db.flush()
        return int(sequence.last_number)


def _generate_invoice_number(db: Session, shop_id: int, invoice_date: date) -> str:
    sequence_number = _allocate_invoice_sequence(db, shop_id, invoice_date)
    return _format_invoice_number(invoice_date, sequence_number)


def _is_invoice_number_integrity_error(exc: IntegrityError) -> bool:
    return "uq_invoices_shop_invoice_number" in str(exc.orig)


def _ensure_invoice_belongs_to_shop(invoice: Invoice | None, shop_id: int):
    if not invoice or invoice.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )


def list_invoices(
    db: Session,
    current_user: User,
    search: str | None = None,
    payment_status: str | None = None,
    invoice_status: str | None = None,
    invoice_date: date | None = None,
    page: int = 1,
    page_size: int = 20,
):
    query = db.query(Invoice).filter(Invoice.shop_id == current_user.shop_id)

    if search:
        cleaned_search = search.strip()

        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(f"%{cleaned_search}%"),
                Invoice.customer_name_snapshot.ilike(f"%{cleaned_search}%"),
                Invoice.customer_phone_snapshot.ilike(f"%{cleaned_search}%"),
            )
        )

    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)

    if invoice_status:
        query = query.filter(Invoice.invoice_status == invoice_status)

    if invoice_date:
        query = query.filter(Invoice.invoice_date == invoice_date)

    total = query.count()

    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)
    offset = (page - 1) * page_size

    items = (
        query.order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_invoice(invoice_id: int, db: Session, current_user: User):
    invoice = (
        db.query(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
            selectinload(Invoice.returns).selectinload(InvoiceReturn.items),
            selectinload(Invoice.returns).selectinload(InvoiceReturn.refunds),
        )
        .filter(
            Invoice.id == invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .first()
    )

    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    return invoice


def get_invoice_preview(invoice_id: int, db: Session, current_user: User):
    invoice = get_invoice(invoice_id, db, current_user)

    customer = None
    if invoice.customer_id:
        customer = (
            db.query(Customer)
            .filter(
                Customer.id == invoice.customer_id,
                Customer.shop_id == current_user.shop_id,
            )
            .first()
        )

    return {
        "invoice": invoice,
        "customer": customer,
    }


def get_invoice_stats(db: Session, current_user: User):
    today = date.today()

    # Month bounds as a half-open date range. The previous implementation used
    # extract('year'/'month', invoice_date), which wraps the column in a
    # function call and makes the predicate non-sargable -- Postgres cannot use
    # any index on invoice_date and must scan every row. A plain range
    # comparison keeps the (shop_id, invoice_date) index usable.
    month_start = today.replace(day=1)
    if month_start.month == 12:
        next_month_start = date(month_start.year + 1, 1, 1)
    else:
        next_month_start = date(month_start.year, month_start.month + 1, 1)

    # Every figure below shares the same base predicate (this shop, excluding
    # cancelled invoices), so FILTER clauses collapse what were seven separate
    # round trips into a single pass.
    row = (
        db.query(
            func.count(Invoice.id).label("total_invoices"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("total_sales_amount"),
            func.coalesce(func.sum(Invoice.total_discount_amount), 0).label("total_discount_given"),
            func.coalesce(func.sum(Invoice.total_profit), 0).label("total_profit"),
            func.coalesce(func.sum(Invoice.paid_amount), 0).label("paid_amount"),
            func.coalesce(func.sum(Invoice.remaining_amount), 0).label("pending_amount"),
            func.coalesce(
                func.sum(Invoice.final_amount).filter(Invoice.invoice_date == today), 0
            ).label("today_sales"),
            func.coalesce(
                func.sum(Invoice.final_amount).filter(
                    Invoice.invoice_date >= month_start,
                    Invoice.invoice_date < next_month_start,
                ),
                0,
            ).label("monthly_sales"),
            func.coalesce(
                func.count(Invoice.id).filter(Invoice.payment_status == "paid"), 0
            ).label("paid_invoices"),
            func.coalesce(
                func.count(Invoice.id).filter(Invoice.payment_status == "pending"), 0
            ).label("pending_invoices"),
            func.coalesce(
                func.count(Invoice.id).filter(Invoice.payment_status == "partial"), 0
            ).label("partial_invoices"),
        )
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.invoice_status != "cancelled",
        )
        .one()
    )
    active_return_filters = (
        InvoiceReturn.shop_id == current_user.shop_id,
        InvoiceReturn.status == COMPLETED_RETURN_STATUS,
        Invoice.invoice_status != CANCELLED_INVOICE_STATUS,
    )
    returned_row = (
        db.query(
            func.coalesce(func.sum(InvoiceReturn.total_amount), 0).label("total_amount"),
            func.coalesce(func.sum(InvoiceReturn.total_profit), 0).label("total_profit"),
            func.coalesce(
                func.sum(InvoiceReturn.total_amount).filter(Invoice.invoice_date == today), 0
            ).label("today_returned"),
            func.coalesce(
                func.sum(InvoiceReturn.total_amount).filter(
                    Invoice.invoice_date >= month_start,
                    Invoice.invoice_date < next_month_start,
                ),
                0,
            ).label("monthly_returned"),
        )
        .join(Invoice, Invoice.id == InvoiceReturn.invoice_id)
        .filter(*active_return_filters)
        .one()
    )

    return {
        "total_invoices": row.total_invoices or 0,
        "total_sales_amount": _money(max(_to_decimal(row.total_sales_amount) - _to_decimal(returned_row.total_amount), Decimal("0.00"))),
        "total_discount_given": _money(row.total_discount_given),
        "total_profit": _money(_to_decimal(row.total_profit) - _to_decimal(returned_row.total_profit)),
        "today_sales": _money(max(_to_decimal(row.today_sales) - _to_decimal(returned_row.today_returned), Decimal("0.00"))),
        "monthly_sales": _money(max(_to_decimal(row.monthly_sales) - _to_decimal(returned_row.monthly_returned), Decimal("0.00"))),
        "pending_amount": _money(row.pending_amount),
        "paid_amount": _money(row.paid_amount),
        "paid_invoices": row.paid_invoices or 0,
        "pending_invoices": row.pending_invoices or 0,
        "partial_invoices": row.partial_invoices or 0,
    }


def create_invoice(payload: InvoiceCreate, db: Session, current_user: User):
    ensure_can_create(current_user.shop_id, "orders.monthly", db)

    if payload.invoice_status not in {EDITABLE_INVOICE_STATUS, FINALIZED_INVOICE_STATUS}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoices can only be created as draft or finalized.",
        )

    invoice_date_value = payload.invoice_date or date.today()
    shop = _get_shop(db, current_user.shop_id)
    client_request_id = _normalize_client_request_id(payload.client_request_id)
    request_fingerprint = _invoice_request_fingerprint(payload)

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice must contain at least one item",
        )

    idempotency_record = _reserve_invoice_idempotency(
        db,
        shop_id=current_user.shop_id,
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
    )
    if isinstance(idempotency_record, Invoice):
        return get_invoice(idempotency_record.id, db, current_user)

    invoice_number = _generate_invoice_number(
        db=db,
        shop_id=current_user.shop_id,
        invoice_date=invoice_date_value,
    )

    products_by_id = _lock_products_for_invoice(
        db,
        current_user.shop_id,
        [item.product_id for item in payload.items],
    )
    requested_by_product = _aggregate_requested_quantities(payload.items, products_by_id)
    _validate_available_stock(
        products_by_id=products_by_id,
        requested_by_product=requested_by_product,
    )

    prepared_items = []

    subtotal_amount = Decimal("0.00")
    item_discount_amount = Decimal("0.00")
    total_buy_cost = Decimal("0.00")
    base_total_profit = Decimal("0.00")

    for item_payload in payload.items:
        product = products_by_id[item_payload.product_id]
        requested_quantity = _to_decimal(item_payload.quantity)

        mrp = _get_product_mrp(product)
        buy_price = _get_product_buying_price(product)

        pricing = _resolve_invoice_item_pricing(
            mrp=mrp,
            buy_price=buy_price,
            requested_quantity=requested_quantity,
            product_name=product.name,
            discount_percentage_input=item_payload.discount_percentage,
            discount_amount_per_unit_input=item_payload.discount_amount_per_unit,
            selling_price_per_unit_input=item_payload.selling_price_per_unit,
        )

        subtotal_amount += _money(mrp * requested_quantity)
        item_discount_amount += pricing["total_discount_amount"]
        total_buy_cost += pricing["total_buy_cost"]
        base_total_profit += pricing["total_profit"]

        prepared_items.append(
            {
                "product": product,
                "quantity": requested_quantity,
                "product_code": item_payload.product_code or _get_product_code(product),
                    "product_name_snapshot": product.name,
                    "category_snapshot": getattr(product, "category", None),
                    "unit_snapshot": getattr(product, "unit", None),
                    "hsn_sac_snapshot": getattr(product, "hsn_sac", None),
                    "gst_rate": _to_decimal(getattr(product, "gst_rate", 0)),
                    "mrp": mrp,
                    "buy_price": buy_price,
                    **pricing,
                }
            )

    tax_result = _calculate_invoice_gst(
        shop=shop,
        customer_payload=payload.customer,
        prepared_items=prepared_items,
        requested_taxable_payable_amount=payload.total_payable_amount,
    )
    _apply_tax_lines(prepared_items, tax_result)
    invoice_amounts = _amounts_from_tax_result(
        item_discount_amount=item_discount_amount,
        base_total_profit=base_total_profit,
        tax_result=tax_result,
    )

    initial_payment_entries = _build_initial_payment_entries(
        payload,
        invoice_amounts["final_amount"],
    )
    initial_payment_summary = _derive_invoice_payment_summary(
        final_amount=invoice_amounts["final_amount"],
        payments=initial_payment_entries,
    )

    customer = create_or_update_customer_from_invoice(
        payload.customer,
        db,
        current_user,
    )

    invoice = Invoice(
        shop_id=current_user.shop_id,
        invoice_number=invoice_number,
        customer_id=customer.id,
        customer_name_snapshot=customer.full_name,
        customer_phone_snapshot=customer.phone,
        customer_email_snapshot=customer.email,
        customer_address_snapshot=customer.address,
        customer_city_snapshot=customer.city,
        customer_state_snapshot=customer.state,
        customer_state_code_snapshot=tax_result.customer_state_code,
        customer_pincode_snapshot=customer.pincode,
        customer_gst_number_snapshot=customer.gst_number,
        seller_gst_number_snapshot=tax_result.seller_gstin,
        seller_state_snapshot=tax_result.seller_state,
        seller_state_code_snapshot=tax_result.seller_state_code,
        tax_treatment=tax_result.tax_treatment,
        invoice_date=invoice_date_value,
        subtotal_amount=_money(subtotal_amount),
        total_discount_amount=invoice_amounts["total_discount_amount"],
        total_tax_amount=tax_result.total_tax_amount,
        billed_amount=invoice_amounts["billed_amount"],
        extra_discount_amount=invoice_amounts["extra_discount_amount"],
        final_amount=invoice_amounts["final_amount"],
        paid_amount=initial_payment_summary["paid_amount"],
        remaining_amount=initial_payment_summary["remaining_amount"],
        total_buy_cost=_money(total_buy_cost),
        total_profit=invoice_amounts["total_profit"],
        payment_status=initial_payment_summary["payment_status"],
        payment_mode=initial_payment_summary["payment_mode"],
        invoice_status=payload.invoice_status,
        finalized_at=_utcnow_naive() if payload.invoice_status == FINALIZED_INVOICE_STATUS else None,
        notes=payload.notes,
        created_by=current_user.id,
    )

    db.add(invoice)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        if _is_invoice_number_integrity_error(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invoice number conflict. Please retry creating the invoice.",
            ) from exc
        raise

    for index, payment_entry in enumerate(initial_payment_entries, start=1):
        payment_client_source = client_request_id[:70] if client_request_id else f"{invoice.id}-initial"
        payment_client_request_id = f"invoice-{payment_client_source}-{index}"
        payment_fingerprint = hashlib.sha256(
            json.dumps(
                _canonicalize_for_fingerprint(
                    {
                        "invoice_id": invoice.id,
                        "amount": payment_entry["amount"],
                        "payment_method": payment_entry["payment_method"],
                        "payment_reference": payment_entry["payment_reference"],
                        "notes": payment_entry["notes"],
                    }
                ),
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()

        payment = _create_payment_row(
            db=db,
            invoice=invoice,
            current_user=current_user,
            amount=payment_entry["amount"],
            payment_method=payment_entry["payment_method"],
            payment_reference=payment_entry["payment_reference"],
            notes=payment_entry["notes"],
            received_at=payment_entry["received_at"],
            client_request_id=payment_client_request_id,
            request_fingerprint=payment_fingerprint,
        )
        record_business_audit(
            db,
            shop_id=current_user.shop_id,
            actor=current_user,
            action=BusinessAuditAction.PAYMENT_RECEIVED,
            entity_type="invoice_payment",
            entity_id=payment.id,
            summary=f"Payment received for invoice {invoice.invoice_number}",
            after_data=_payment_audit_snapshot(payment, invoice),
        )

    for prepared in prepared_items:
        product = prepared["product"]

        invoice_item = InvoiceItem(
            shop_id=current_user.shop_id,
            invoice_id=invoice.id,
            product_id=product.id,
            product_code=prepared["product_code"],
            product_name_snapshot=prepared["product_name_snapshot"],
            category_snapshot=prepared["category_snapshot"],
            unit_snapshot=prepared["unit_snapshot"],
            mrp=prepared["mrp"],
            buy_price=prepared["buy_price"],
            quantity=prepared["quantity"],
            discount_percentage=prepared["discount_percentage"],
            discount_amount_per_unit=prepared["discount_amount_per_unit"],
            total_discount_amount=prepared["total_discount_amount"],
            selling_price_per_unit=prepared["selling_price_per_unit"],
            total_selling_price=prepared["total_selling_price"],
            hsn_sac_snapshot=prepared["hsn_sac_snapshot"],
            gst_rate=prepared["gst_rate"],
            taxable_value=prepared["taxable_value"],
            cgst_rate=prepared["cgst_rate"],
            cgst_amount=prepared["cgst_amount"],
            sgst_rate=prepared["sgst_rate"],
            sgst_amount=prepared["sgst_amount"],
            igst_rate=prepared["igst_rate"],
            igst_amount=prepared["igst_amount"],
            total_tax_amount=prepared["total_tax_amount"],
            total_buy_cost=prepared["total_buy_cost"],
            profit_per_unit=prepared["profit_per_unit"],
            total_profit=prepared["total_profit"],
        )

        db.add(invoice_item)

        analytics = ProductSalesAnalytics(
            shop_id=current_user.shop_id,
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            invoice_date=invoice.invoice_date,
            customer_id=customer.id,
            customer_name=customer.full_name,
            customer_phone=customer.phone,
            product_id=product.id,
            product_code=prepared["product_code"],
            product_name=prepared["product_name_snapshot"],
            category=prepared["category_snapshot"],
            buy_price=prepared["buy_price"],
            mrp=prepared["mrp"],
            discount_percentage=prepared["discount_percentage"],
            discount_amount=prepared["total_discount_amount"],
            selling_price_per_unit=prepared["selling_price_per_unit"],
            quantity=prepared["quantity"],
            total_selling_price=prepared["total_selling_price"],
            total_buy_cost=prepared["total_buy_cost"],
            total_profit=prepared["total_profit"],
                payment_status=invoice.payment_status,
        )

        db.add(analytics)

    stock_movement_type = (
        StockMovementType.DRAFT_RESERVE
        if payload.invoice_status == EDITABLE_INVOICE_STATUS
        else StockMovementType.SALE
    )
    for product_id, requested_quantity in requested_by_product.items():
        product = products_by_id[product_id]
        quantity = _stock_quantity_int(requested_quantity)
        movement_label = "draft-reserve" if stock_movement_type == StockMovementType.DRAFT_RESERVE else "sale"
        apply_stock_movement(
            db,
            product=product,
            shop_id=current_user.shop_id,
            quantity_delta=-quantity,
            movement_type=stock_movement_type,
            reference_type="invoice",
            reference_id=invoice.id,
            reason=(
                "Inventory reserved for draft invoice"
                if stock_movement_type == StockMovementType.DRAFT_RESERVE
                else "Finalized invoice sale"
            ),
            client_request_id=f"{movement_label}-invoice-{invoice.id}-product-{product_id}",
            actor=current_user,
        )

    customer.total_orders = int(customer.total_orders or 0) + 1
    customer.total_spent = _money(
        _to_decimal(customer.total_spent) + invoice_amounts["final_amount"]
    )

    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.INVOICE_CREATED,
        entity_type="invoice",
        entity_id=invoice.id,
        summary=f"Invoice {invoice.invoice_number} created",
        after_data=_invoice_audit_snapshot(invoice, item_count=len(prepared_items)),
    )

    if idempotency_record is not None:
        idempotency_record.invoice_id = invoice.id
        idempotency_record.status = "succeeded"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(invoice)

    return get_invoice(invoice.id, db, current_user)


# def update_invoice(
#     invoice_id: int,
#     payload: InvoiceUpdate,
#     db: Session,
#     current_user: User,
# ):
#     invoice = get_invoice(invoice_id, db, current_user)

#     data = payload.model_dump(exclude_unset=True)

#     if "paid_amount" in data and data["paid_amount"] is not None:
#         invoice.paid_amount = _money(data["paid_amount"])
#         invoice.remaining_amount, calculated_status = _calculate_payment_status(
#             invoice.final_amount,
#             invoice.paid_amount,
#         )

#         if "payment_status" not in data or data.get("payment_status") is None:
#             invoice.payment_status = calculated_status

#     if "payment_status" in data and data["payment_status"] is not None:
#         invoice.payment_status = data["payment_status"]

#     if "payment_mode" in data:
#         invoice.payment_mode = data["payment_mode"]

#     if "invoice_status" in data and data["invoice_status"] is not None:
#         invoice.invoice_status = data["invoice_status"]

#     if "notes" in data:
#         invoice.notes = data["notes"]

#     for analytics in invoice.sales_analytics:
#         analytics.payment_status = invoice.payment_status

#     db.commit()
#     db.refresh(invoice)

#     return get_invoice(invoice.id, db, current_user)


def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session,
    current_user: User,
):
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.items), selectinload(Invoice.sales_analytics))
        .filter(
            Invoice.id == invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )

    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    data = payload.model_dump(exclude_unset=True)
    before_audit = _invoice_audit_snapshot(invoice)
    shop = _get_shop(db, current_user.shop_id)
    was_draft = invoice.invoice_status == EDITABLE_INVOICE_STATUS

    is_full_edit = bool(
        data.get("customer") is not None
        or data.get("items") is not None
        or data.get("invoice_date") is not None
        or data.get("total_tax_amount") is not None
    )
    is_financial_edit = is_full_edit or (
        "total_payable_amount" in data and data["total_payable_amount"] is not None
    )

    if invoice.invoice_status == CANCELLED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cancelled invoices cannot be edited.",
        )

    if is_financial_edit:
        _ensure_invoice_full_editable(invoice)

    requested_lifecycle_status = data.get("invoice_status")
    if requested_lifecycle_status is not None and requested_lifecycle_status != invoice.invoice_status:
        if requested_lifecycle_status == CANCELLED_INVOICE_STATUS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Use the invoice cancellation endpoint to cancel an invoice.",
            )
        if invoice.invoice_status == FINALIZED_INVOICE_STATUS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Finalized invoices cannot be moved back to draft.",
            )
        if requested_lifecycle_status not in {EDITABLE_INVOICE_STATUS, FINALIZED_INVOICE_STATUS}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unsupported invoice lifecycle transition.",
            )

    direct_payment_fields = {
        field
        for field in ("paid_amount", "payment_status", "payment_mode")
        if field in data and data[field] is not None
    }
    if direct_payment_fields and not is_full_edit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Use the invoice payment endpoint to record or change payments.",
        )

    # ---------------------------------------------------------
    # FULL INVOICE EDIT FLOW
    # ---------------------------------------------------------
    if is_full_edit:
        old_customer_id = invoice.customer_id
        old_final_amount = _money(invoice.final_amount)

        if not data.get("customer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer data is required while editing invoice",
            )

        if not data.get("items"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice must contain at least one item",
            )

        old_items = list(invoice.items)
        old_quantities_by_product: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
        for old_item in old_items:
            if old_item.product_id:
                old_quantities_by_product[old_item.product_id] += _to_decimal(old_item.quantity)

        product_ids_to_lock = list(old_quantities_by_product.keys()) + [
            item.product_id for item in payload.items
        ]
        products_by_id = _lock_products_for_invoice(
            db,
            current_user.shop_id,
            product_ids_to_lock,
        )
        new_quantities_by_product = _aggregate_requested_quantities(
            payload.items,
            products_by_id,
        )
        _validate_available_stock(
            products_by_id=products_by_id,
            requested_by_product=new_quantities_by_product,
            restored_by_product=dict(old_quantities_by_product),
        )

        invoice_date_value = payload.invoice_date or invoice.invoice_date or date.today()

        prepared_items = []
        subtotal_amount = Decimal("0.00")
        item_discount_amount = Decimal("0.00")
        total_buy_cost = Decimal("0.00")
        base_total_profit = Decimal("0.00")

        for item_payload in payload.items:
            product = products_by_id[item_payload.product_id]
            requested_quantity = _to_decimal(item_payload.quantity)

            mrp = _get_product_mrp(product)
            buy_price = _get_product_buying_price(product)

            pricing = _resolve_invoice_item_pricing(
                mrp=mrp,
                buy_price=buy_price,
                requested_quantity=requested_quantity,
                product_name=product.name,
                discount_percentage_input=item_payload.discount_percentage,
                discount_amount_per_unit_input=item_payload.discount_amount_per_unit,
                selling_price_per_unit_input=item_payload.selling_price_per_unit,
            )

            subtotal_amount += _money(mrp * requested_quantity)
            item_discount_amount += pricing["total_discount_amount"]
            total_buy_cost += pricing["total_buy_cost"]
            base_total_profit += pricing["total_profit"]

            prepared_items.append(
                {
                    "product": product,
                    "quantity": requested_quantity,
                    "product_code": item_payload.product_code or _get_product_code(product),
                    "product_name_snapshot": product.name,
                    "category_snapshot": getattr(product, "category", None),
                    "unit_snapshot": getattr(product, "unit", None),
                    "hsn_sac_snapshot": getattr(product, "hsn_sac", None),
                    "gst_rate": _to_decimal(getattr(product, "gst_rate", 0)),
                    "mrp": mrp,
                    "buy_price": buy_price,
                    **pricing,
                }
            )

        tax_result = _calculate_invoice_gst(
            shop=shop,
            customer_payload=payload.customer,
            prepared_items=prepared_items,
            requested_taxable_payable_amount=payload.total_payable_amount,
        )
        _apply_tax_lines(prepared_items, tax_result)
        invoice_amounts = _amounts_from_tax_result(
            item_discount_amount=item_discount_amount,
            base_total_profit=base_total_profit,
            tax_result=tax_result,
        )

        existing_payments = _get_completed_invoice_payments(db, invoice.id)
        existing_paid_amount = _money(
            sum((_to_decimal(payment.amount) for payment in existing_payments), Decimal("0.00"))
        )
        if existing_paid_amount > invoice_amounts["final_amount"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invoice total cannot be reduced below existing recorded payments.",
            )
        payment_summary = _derive_invoice_payment_summary(
            final_amount=invoice_amounts["final_amount"],
            payments=existing_payments,
        )

        target_invoice_status = payload.invoice_status or invoice.invoice_status
        all_stock_product_ids = sorted(
            set(old_quantities_by_product) | set(new_quantities_by_product)
        )
        for product_id in all_stock_product_ids:
            product = products_by_id.get(product_id)
            if not product:
                continue
            old_quantity = old_quantities_by_product.get(product_id, Decimal("0.00"))
            new_quantity = new_quantities_by_product.get(product_id, Decimal("0.00"))
            net_stock_change = new_quantity - old_quantity
            if net_stock_change == Decimal("0.00"):
                continue
            is_reserve = net_stock_change > Decimal("0.00")
            apply_stock_movement(
                db,
                product=product,
                shop_id=current_user.shop_id,
                quantity_delta=-_stock_quantity_int(net_stock_change),
                movement_type=(
                    StockMovementType.DRAFT_RESERVE
                    if is_reserve
                    else StockMovementType.DRAFT_RELEASE
                ),
                reference_type="invoice",
                reference_id=invoice.id,
                reason=(
                    "Draft quantity increased"
                    if is_reserve
                    else "Draft quantity decreased"
                ),
                actor=current_user,
            )

        if was_draft and target_invoice_status == FINALIZED_INVOICE_STATUS:
            _convert_draft_reservation_to_sale(
                db,
                invoice=invoice,
                quantities_by_product=new_quantities_by_product,
                products_by_id=products_by_id,
                current_user=current_user,
            )

        # Remove old child rows only after all stock validation has succeeded.
        db.query(ProductSalesAnalytics).filter(
            ProductSalesAnalytics.invoice_id == invoice.id
        ).delete(synchronize_session=False)

        db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice.id
        ).delete(synchronize_session=False)
        db.flush()

        customer = create_or_update_customer_from_invoice(
            payload.customer,
            db,
            current_user,
        )

        # 4. Update invoice main fields
        invoice.customer_id = customer.id
        invoice.customer_name_snapshot = customer.full_name
        invoice.customer_phone_snapshot = customer.phone
        invoice.customer_email_snapshot = customer.email
        invoice.customer_address_snapshot = customer.address
        invoice.customer_city_snapshot = customer.city
        invoice.customer_state_snapshot = customer.state
        invoice.customer_state_code_snapshot = tax_result.customer_state_code
        invoice.customer_pincode_snapshot = customer.pincode
        invoice.customer_gst_number_snapshot = customer.gst_number
        invoice.seller_gst_number_snapshot = tax_result.seller_gstin
        invoice.seller_state_snapshot = tax_result.seller_state
        invoice.seller_state_code_snapshot = tax_result.seller_state_code
        invoice.tax_treatment = tax_result.tax_treatment

        invoice.invoice_date = invoice_date_value
        invoice.subtotal_amount = _money(subtotal_amount)
        invoice.total_discount_amount = invoice_amounts["total_discount_amount"]
        invoice.total_tax_amount = tax_result.total_tax_amount
        invoice.billed_amount = invoice_amounts["billed_amount"]
        invoice.extra_discount_amount = invoice_amounts["extra_discount_amount"]
        invoice.final_amount = invoice_amounts["final_amount"]

        invoice.paid_amount = payment_summary["paid_amount"]
        invoice.remaining_amount = payment_summary["remaining_amount"]

        invoice.total_buy_cost = _money(total_buy_cost)
        invoice.total_profit = invoice_amounts["total_profit"]

        invoice.payment_status = payment_summary["payment_status"]
        invoice.payment_mode = payment_summary["payment_mode"]
        invoice.invoice_status = target_invoice_status
        if invoice.invoice_status == FINALIZED_INVOICE_STATUS and invoice.finalized_at is None:
            invoice.finalized_at = _utcnow_naive()
        invoice.notes = payload.notes

        # 5. Insert rebuilt invoice items + analytics. Stock is adjusted once below by net change.
        for prepared in prepared_items:
            item = InvoiceItem(
                shop_id=current_user.shop_id,
                invoice_id=invoice.id,
                product_id=prepared["product"].id,
                product_code=prepared["product_code"],
                product_name_snapshot=prepared["product_name_snapshot"],
                category_snapshot=prepared["category_snapshot"],
                unit_snapshot=prepared["unit_snapshot"],
                mrp=prepared["mrp"],
                buy_price=prepared["buy_price"],
                quantity=prepared["quantity"],
                discount_percentage=prepared["discount_percentage"],
                discount_amount_per_unit=prepared["discount_amount_per_unit"],
                total_discount_amount=prepared["total_discount_amount"],
                selling_price_per_unit=prepared["selling_price_per_unit"],
                total_selling_price=prepared["total_selling_price"],
                hsn_sac_snapshot=prepared["hsn_sac_snapshot"],
                gst_rate=prepared["gst_rate"],
                taxable_value=prepared["taxable_value"],
                cgst_rate=prepared["cgst_rate"],
                cgst_amount=prepared["cgst_amount"],
                sgst_rate=prepared["sgst_rate"],
                sgst_amount=prepared["sgst_amount"],
                igst_rate=prepared["igst_rate"],
                igst_amount=prepared["igst_amount"],
                total_tax_amount=prepared["total_tax_amount"],
                total_buy_cost=prepared["total_buy_cost"],
                profit_per_unit=prepared["profit_per_unit"],
                total_profit=prepared["total_profit"],
            )
            db.add(item)

            analytics = ProductSalesAnalytics(
                shop_id=current_user.shop_id,
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                invoice_date=invoice.invoice_date,
                customer_id=customer.id,
                customer_name=customer.full_name,
                customer_phone=customer.phone,
                product_code=prepared["product_code"],
                product_id=prepared["product"].id,
                product_name=prepared["product_name_snapshot"],
                category=prepared["category_snapshot"],
                buy_price=prepared["buy_price"],
                mrp=prepared["mrp"],
                discount_percentage=prepared["discount_percentage"],
                discount_amount=prepared["total_discount_amount"],
                selling_price_per_unit=prepared["selling_price_per_unit"],
                quantity=prepared["quantity"],
                total_selling_price=prepared["total_selling_price"],
                total_buy_cost=prepared["total_buy_cost"],
                total_profit=prepared["total_profit"],
                payment_status=invoice.payment_status,
            )
            db.add(analytics)

        _adjust_customer_totals_after_invoice_edit(
            db=db,
            shop_id=current_user.shop_id,
            old_customer_id=old_customer_id,
            new_customer_id=customer.id,
            old_final_amount=old_final_amount,
            new_final_amount=invoice_amounts["final_amount"],
        )

        after_audit = _invoice_audit_snapshot(invoice, item_count=len(prepared_items))
        if before_audit != after_audit:
            record_business_audit(
                db,
                shop_id=current_user.shop_id,
                actor=current_user,
                action=BusinessAuditAction.INVOICE_UPDATED,
                entity_type="invoice",
                entity_id=invoice.id,
                summary=f"Invoice {invoice.invoice_number} updated",
                before_data=before_audit,
                after_data=after_audit,
            )

        db.commit()
        db.refresh(invoice)

        return get_invoice(invoice.id, db, current_user)

    # ---------------------------------------------------------
    # SIMPLE STATUS / PAYMENT UPDATE FLOW
    # ---------------------------------------------------------
    if "total_payable_amount" in data and data["total_payable_amount"] is not None:
        old_final_amount = _money(invoice.final_amount)
        base_item_discount_amount = _money(
            _to_decimal(invoice.total_discount_amount) - _to_decimal(invoice.extra_discount_amount)
        )
        base_item_profit = _money(
            sum((_to_decimal(item.total_profit) for item in invoice.items), Decimal("0.00"))
        )
        tax_result = calculate_gst_invoice(
            gst_enabled=bool(invoice.seller_gst_number_snapshot and invoice.tax_treatment != "non_gst"),
            seller_gstin=invoice.seller_gst_number_snapshot,
            seller_state=invoice.seller_state_snapshot,
            seller_state_code=invoice.seller_state_code_snapshot,
            customer_gstin=invoice.customer_gst_number_snapshot,
            customer_state=invoice.customer_state_snapshot,
            customer_state_code=invoice.customer_state_code_snapshot,
            lines=[
                GstLineInput(
                    taxable_before_invoice_discount=item.total_selling_price,
                    gst_rate=item.gst_rate,
                )
                for item in invoice.items
            ],
            requested_taxable_payable_amount=data["total_payable_amount"],
        )
        invoice.billed_amount = _money(tax_result.final_amount + tax_result.extra_discount_amount)
        invoice.extra_discount_amount = tax_result.extra_discount_amount
        invoice.total_discount_amount = _money(base_item_discount_amount + tax_result.extra_discount_amount)
        invoice.total_tax_amount = tax_result.total_tax_amount
        invoice.final_amount = tax_result.final_amount
        invoice.total_profit = _money(base_item_profit - tax_result.extra_discount_amount)
        payment_summary = _sync_invoice_payment_summary(db, invoice)
        if payment_summary["paid_amount"] > invoice.final_amount:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invoice total cannot be reduced below existing recorded payments.",
            )

        for item, tax_line in zip(invoice.items, tax_result.lines):
            item.taxable_value = tax_line.taxable_value
            item.gst_rate = tax_line.gst_rate
            item.cgst_rate = tax_line.cgst_rate
            item.cgst_amount = tax_line.cgst_amount
            item.sgst_rate = tax_line.sgst_rate
            item.sgst_amount = tax_line.sgst_amount
            item.igst_rate = tax_line.igst_rate
            item.igst_amount = tax_line.igst_amount
            item.total_tax_amount = tax_line.total_tax_amount

        customer = None
        if invoice.customer_id:
            customer = (
                db.query(Customer)
                .filter(
                    Customer.id == invoice.customer_id,
                    Customer.shop_id == current_user.shop_id,
                )
                .first()
            )

        if customer:
            customer.total_spent = _money(
                _to_decimal(customer.total_spent) - old_final_amount + invoice.final_amount
            )

    if "paid_amount" in data and data["paid_amount"] is not None:
        invoice.paid_amount = _normalize_paid_amount(invoice.final_amount, data["paid_amount"])
        invoice.remaining_amount, calculated_status = _calculate_payment_status(
            invoice.final_amount,
            invoice.paid_amount,
        )

        if "payment_status" not in data or data.get("payment_status") is None:
            invoice.payment_status = calculated_status

    if "payment_status" in data and data["payment_status"] is not None:
        invoice.payment_status = data["payment_status"]

    if "payment_mode" in data:
        invoice.payment_mode = data["payment_mode"]

    if "invoice_status" in data and data["invoice_status"] is not None:
        if was_draft and data["invoice_status"] == FINALIZED_INVOICE_STATUS:
            quantities_by_product: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
            for item in invoice.items:
                if item.product_id:
                    quantities_by_product[int(item.product_id)] += _to_decimal(item.quantity)
            products_by_id = _lock_products_for_invoice(
                db,
                current_user.shop_id,
                list(quantities_by_product),
            )
            _convert_draft_reservation_to_sale(
                db,
                invoice=invoice,
                quantities_by_product=dict(quantities_by_product),
                products_by_id=products_by_id,
                current_user=current_user,
            )
        invoice.invoice_status = data["invoice_status"]
        if invoice.invoice_status == FINALIZED_INVOICE_STATUS and invoice.finalized_at is None:
            invoice.finalized_at = _utcnow_naive()

    if "notes" in data:
        invoice.notes = data["notes"]

    if "total_payable_amount" in data and data["total_payable_amount"] is not None and "paid_amount" not in data:
        invoice.remaining_amount, calculated_status = _calculate_payment_status(
            invoice.final_amount,
            invoice.paid_amount,
        )

        if "payment_status" not in data or data.get("payment_status") is None:
            invoice.payment_status = calculated_status

    for analytics in invoice.sales_analytics:
        analytics.payment_status = invoice.payment_status
        analytics.invoice_date = invoice.invoice_date

    after_audit = _invoice_audit_snapshot(invoice)
    if before_audit != after_audit:
        record_business_audit(
            db,
            shop_id=current_user.shop_id,
            actor=current_user,
            action=BusinessAuditAction.INVOICE_UPDATED,
            entity_type="invoice",
            entity_id=invoice.id,
            summary=f"Invoice {invoice.invoice_number} updated",
            before_data=before_audit,
            after_data=after_audit,
        )

    db.commit()
    db.refresh(invoice)

    return get_invoice(invoice.id, db, current_user)



def _lock_return_products(
    db: Session,
    *,
    shop_id: int,
    product_ids: set[int],
) -> dict[int, Product]:
    if not product_ids:
        return {}

    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.id.in_(sorted(product_ids)))
        .order_by(Product.id.asc())
        .with_for_update()
        .all()
    )
    return {product.id: product for product in products}


def _normalize_return_items(payload: InvoiceReturnCreate) -> dict[int, dict]:
    normalized: dict[int, dict] = {}
    for item in payload.items:
        item_id = int(item.invoice_item_id)
        quantity = _to_decimal(item.quantity)
        restocked_quantity = _to_decimal(item.restocked_quantity)
        non_restocked_quantity = quantity - restocked_quantity
        existing = normalized.get(item_id)
        if existing and (
            existing["disposition"] != item.disposition
            or existing["disposition_notes"] != item.disposition_notes
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate return lines must use the same disposition and notes.",
            )
        if not existing:
            existing = {
                "quantity": Decimal("0.00"),
                "restocked_quantity": Decimal("0.00"),
                "non_restocked_quantity": Decimal("0.00"),
                "disposition": item.disposition,
                "disposition_notes": item.disposition_notes,
            }
            normalized[item_id] = existing
        existing["quantity"] += quantity
        existing["restocked_quantity"] += restocked_quantity
        existing["non_restocked_quantity"] += non_restocked_quantity
    return normalized


def _calculate_return_item_amounts(invoice_item: InvoiceItem, quantity: Decimal) -> dict:
    original_quantity = _to_decimal(invoice_item.quantity)
    if original_quantity <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Original invoice item quantity is invalid.",
        )

    ratio = quantity / original_quantity
    taxable_value = _money(_to_decimal(invoice_item.taxable_value) * ratio)
    cgst_amount = _money(_to_decimal(invoice_item.cgst_amount) * ratio)
    sgst_amount = _money(_to_decimal(invoice_item.sgst_amount) * ratio)
    igst_amount = _money(_to_decimal(invoice_item.igst_amount) * ratio)
    total_tax_amount = _money(cgst_amount + sgst_amount + igst_amount)
    total_amount = _money(taxable_value + total_tax_amount)
    subtotal_amount = _money(_to_decimal(invoice_item.total_selling_price) * ratio)
    total_buy_cost = _money(_to_decimal(invoice_item.total_buy_cost) * ratio)
    total_profit = _money(_to_decimal(invoice_item.total_profit) * ratio)

    return {
        "subtotal_amount": subtotal_amount,
        "taxable_value": taxable_value,
        "cgst_amount": cgst_amount,
        "sgst_amount": sgst_amount,
        "igst_amount": igst_amount,
        "total_tax_amount": total_tax_amount,
        "total_amount": total_amount,
        "total_buy_cost": total_buy_cost,
        "total_profit": total_profit,
        "unit_taxable_value": _money(taxable_value / quantity) if quantity else Decimal("0.00"),
    }


def _build_full_return_payload(invoice: Invoice, *, reason: str, notes: str | None, client_request_id: str) -> InvoiceReturnCreate:
    remaining = _remaining_returnable_by_item(invoice._sa_instance_state.session, invoice)
    items = [
        {
            "invoice_item_id": item.id,
            "quantity": remaining.get(item.id, Decimal("0.00")),
            "restocked_quantity": remaining.get(item.id, Decimal("0.00")),
            "disposition": "restock",
        }
        for item in invoice.items
        if remaining.get(item.id, Decimal("0.00")) > Decimal("0.00")
    ]
    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice has no remaining returnable quantity.",
        )
    return InvoiceReturnCreate.model_validate(
        {
            "client_request_id": client_request_id,
            "reason": reason,
            "notes": notes,
            "items": items,
        }
    )


def list_invoice_returns(invoice_id: int, db: Session, current_user: User):
    invoice = get_invoice(invoice_id, db, current_user)
    return (
        db.query(InvoiceReturn)
        .filter(
            InvoiceReturn.invoice_id == invoice.id,
            InvoiceReturn.shop_id == current_user.shop_id,
        )
        .options(selectinload(InvoiceReturn.items), selectinload(InvoiceReturn.refunds))
        .order_by(InvoiceReturn.created_at.asc(), InvoiceReturn.id.asc())
        .all()
    )


def create_invoice_return(
    invoice_id: int,
    payload: InvoiceReturnCreate,
    db: Session,
    current_user: User,
    *,
    commit: bool = True,
):
    invoice = (
        db.query(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.sales_analytics),
        )
        .filter(
            Invoice.id == invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )
    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    client_request_id = _normalize_client_request_id(payload.client_request_id)
    request_fingerprint = _return_request_fingerprint(invoice.id, payload)

    existing_return = (
        db.query(InvoiceReturn)
        .filter(
            InvoiceReturn.shop_id == current_user.shop_id,
            InvoiceReturn.client_request_id == client_request_id,
        )
        .options(selectinload(InvoiceReturn.items), selectinload(InvoiceReturn.refunds))
        .first()
    )
    if existing_return:
        if existing_return.request_fingerprint != request_fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This return request key was already used with different return data.",
            )
        return existing_return

    if invoice.invoice_status == CANCELLED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Returns cannot be created for an already cancelled invoice.",
        )
    if invoice.invoice_status != FINALIZED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only finalized invoices can be returned.",
        )

    requested_by_item = _normalize_return_items(payload)
    invoice_items_by_id = {item.id: item for item in invoice.items}
    remaining_by_item = _remaining_returnable_by_item(db, invoice)

    for item_id, requested in requested_by_item.items():
        requested_quantity = requested["quantity"]
        invoice_item = invoice_items_by_id.get(item_id)
        if not invoice_item or invoice_item.shop_id != current_user.shop_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice item not found")
        if requested_quantity <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return quantity must be greater than zero")
        remaining_quantity = remaining_by_item.get(item_id, Decimal("0.00"))
        if requested_quantity > remaining_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Return quantity exceeds remaining quantity for {invoice_item.product_name_snapshot}. "
                    f"Remaining returnable: {remaining_quantity}."
                ),
            )

    product_ids: set[int] = set()
    for item_id, requested in requested_by_item.items():
        if requested["restocked_quantity"] <= Decimal("0.00"):
            continue
        product_id = invoice_items_by_id[item_id].product_id
        if not product_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This returned item is no longer linked to a product and cannot be restocked.",
            )
        product_ids.add(int(product_id))
    products_by_id = _lock_return_products(db, shop_id=current_user.shop_id, product_ids=product_ids)

    totals = defaultdict(lambda: Decimal("0.00"))
    return_date = date.today()
    return_record = InvoiceReturn(
        shop_id=current_user.shop_id,
        invoice_id=invoice.id,
        return_number=_generate_return_number(db, current_user.shop_id, return_date),
        credit_note_number=_generate_credit_note_number(db, current_user.shop_id, return_date),
        status=COMPLETED_RETURN_STATUS,
        reason=payload.reason,
        notes=payload.notes,
        subtotal_amount=Decimal("0.00"),
        taxable_amount=Decimal("0.00"),
        cgst_amount=Decimal("0.00"),
        sgst_amount=Decimal("0.00"),
        igst_amount=Decimal("0.00"),
        total_tax_amount=Decimal("0.00"),
        total_amount=Decimal("0.00"),
        total_buy_cost=Decimal("0.00"),
        total_profit=Decimal("0.00"),
        applied_to_outstanding_amount=Decimal("0.00"),
        refundable_amount=Decimal("0.00"),
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
        created_by=current_user.id,
        completed_at=_utcnow_naive(),
    )
    db.add(return_record)
    db.flush()

    for item_id, requested in requested_by_item.items():
        requested_quantity = requested["quantity"]
        restocked_quantity = requested["restocked_quantity"]
        invoice_item = invoice_items_by_id[item_id]
        amounts = _calculate_return_item_amounts(invoice_item, requested_quantity)
        totals["subtotal_amount"] += amounts["subtotal_amount"]
        totals["taxable_amount"] += amounts["taxable_value"]
        totals["cgst_amount"] += amounts["cgst_amount"]
        totals["sgst_amount"] += amounts["sgst_amount"]
        totals["igst_amount"] += amounts["igst_amount"]
        totals["total_tax_amount"] += amounts["total_tax_amount"]
        totals["total_amount"] += amounts["total_amount"]
        totals["total_buy_cost"] += amounts["total_buy_cost"]
        totals["total_profit"] += amounts["total_profit"]

        return_item = InvoiceReturnItem(
            shop_id=current_user.shop_id,
            return_id=return_record.id,
            invoice_item_id=invoice_item.id,
            product_id=invoice_item.product_id,
            product_code=invoice_item.product_code,
            product_name_snapshot=invoice_item.product_name_snapshot,
            hsn_sac_snapshot=invoice_item.hsn_sac_snapshot,
            quantity=requested_quantity,
            restocked_quantity=_stock_quantity_int(restocked_quantity),
            non_restocked_quantity=_stock_quantity_int(requested["non_restocked_quantity"]),
            disposition=requested["disposition"],
            disposition_notes=requested["disposition_notes"],
            unit_taxable_value=amounts["unit_taxable_value"],
            gst_rate=invoice_item.gst_rate,
            cgst_rate=invoice_item.cgst_rate,
            sgst_rate=invoice_item.sgst_rate,
            igst_rate=invoice_item.igst_rate,
            taxable_value=amounts["taxable_value"],
            cgst_amount=amounts["cgst_amount"],
            sgst_amount=amounts["sgst_amount"],
            igst_amount=amounts["igst_amount"],
            total_tax_amount=amounts["total_tax_amount"],
            total_amount=amounts["total_amount"],
            total_buy_cost=amounts["total_buy_cost"],
            total_profit=amounts["total_profit"],
        )
        db.add(return_item)
        db.flush()

        if restocked_quantity > Decimal("0.00") and invoice_item.product_id:
            product = products_by_id.get(int(invoice_item.product_id))
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The product is unavailable and cannot be restocked.",
                )
            _validate_stock_quantity(product, restocked_quantity)
            apply_stock_movement(
                db,
                product=product,
                shop_id=current_user.shop_id,
                quantity_delta=_stock_quantity_int(restocked_quantity),
                movement_type=StockMovementType.SALE_RETURN,
                reference_type="invoice_return",
                reference_id=return_record.id,
                reference_line_id=return_item.id,
                reason=requested["disposition"],
                notes=requested["disposition_notes"],
                client_request_id=f"sale-return-{return_record.id}-item-{return_item.id}",
                actor=current_user,
            )

    return_record.subtotal_amount = _money(totals["subtotal_amount"])
    return_record.taxable_amount = _money(totals["taxable_amount"])
    return_record.cgst_amount = _money(totals["cgst_amount"])
    return_record.sgst_amount = _money(totals["sgst_amount"])
    return_record.igst_amount = _money(totals["igst_amount"])
    return_record.total_tax_amount = _money(totals["total_tax_amount"])
    return_record.total_amount = _money(totals["total_amount"])
    return_record.total_buy_cost = _money(totals["total_buy_cost"])
    return_record.total_profit = _money(totals["total_profit"])

    outstanding_before = _net_invoice_outstanding(db, invoice)
    return_record.applied_to_outstanding_amount = _money(min(return_record.total_amount, outstanding_before))
    return_record.refundable_amount = _money(return_record.total_amount - return_record.applied_to_outstanding_amount)
    _sync_invoice_outstanding_cache(
        invoice,
        outstanding_before - return_record.applied_to_outstanding_amount,
    )

    if invoice.customer_id:
        customer = (
            db.query(Customer)
            .filter(Customer.id == invoice.customer_id, Customer.shop_id == current_user.shop_id)
            .with_for_update()
            .first()
        )
        if customer:
            customer.total_spent = _money(_to_decimal(customer.total_spent) - return_record.total_amount)
            if customer.total_spent < Decimal("0.00"):
                customer.total_spent = Decimal("0.00")

    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.RETURN_CREATED,
        entity_type="invoice_return",
        entity_id=return_record.id,
        summary=f"Return {return_record.return_number} created for invoice {invoice.invoice_number}",
        after_data=_return_audit_snapshot(return_record),
    )
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.CREDIT_NOTE_CREATED,
        entity_type="invoice_return",
        entity_id=return_record.id,
        summary=f"Credit note {return_record.credit_note_number} created",
        after_data=_return_audit_snapshot(return_record),
    )

    if not commit:
        db.flush()
        return return_record

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing_return = (
            db.query(InvoiceReturn)
            .filter(
                InvoiceReturn.shop_id == current_user.shop_id,
                InvoiceReturn.client_request_id == client_request_id,
            )
            .options(selectinload(InvoiceReturn.items), selectinload(InvoiceReturn.refunds))
            .first()
        )
        if existing_return and existing_return.request_fingerprint == request_fingerprint:
            return existing_return
        raise exc

    return (
        db.query(InvoiceReturn)
        .filter(InvoiceReturn.id == return_record.id)
        .options(selectinload(InvoiceReturn.items), selectinload(InvoiceReturn.refunds))
        .one()
    )


def add_return_refund(
    return_id: int,
    payload: InvoiceRefundCreate,
    db: Session,
    current_user: User,
):
    return_record = (
        db.query(InvoiceReturn)
        .options(selectinload(InvoiceReturn.refunds))
        .filter(
            InvoiceReturn.id == return_id,
            InvoiceReturn.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )
    if not return_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return not found")

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == return_record.invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )
    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    client_request_id = _normalize_client_request_id(payload.client_request_id)
    request_fingerprint = _refund_request_fingerprint(return_record.id, payload)

    existing_refund = (
        db.query(InvoiceRefund)
        .filter(
            InvoiceRefund.shop_id == current_user.shop_id,
            InvoiceRefund.return_id == return_record.id,
            InvoiceRefund.client_request_id == client_request_id,
        )
        .first()
    )
    if existing_refund:
        if existing_refund.request_fingerprint != request_fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This refund request key was already used with different refund data.",
            )
        return existing_refund

    refunded_so_far = _money(
        sum((_to_decimal(refund.amount) for refund in _get_completed_return_refunds(db, return_record.id)), Decimal("0.00"))
    )
    remaining_refundable = _money(_to_decimal(return_record.refundable_amount) - refunded_so_far)
    refund_amount = _money(payload.amount)
    if refund_amount > remaining_refundable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Refund amount exceeds remaining refundable amount. Remaining: {remaining_refundable}.",
        )

    refund = InvoiceRefund(
        shop_id=current_user.shop_id,
        invoice_id=return_record.invoice_id,
        return_id=return_record.id,
        amount=refund_amount,
        refund_method=_normalize_payment_method(payload.refund_method),
        reference=payload.reference,
        notes=payload.notes,
        status=COMPLETED_REFUND_STATUS,
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
        refunded_at=payload.refunded_at or _utcnow_naive(),
        created_by=current_user.id,
    )
    db.add(refund)
    db.flush()

    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.REFUND_ISSUED,
        entity_type="invoice_refund",
        entity_id=refund.id,
        summary=f"Refund issued for return {return_record.return_number}",
        after_data=_refund_audit_snapshot(refund),
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing_refund = (
            db.query(InvoiceRefund)
            .filter(
                InvoiceRefund.shop_id == current_user.shop_id,
                InvoiceRefund.return_id == return_record.id,
                InvoiceRefund.client_request_id == client_request_id,
            )
            .first()
        )
        if existing_refund and existing_refund.request_fingerprint == request_fingerprint:
            return existing_refund
        raise exc

    db.refresh(refund)
    return refund


def cancel_invoice(
    invoice_id: int,
    payload: InvoiceCancelPayload,
    db: Session,
    current_user: User,
):
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.items), selectinload(Invoice.sales_analytics))
        .filter(
            Invoice.id == invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )
    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    if invoice.invoice_status == CANCELLED_INVOICE_STATUS:
        return {"message": "Invoice already cancelled"}

    before_audit = _invoice_audit_snapshot(invoice)

    if invoice.invoice_status == FINALIZED_INVOICE_STATUS:
        client_request_id = payload.client_request_id or f"cancel-invoice-{invoice.id}"
        return_payload = _build_full_return_payload(
            invoice,
            reason=payload.reason,
            notes=payload.notes,
            client_request_id=client_request_id,
        )
        create_invoice_return(invoice.id, return_payload, db, current_user, commit=False)
        invoice = (
            db.query(Invoice)
            .options(selectinload(Invoice.sales_analytics))
            .filter(Invoice.id == invoice_id, Invoice.shop_id == current_user.shop_id)
            .with_for_update()
            .first()
        )
    elif invoice.invoice_status == EDITABLE_INVOICE_STATUS:
        reserved_by_product: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
        for item in invoice.items:
            if item.product_id:
                reserved_by_product[int(item.product_id)] += _to_decimal(item.quantity)

        products_by_id = _lock_products_for_invoice(
            db,
            current_user.shop_id,
            list(reserved_by_product),
        )
        for product_id in sorted(reserved_by_product):
            quantity = _stock_quantity_int(reserved_by_product[product_id])
            if quantity <= 0:
                continue
            apply_stock_movement(
                db,
                product=products_by_id[product_id],
                shop_id=current_user.shop_id,
                quantity_delta=quantity,
                movement_type=StockMovementType.DRAFT_RELEASE,
                reference_type="invoice",
                reference_id=invoice.id,
                reason=payload.reason or "Draft invoice cancelled",
                notes=payload.notes,
                client_request_id=f"draft-cancel-release-invoice-{invoice.id}-product-{product_id}",
                actor=current_user,
            )

    invoice.invoice_status = CANCELLED_INVOICE_STATUS
    for analytics in invoice.sales_analytics:
        analytics.payment_status = invoice.payment_status

    after_audit = _invoice_audit_snapshot(invoice)
    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.INVOICE_CANCELLED,
        entity_type="invoice",
        entity_id=invoice.id,
        summary=f"Invoice {invoice.invoice_number} cancelled",
        before_data=before_audit,
        after_data=after_audit,
    )

    db.commit()
    return {"message": "Invoice cancelled successfully"}


def delete_invoice(invoice_id: int, db: Session, current_user: User):
    """
    Soft delete/cancel invoice instead of hard deleting financial record.
    This keeps historical records safer.
    """

    payload = InvoiceCancelPayload.model_validate(
        {
            "client_request_id": f"cancel-invoice-{invoice_id}",
            "reason": "Invoice cancellation",
        }
    )
    return cancel_invoice(invoice_id, payload, db, current_user)


def list_invoice_payments(invoice_id: int, db: Session, current_user: User):
    invoice = get_invoice(invoice_id, db, current_user)

    return (
        db.query(InvoicePayment)
        .filter(
            InvoicePayment.invoice_id == invoice.id,
            InvoicePayment.shop_id == current_user.shop_id,
        )
        .order_by(InvoicePayment.received_at.asc(), InvoicePayment.id.asc())
        .all()
    )


def add_invoice_payment(
    invoice_id: int,
    payload: InvoicePaymentCreate,
    db: Session,
    current_user: User,
):
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.sales_analytics))
        .filter(
            Invoice.id == invoice_id,
            Invoice.shop_id == current_user.shop_id,
        )
        .with_for_update()
        .first()
    )
    _ensure_invoice_belongs_to_shop(invoice, current_user.shop_id)

    request_fingerprint = _payment_request_fingerprint(invoice.id, payload)
    client_request_id = _normalize_client_request_id(payload.client_request_id)

    existing_payment = (
        db.query(InvoicePayment)
        .filter(
            InvoicePayment.shop_id == current_user.shop_id,
            InvoicePayment.invoice_id == invoice.id,
            InvoicePayment.client_request_id == client_request_id,
        )
        .first()
    )
    if existing_payment:
        if existing_payment.request_fingerprint != request_fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This payment request key was already used with different payment data.",
            )
        return existing_payment

    if invoice.invoice_status == CANCELLED_INVOICE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payments cannot be recorded against a cancelled invoice.",
        )

    current_payments = _get_completed_invoice_payments(db, invoice.id)
    current_paid_amount = _money(
        sum((_to_decimal(payment.amount) for payment in current_payments), Decimal("0.00"))
    )
    invoice.paid_amount = current_paid_amount
    remaining_amount = _net_invoice_outstanding(db, invoice)

    payment_amount = _money(payload.amount)
    if payment_amount > remaining_amount:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment amount exceeds remaining balance. Remaining: {remaining_amount}.",
        )

    payment = _create_payment_row(
        db=db,
        invoice=invoice,
        current_user=current_user,
        amount=payment_amount,
        payment_method=payload.payment_method,
        payment_reference=payload.payment_reference,
        notes=payload.notes,
        received_at=payload.received_at,
        client_request_id=client_request_id,
        request_fingerprint=request_fingerprint,
    )
    _sync_invoice_payment_summary(db, invoice)

    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PAYMENT_RECEIVED,
        entity_type="invoice_payment",
        entity_id=payment.id,
        summary=f"Payment received for invoice {invoice.invoice_number}",
        after_data=_payment_audit_snapshot(payment, invoice),
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing_payment = (
            db.query(InvoicePayment)
            .filter(
                InvoicePayment.shop_id == current_user.shop_id,
                InvoicePayment.invoice_id == invoice_id,
                InvoicePayment.client_request_id == client_request_id,
            )
            .first()
        )
        if existing_payment and existing_payment.request_fingerprint == request_fingerprint:
            return existing_payment
        raise exc

    db.refresh(payment)
    return payment


def build_invoice_share_url(invoice_id: int, db: Session, current_user: User):
    invoice = get_invoice(invoice_id, db, current_user)

    phone = invoice.customer_phone_snapshot or ""
    clean_phone = "".join(ch for ch in phone if ch.isdigit())

    if not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer phone number is not available for this invoice",
        )

    message = (
        f"Hello {invoice.customer_name_snapshot}, "
        f"your invoice {invoice.invoice_number} amount is ₹{invoice.final_amount}. "
        f"Thank you."
    )

    whatsapp_url = f"https://wa.me/{clean_phone}?text={message.replace(' ', '%20')}"

    return {
        "message": "Share link generated successfully",
        "whatsapp_url": whatsapp_url,
    }
