from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.user import User


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")

    if isinstance(value, Decimal):
        return value

    return Decimal(str(value))


def _get_product_code(product: Product) -> str:
    if getattr(product, "sku", None):
        return product.sku

    if getattr(product, "barcode", None):
        return product.barcode

    return str(product.id)


def _get_product_available_stock(product: Product) -> Decimal:
    stock = getattr(product, "stock_quantity", None)
    return _to_decimal(stock)


def _get_product_buying_price(product: Product) -> Decimal:
    if hasattr(product, "buying_price"):
        return _to_decimal(product.buying_price)

    if hasattr(product, "buy_price"):
        return _to_decimal(product.buy_price)

    return Decimal("0.00")


def _get_product_mrp(product: Product) -> Decimal:
    if hasattr(product, "mrp"):
        return _to_decimal(product.mrp)

    if hasattr(product, "selling_price"):
        return _to_decimal(product.selling_price)

    return Decimal("0.00")


def _get_product_selling_price(product: Product) -> Decimal:
    if hasattr(product, "selling_price"):
        return _to_decimal(product.selling_price)

    if hasattr(product, "mrp"):
        return _to_decimal(product.mrp)

    return Decimal("0.00")


def _serialize_billing_product(product: Product):
    return {
        "id": product.id,
        "name": product.name,
        "product_code": _get_product_code(product),
        "sku": getattr(product, "sku", None),
        "barcode": getattr(product, "barcode", None),
        "category": getattr(product, "category", None),
        "unit": getattr(product, "unit", None),
        "mrp": _get_product_mrp(product),
        "buying_price": _get_product_buying_price(product),
        "selling_price": _get_product_selling_price(product),
        "available_stock": _get_product_available_stock(product),
        "is_active": getattr(product, "is_active", True),
    }


def search_billing_products(code: str, db: Session, current_user: User):
    cleaned_code = code.strip()

    if not cleaned_code:
        return []

    products = (
        db.query(Product)
        .filter(Product.shop_id == current_user.shop_id)
        .filter(Product.is_active == True)  # noqa: E712
        .filter(
            or_(
                Product.name.ilike(f"%{cleaned_code}%"),
                Product.sku.ilike(f"%{cleaned_code}%"),
                Product.barcode.ilike(f"%{cleaned_code}%"),
                Product.category.ilike(f"%{cleaned_code}%"),
            )
        )
        .order_by(Product.name.asc())
        .limit(20)
        .all()
    )

    return [_serialize_billing_product(product) for product in products]


def get_billing_product_by_code(product_code: str, db: Session, current_user: User):
    cleaned_code = product_code.strip()

    product = (
        db.query(Product)
        .filter(Product.shop_id == current_user.shop_id)
        .filter(Product.is_active == True)  # noqa: E712
        .filter(
            or_(
                Product.sku == cleaned_code,
                Product.barcode == cleaned_code,
            )
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found for this code",
        )

    return _serialize_billing_product(product)


def get_product_for_invoice(product_id: int, db: Session, current_user: User):
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.shop_id == current_user.shop_id,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )

    if not getattr(product, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product {product.name} is inactive",
        )

    return product