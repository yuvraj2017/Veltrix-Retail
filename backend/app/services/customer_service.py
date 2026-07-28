from calendar import month_abbr
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate

ACTIVE_WINDOW_DAYS = 90
VIP_WINDOW_DAYS = 120
VIP_ORDER_THRESHOLD = 5
VIP_SPEND_THRESHOLD = Decimal("50000.00")
DEFAULT_CHART_MONTHS = 6


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")

    if isinstance(value, Decimal):
        return value

    return Decimal(str(value))


def _money(value) -> Decimal:
    return _to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_full_name(first_name: str, last_name: str | None = None) -> str:
    parts = [first_name.strip()]

    if last_name and last_name.strip():
        parts.append(last_name.strip())

    return " ".join(parts)


def _normalize_phone(phone: str | None) -> str:
    return (phone or "").strip()


def _invoice_scope(db: Session, current_user: User):
    return db.query(Invoice).filter(
        Invoice.shop_id == current_user.shop_id,
        Invoice.invoice_status != "cancelled",
    )


def _customer_status(
    *,
    last_invoice_date: date | None,
    total_orders: int,
    total_spent: Decimal,
) -> str:
    if not last_invoice_date:
        return "INACTIVE"

    days_since_last_invoice = (date.today() - last_invoice_date).days

    if days_since_last_invoice <= VIP_WINDOW_DAYS and (
        total_orders >= VIP_ORDER_THRESHOLD or total_spent >= VIP_SPEND_THRESHOLD
    ):
        return "VIP"

    if days_since_last_invoice <= ACTIVE_WINDOW_DAYS:
        return "ACTIVE"

    return "INACTIVE"


def _shift_months(value: date, month_delta: int) -> date:
    month_index = (value.year * 12 + value.month - 1) + month_delta
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _last_month_starts(month_count: int = DEFAULT_CHART_MONTHS) -> list[date]:
    month_count = max(month_count, 1)
    current_month = date.today().replace(day=1)
    return [_shift_months(current_month, offset) for offset in range(-(month_count - 1), 1)]


def _month_label(month_start: date) -> str:
    return f"{month_abbr[month_start.month]} {str(month_start.year)[-2:]}"


def _month_bucket(value: date | None) -> date | None:
    if not value:
        return None
    return value.replace(day=1)


def _build_retention_message(
    *,
    repeat_customer_rate: Decimal,
    active_customers: int,
    inactive_customers: int,
    vip_customers: int,
) -> str:
    if repeat_customer_rate >= Decimal("60"):
        base_message = "Repeat buying is strong. Your billing base is coming back consistently."
    elif repeat_customer_rate >= Decimal("35"):
        base_message = "Repeat buying is healthy, but one-time customers can be nurtured better."
    else:
        base_message = "Most customers are still one-time buyers. Focus on follow-ups after billing."

    if inactive_customers > active_customers:
        return f"{base_message} More customers are inactive than active right now."

    if vip_customers > 0:
        return f"{base_message} You already have a solid VIP segment to reward and retain."

    return base_message


