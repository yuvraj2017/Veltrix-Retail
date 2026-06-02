from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate


def _build_full_name(first_name: str, last_name: str | None = None) -> str:
    parts = [first_name.strip()]

    if last_name and last_name.strip():
        parts.append(last_name.strip())

    return " ".join(parts)


def _normalize_phone(phone: str) -> str:
    return phone.strip()


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


def get_customer_by_phone(phone: str, db: Session, current_user: User):
    normalized_phone = _normalize_phone(phone)

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
    """
    Used by invoice creation.

    Logic:
    - If customer id is provided, update that customer.
    - Else if phone already exists, update existing customer.
    - Else create a new customer.
    """

    normalized_phone = _normalize_phone(payload.phone)

    customer = None

    if payload.id:
        customer = get_customer(payload.id, db, current_user)

    if not customer:
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