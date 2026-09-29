from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.invoice_sequence import InvoiceSequence
from app.models.product import Product
from app.models.product_sales_analytics import ProductSalesAnalytics
from app.models.user import User
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.models.business_audit_log import BusinessAuditAction
from app.services.business_audit_service import record_business_audit
from app.services.customer_service import create_or_update_customer_from_invoice
from app.services.entitlement_service import ensure_can_create


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")

    if isinstance(value, Decimal):
        return value

    return Decimal(str(value))


def _money(value) -> Decimal:
    return _to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
        "final_amount": _money(invoice.final_amount),
        "paid_amount": _money(invoice.paid_amount),
        "remaining_amount": _money(invoice.remaining_amount),
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


def _set_product_stock(product: Product, new_stock: Decimal):
    if new_stock < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for {product.name}. Available: {_get_product_stock(product)}",
        )

    current_type_value = getattr(product, "stock_quantity", None)

    if isinstance(current_type_value, int):
        product.stock_quantity = int(new_stock)
    else:
        product.stock_quantity = new_stock


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
        .options(joinedload(Invoice.items))
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

    return {
        "total_invoices": row.total_invoices or 0,
        "total_sales_amount": _money(row.total_sales_amount),
        "total_discount_given": _money(row.total_discount_given),
        "total_profit": _money(row.total_profit),
        "today_sales": _money(row.today_sales),
        "monthly_sales": _money(row.monthly_sales),
        "pending_amount": _money(row.pending_amount),
        "paid_amount": _money(row.paid_amount),
        "paid_invoices": row.paid_invoices or 0,
        "pending_invoices": row.pending_invoices or 0,
        "partial_invoices": row.partial_invoices or 0,
    }