def _build_customer_directory_records(
    db: Session,
    current_user: User,
    search: str | None = None,
):
    query = (
        db.query(
            Customer.id.label("customer_id"),
            Customer.first_name,
            Customer.last_name,
            Customer.full_name,
            Customer.phone,
            Customer.email,
            Customer.city,
            Customer.state,
            func.count(Invoice.id).label("total_orders"),
            func.coalesce(func.sum(Invoice.final_amount), 0).label("total_spent"),
            func.coalesce(func.sum(Invoice.remaining_amount), 0).label("outstanding_amount"),
            func.coalesce(func.avg(Invoice.final_amount), 0).label("average_order_value"),
            func.min(Invoice.invoice_date).label("first_invoice_date"),
            func.max(Invoice.invoice_date).label("last_invoice_date"),
        )
        .outerjoin(
            Invoice,
            and_(
                Invoice.customer_id == Customer.id,
                Invoice.shop_id == current_user.shop_id,
                Invoice.invoice_status != "cancelled",
            ),
        )
        .filter(Customer.shop_id == current_user.shop_id)
        .group_by(
            Customer.id,
            Customer.first_name,
            Customer.last_name,
            Customer.full_name,
            Customer.phone,
            Customer.email,
            Customer.city,
            Customer.state,
        )
    )

    if search and search.strip():
        cleaned_search = search.strip()
        query = query.filter(
            or_(
                Customer.full_name.ilike(f"%{cleaned_search}%"),
                Customer.phone.ilike(f"%{cleaned_search}%"),
                Customer.email.ilike(f"%{cleaned_search}%"),
                Customer.city.ilike(f"%{cleaned_search}%"),
                Customer.state.ilike(f"%{cleaned_search}%"),
            )
        )

    rows = query.all()
    records = []

    for row in rows:
        total_orders = int(row.total_orders or 0)
        total_spent = _money(row.total_spent)
        outstanding_amount = _money(row.outstanding_amount)
        average_order_value = _money(row.average_order_value if total_orders else 0)
        last_invoice_date = row.last_invoice_date

        records.append(
            {
                "customer_id": row.customer_id,
                "full_name": row.full_name,
                "first_name": row.first_name,
                "last_name": row.last_name,
                "phone": row.phone,
                "email": row.email,
                "city": row.city,
                "state": row.state,
                "total_orders": total_orders,
                "total_spent": total_spent,
                "outstanding_amount": outstanding_amount,
                "average_order_value": average_order_value,
                "first_invoice_date": row.first_invoice_date,
                "last_invoice_date": last_invoice_date,
                "status": _customer_status(
                    last_invoice_date=last_invoice_date,
                    total_orders=total_orders,
                    total_spent=total_spent,
                ),
            }
        )

    return records


def _sort_customer_records(records: list[dict], sort_by: str | None):
    selected_sort = (sort_by or "recent").strip().lower()

    if selected_sort == "name_asc":
        records.sort(key=lambda item: item["full_name"].lower())
        return

    if selected_sort == "name_desc":
        records.sort(key=lambda item: item["full_name"].lower(), reverse=True)
        return

    if selected_sort == "spent_desc":
        records.sort(key=lambda item: (item["total_spent"], item["last_invoice_date"] or date.min), reverse=True)
        return

    if selected_sort == "orders_desc":
        records.sort(key=lambda item: (item["total_orders"], item["last_invoice_date"] or date.min), reverse=True)
        return

    if selected_sort == "outstanding_desc":
        records.sort(
            key=lambda item: (item["outstanding_amount"], item["last_invoice_date"] or date.min),
            reverse=True,
        )
        return

    records.sort(
        key=lambda item: (
            item["last_invoice_date"] or date.min,
            item["total_spent"],
            item["full_name"].lower(),
        ),
        reverse=True,
    )


def search_customers(query: str, db: Session, current_user: User):
    cleaned_query = query.strip()

    if not cleaned_query:
        return []

    return (
        db.query(Customer)
        .filter(Customer.shop_id == current_user.shop_id)
        .filter(
            or_(
                Customer.full_name.ilike(f"%{cleaned_query}%"),
                Customer.phone.ilike(f"%{cleaned_query}%"),
                Customer.email.ilike(f"%{cleaned_query}%"),
            )
        )
        .order_by(Customer.full_name.asc())
        .limit(20)
        .all()
    )


def list_customers(
    db: Session,
    current_user: User,
    search: str | None = None,
    status_filter: str | None = None,
    sort_by: str | None = None,
    page: int = 1,
    page_size: int = 12,
):
    records = _build_customer_directory_records(db, current_user, search)

    if status_filter and status_filter.strip():
        normalized_status = status_filter.strip().upper()
        if normalized_status not in {"VIP", "ACTIVE", "INACTIVE"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="status must be VIP, ACTIVE, or INACTIVE",
            )
        records = [item for item in records if item["status"] == normalized_status]

    _sort_customer_records(records, sort_by)

    total = len(records)
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "items": records[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_customer_summary(db: Session, current_user: User):
    records = _build_customer_directory_records(db, current_user)

    total_customers = len(records)
    billed_customers = sum(1 for item in records if item["total_orders"] > 0)
    active_customers = sum(1 for item in records if item["status"] == "ACTIVE")
    inactive_customers = sum(1 for item in records if item["status"] == "INACTIVE")
    vip_customers = sum(1 for item in records if item["status"] == "VIP")

    total_revenue = _money(sum(item["total_spent"] for item in records))
    outstanding_amount = _money(sum(item["outstanding_amount"] for item in records))
    average_lifetime_value = _money(total_revenue / billed_customers) if billed_customers else Decimal("0.00")
    repeat_customer_count = sum(1 for item in records if item["total_orders"] > 1)
    repeat_customer_rate = _money(
        (Decimal(repeat_customer_count) * Decimal("100") / Decimal(billed_customers))
        if billed_customers
        else Decimal("0.00")
    )

    return {
        "total_customers": total_customers,
        "billed_customers": billed_customers,
        "active_customers": active_customers,
        "inactive_customers": inactive_customers,
        "vip_customers": vip_customers,
        "total_revenue": total_revenue,
        "average_lifetime_value": average_lifetime_value,
        "repeat_customer_rate": repeat_customer_rate,
        "outstanding_amount": outstanding_amount,
    }


def get_customer_charts(db: Session, current_user: User, month_count: int = DEFAULT_CHART_MONTHS):
    month_starts = _last_month_starts(month_count)
    start_date = month_starts[0]
    month_set = set(month_starts)

    invoices = (
        _invoice_scope(db, current_user)
        .filter(Invoice.invoice_date >= start_date)
        .order_by(Invoice.invoice_date.asc())
        .all()
    )

    revenue_by_month = defaultdict(lambda: {"revenue": Decimal("0.00"), "collected_amount": Decimal("0.00"), "invoice_count": 0})
    active_customers_by_month = defaultdict(set)
    first_invoice_by_customer: dict[int, date] = {}

    for invoice in invoices:
        month_bucket = _month_bucket(invoice.invoice_date)
        if month_bucket in month_set:
            bucket = revenue_by_month[month_bucket]
            bucket["revenue"] += _money(invoice.final_amount)
            bucket["collected_amount"] += _money(invoice.paid_amount)
            bucket["invoice_count"] += 1

            if invoice.customer_id:
                active_customers_by_month[month_bucket].add(invoice.customer_id)
                existing_first_invoice = first_invoice_by_customer.get(invoice.customer_id)
                if existing_first_invoice is None or invoice.invoice_date < existing_first_invoice:
                    first_invoice_by_customer[invoice.customer_id] = invoice.invoice_date

    new_customer_counts = defaultdict(int)
    for first_invoice_date in first_invoice_by_customer.values():
        month_bucket = _month_bucket(first_invoice_date)
        if month_bucket in month_set:
            new_customer_counts[month_bucket] += 1

    revenue_trend = []
    customer_growth = []
    for month_start in month_starts:
        revenue_bucket = revenue_by_month[month_start]
        active_count = len(active_customers_by_month[month_start])
        new_count = new_customer_counts[month_start]
        returning_count = max(active_count - new_count, 0)

        revenue_trend.append(
            {
                "label": _month_label(month_start),
                "revenue": _money(revenue_bucket["revenue"]),
                "collected_amount": _money(revenue_bucket["collected_amount"]),
                "invoice_count": revenue_bucket["invoice_count"],
            }
        )
        customer_growth.append(
            {
                "label": _month_label(month_start),
                "new_customers": new_count,
                "returning_customers": returning_count,
            }
        )

    records = _build_customer_directory_records(db, current_user)
    status_breakdown = [
        {"status": "VIP", "count": sum(1 for item in records if item["status"] == "VIP")},
        {"status": "ACTIVE", "count": sum(1 for item in records if item["status"] == "ACTIVE")},
        {"status": "INACTIVE", "count": sum(1 for item in records if item["status"] == "INACTIVE")},
    ]

    top_customers = sorted(
        [item for item in records if item["total_orders"] > 0],
        key=lambda item: (item["total_spent"], item["total_orders"], item["last_invoice_date"] or date.min),
        reverse=True,
    )[:5]

    return {
        "revenue_trend": revenue_trend,
        "customer_growth": customer_growth,
        "status_breakdown": status_breakdown,
        "top_customers": [
            {
                "customer_id": item["customer_id"],
                "customer_name": item["full_name"],
                "total_spent": item["total_spent"],
                "total_orders": item["total_orders"],
                "outstanding_amount": item["outstanding_amount"],
                "status": item["status"],
            }
            for item in top_customers
        ],
    }


def get_customer_insights(db: Session, current_user: User):
    summary = get_customer_summary(db, current_user)
    charts = get_customer_charts(db, current_user)

    return {
        "vip_customers": summary["vip_customers"],
        "active_customers": summary["active_customers"],
        "inactive_customers": summary["inactive_customers"],
        "repeat_customer_rate": summary["repeat_customer_rate"],
        "retention_message": _build_retention_message(
            repeat_customer_rate=summary["repeat_customer_rate"],
            active_customers=summary["active_customers"],
            inactive_customers=summary["inactive_customers"],
            vip_customers=summary["vip_customers"],
        ),
        "top_customers": charts["top_customers"],
    }


def get_customer(customer_id: int, db: Session, current_user: User):
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.shop_id == current_user.shop_id,
        )
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return customer