def create_invoice(payload: InvoiceCreate, db: Session, current_user: User):
    ensure_can_create(current_user.shop_id, "orders.monthly", db)

    invoice_date_value = payload.invoice_date or date.today()

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice must contain at least one item",
        )

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
                "mrp": mrp,
                "buy_price": buy_price,
                **pricing,
            }
        )

    total_tax_amount = _money(payload.total_tax_amount)
    invoice_amounts = _resolve_invoice_amounts(
        subtotal_amount=subtotal_amount,
        item_discount_amount=item_discount_amount,
        total_tax_amount=total_tax_amount,
        requested_total_payable_amount=payload.total_payable_amount,
        base_total_profit=base_total_profit,
    )

    normalized_paid_amount = _normalize_paid_amount(
        invoice_amounts["final_amount"],
        payload.paid_amount,
    )
    remaining_amount, payment_status = _calculate_payment_status(
        invoice_amounts["final_amount"],
        normalized_paid_amount,
    )

    if payload.payment_status:
        payment_status = payload.payment_status

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
        customer_pincode_snapshot=customer.pincode,
        customer_gst_number_snapshot=customer.gst_number,
        invoice_date=invoice_date_value,
        subtotal_amount=_money(subtotal_amount),
        total_discount_amount=invoice_amounts["total_discount_amount"],
        total_tax_amount=total_tax_amount,
        billed_amount=invoice_amounts["billed_amount"],
        extra_discount_amount=invoice_amounts["extra_discount_amount"],
        final_amount=invoice_amounts["final_amount"],
        paid_amount=normalized_paid_amount,
        remaining_amount=remaining_amount,
        total_buy_cost=_money(total_buy_cost),
        total_profit=invoice_amounts["total_profit"],
        payment_status=payment_status,
        payment_mode=payload.payment_mode,
        invoice_status=payload.invoice_status,
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
            payment_status=payment_status,
        )

        db.add(analytics)

    for product_id, requested_quantity in requested_by_product.items():
        product = products_by_id[product_id]
        new_stock = _get_product_stock(product) - requested_quantity
        _set_product_stock(product, new_stock)

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
        .options(joinedload(Invoice.items), joinedload(Invoice.sales_analytics))
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

    is_full_edit = bool(
        data.get("customer") is not None
        or data.get("items") is not None
        or data.get("invoice_date") is not None
        or data.get("total_tax_amount") is not None
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
                    "mrp": mrp,
                    "buy_price": buy_price,
                    **pricing,
                }
            )

        total_tax_amount = _money(payload.total_tax_amount or 0)
        invoice_amounts = _resolve_invoice_amounts(
            subtotal_amount=subtotal_amount,
            item_discount_amount=item_discount_amount,
            total_tax_amount=total_tax_amount,
            requested_total_payable_amount=payload.total_payable_amount,
            base_total_profit=base_total_profit,
        )

        paid_amount_input = (
            payload.paid_amount if payload.paid_amount is not None else invoice.paid_amount
        )
        normalized_paid_amount = _normalize_paid_amount(
            invoice_amounts["final_amount"],
            paid_amount_input,
        )
        remaining_amount, calculated_payment_status = _calculate_payment_status(
            invoice_amounts["final_amount"],
            normalized_paid_amount,
        )

        final_payment_status = payload.payment_status or calculated_payment_status

        # Remove old child rows only after all stock validation has succeeded.
        db.query(ProductSalesAnalytics).filter(
            ProductSalesAnalytics.invoice_id == invoice.id
        ).delete(synchronize_session=False)

        db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice.id
        ).delete(synchronize_session=False)

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
        invoice.customer_pincode_snapshot = customer.pincode
        invoice.customer_gst_number_snapshot = customer.gst_number

        invoice.invoice_date = invoice_date_value
        invoice.subtotal_amount = _money(subtotal_amount)
        invoice.total_discount_amount = invoice_amounts["total_discount_amount"]
        invoice.total_tax_amount = total_tax_amount
        invoice.billed_amount = invoice_amounts["billed_amount"]
        invoice.extra_discount_amount = invoice_amounts["extra_discount_amount"]
        invoice.final_amount = invoice_amounts["final_amount"]

        invoice.paid_amount = normalized_paid_amount
        invoice.remaining_amount = remaining_amount

        invoice.total_buy_cost = _money(total_buy_cost)
        invoice.total_profit = invoice_amounts["total_profit"]

        invoice.payment_status = final_payment_status
        invoice.payment_mode = payload.payment_mode
        invoice.invoice_status = payload.invoice_status or invoice.invoice_status
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
            adjusted_stock = _get_product_stock(product) - net_stock_change
            _set_product_stock(product, adjusted_stock)

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
        billed_amount = _money(invoice.billed_amount or invoice.final_amount)
        requested_total_payable_amount = _money(data["total_payable_amount"])

        if requested_total_payable_amount > billed_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total payable cannot be greater than total billed amount",
            )

        base_item_discount_amount = _money(
            _to_decimal(invoice.total_discount_amount) - _to_decimal(invoice.extra_discount_amount)
        )
        extra_discount_amount = _money(billed_amount - requested_total_payable_amount)

        invoice.billed_amount = billed_amount
        invoice.extra_discount_amount = extra_discount_amount
        invoice.total_discount_amount = _money(base_item_discount_amount + extra_discount_amount)
        invoice.final_amount = requested_total_payable_amount
        invoice.total_profit = _money(
            _to_decimal(invoice.total_profit) + invoice.final_amount - old_final_amount
        )
        invoice.paid_amount = _normalize_paid_amount(invoice.final_amount, invoice.paid_amount)

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
        invoice.invoice_status = data["invoice_status"]

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



def delete_invoice(invoice_id: int, db: Session, current_user: User):
    """
    Soft delete/cancel invoice instead of hard deleting financial record.
    This keeps historical records safer.
    """

    invoice = get_invoice(invoice_id, db, current_user)

    before_audit = _invoice_audit_snapshot(invoice)
    invoice.invoice_status = "cancelled"

    for analytics in invoice.sales_analytics:
        analytics.payment_status = invoice.payment_status

    after_audit = _invoice_audit_snapshot(invoice)
    if before_audit != after_audit:
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