def get_customer_analytics(customer_id: int, db: Session, current_user: User):
    customer = get_customer(customer_id, db, current_user)

    invoices = (
        _invoice_scope(db, current_user)
        .filter(Invoice.customer_id == customer.id)
        .order_by(Invoice.invoice_date.desc(), Invoice.created_at.desc())
        .all()
    )

    total_orders = len(invoices)
    total_spent = _money(sum(_money(invoice.final_amount) for invoice in invoices))
    outstanding_amount = _money(sum(_money(invoice.remaining_amount) for invoice in invoices))
    total_profit = _money(sum(_money(invoice.total_profit) for invoice in invoices))
    average_order_value = _money(total_spent / total_orders) if total_orders else Decimal("0.00")
    first_invoice_date = min((invoice.invoice_date for invoice in invoices), default=None)
    last_invoice_date = max((invoice.invoice_date for invoice in invoices), default=None)
    status_value = _customer_status(
        last_invoice_date=last_invoice_date,
        total_orders=total_orders,
        total_spent=total_spent,
    )

    product_rows = (
        db.query(
            InvoiceItem.product_id.label("product_id"),
            InvoiceItem.product_code.label("product_code"),
            InvoiceItem.product_name_snapshot.label("product_name"),
            InvoiceItem.category_snapshot.label("category"),
            func.coalesce(func.sum(InvoiceItem.quantity), 0).label("total_quantity"),
            func.coalesce(func.sum(InvoiceItem.total_selling_price), 0).label("total_sales"),
            func.coalesce(func.sum(InvoiceItem.total_profit), 0).label("total_profit"),
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .filter(
            Invoice.shop_id == current_user.shop_id,
            Invoice.customer_id == customer.id,
            Invoice.invoice_status != "cancelled",
        )
        .group_by(
            InvoiceItem.product_id,
            InvoiceItem.product_code,
            InvoiceItem.product_name_snapshot,
            InvoiceItem.category_snapshot,
        )
        .order_by(func.coalesce(func.sum(InvoiceItem.total_selling_price), 0).desc())
        .limit(10)
        .all()
    )

    month_starts = _last_month_starts(DEFAULT_CHART_MONTHS)
    spend_by_month = {month_start: {"total_spend": Decimal("0.00"), "collected_amount": Decimal("0.00")} for month_start in month_starts}
    month_set = set(month_starts)

    for invoice in invoices:
        month_bucket = _month_bucket(invoice.invoice_date)
        if month_bucket in month_set:
            spend_by_month[month_bucket]["total_spend"] += _money(invoice.final_amount)
            spend_by_month[month_bucket]["collected_amount"] += _money(invoice.paid_amount)

    return {
        "customer_id": customer.id,
        "full_name": customer.full_name,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "city": customer.city,
        "state": customer.state,
        "pincode": customer.pincode,
        "gst_number": customer.gst_number,
        "total_orders": total_orders,
        "total_spent": total_spent,
        "outstanding_amount": outstanding_amount,
        "average_order_value": average_order_value,
        "total_profit": total_profit,
        "first_invoice_date": first_invoice_date,
        "last_invoice_date": last_invoice_date,
        "status": status_value,
        "invoices": [
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "invoice_date": invoice.invoice_date,
                "final_amount": _money(invoice.final_amount),
                "paid_amount": _money(invoice.paid_amount),
                "remaining_amount": _money(invoice.remaining_amount),
                "total_profit": _money(invoice.total_profit),
                "payment_status": invoice.payment_status,
                "invoice_status": invoice.invoice_status,
            }
            for invoice in invoices
        ],
        "products": [
            {
                "product_id": row.product_id,
                "product_code": row.product_code,
                "product_name": row.product_name,
                "category": row.category,
                "total_quantity": _money(row.total_quantity),
                "total_sales": _money(row.total_sales),
                "total_profit": _money(row.total_profit),
            }
            for row in product_rows
        ],
        "spend_trend": [
            {
                "label": _month_label(month_start),
                "total_spend": _money(spend_by_month[month_start]["total_spend"]),
                "collected_amount": _money(spend_by_month[month_start]["collected_amount"]),
            }
            for month_start in month_starts
        ],
    }


def get_customer_by_phone(phone: str, db: Session, current_user: User):
    normalized_phone = _normalize_phone(phone)

    if not normalized_phone:
        return None

    return (
        db.query(Customer)
        .filter(
            Customer.shop_id == current_user.shop_id,
            Customer.phone == normalized_phone,
        )
        .first()
    )


def create_customer(payload: CustomerCreate, db: Session, current_user: User):
    normalized_phone = _normalize_phone(payload.phone)

    existing_customer = get_customer_by_phone(normalized_phone, db, current_user)

    if existing_customer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer with this phone number already exists",
        )

    full_name = _build_full_name(payload.first_name, payload.last_name)

    customer = Customer(
        shop_id=current_user.shop_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        full_name=full_name,
        phone=normalized_phone,
        email=payload.email,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        gst_number=payload.gst_number,
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


def create_or_update_customer_from_invoice(payload, db: Session, current_user: User):
    normalized_phone = _normalize_phone(payload.phone)

    customer = None

    if payload.id:
        customer = get_customer(payload.id, db, current_user)

    if not customer and normalized_phone:
        customer = get_customer_by_phone(normalized_phone, db, current_user)

    full_name = _build_full_name(payload.first_name, payload.last_name)

    if customer:
        customer.first_name = payload.first_name
        customer.last_name = payload.last_name
        customer.full_name = full_name
        customer.phone = normalized_phone
        customer.email = payload.email
        customer.address = payload.address
        customer.city = payload.city
        customer.state = payload.state
        customer.pincode = payload.pincode
        customer.gst_number = payload.gst_number

        db.flush()
        return customer

    customer = Customer(
        shop_id=current_user.shop_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        full_name=full_name,
        phone=normalized_phone,
        email=payload.email,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        gst_number=payload.gst_number,
    )

    db.add(customer)
    db.flush()

    return customer


def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session,
    current_user: User,
):
    customer = get_customer(customer_id, db, current_user)

    data = payload.model_dump(exclude_unset=True)

    if "phone" in data and data["phone"]:
        normalized_phone = _normalize_phone(data["phone"])

        existing_customer = get_customer_by_phone(normalized_phone, db, current_user)

        if existing_customer and existing_customer.id != customer.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another customer with this phone number already exists",
            )

        data["phone"] = normalized_phone

    for field, value in data.items():
        setattr(customer, field, value)

    if "first_name" in data or "last_name" in data:
        customer.full_name = _build_full_name(customer.first_name, customer.last_name)

    db.commit()
    db.refresh(customer)

    return customer
