from datetime import datetime, timezone
from decimal import Decimal
import os
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.product import Product, ProductImage
from app.models.user import User
from app.schemas.product import ProductCreate, ProductStatsResponse, ProductUpdate
from app.models.business_audit_log import BusinessAuditAction
from app.services.business_audit_service import record_business_audit
from app.services.entitlement_service import ensure_can_create

MAX_PRODUCT_IMAGES = 5

AUDITED_PRODUCT_FIELDS = (
    "name",
    "sku",
    "category",
    "buying_price",
    "mrp",
    "selling_price",
    "stock_quantity",
    "low_stock_threshold",
    "unit",
    "barcode",
    "is_active",
)


def _product_audit_snapshot(product: Product) -> dict:
    return {
        field: getattr(product, field)
        for field in AUDITED_PRODUCT_FIELDS
    }


def _product_changed_fields(before: dict, product: Product) -> tuple[dict, dict]:
    after = _product_audit_snapshot(product)
    before_changed = {}
    after_changed = {}

    for field in AUDITED_PRODUCT_FIELDS:
        if before.get(field) != after.get(field):
            before_changed[field] = before.get(field)
            after_changed[field] = after.get(field)

    return before_changed, after_changed


def create_product(
    payload: ProductCreate,
    current_user: User,
    db: Session,
    image_urls: list[str] | None = None,
):
    ensure_can_create(current_user.shop_id, "products", db)

    existing = (
        db.query(Product)
        .filter(Product.shop_id == current_user.shop_id, Product.sku == payload.sku)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SKU already exists",
        )

    image_urls = image_urls or []
    if len(image_urls) > MAX_PRODUCT_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 images allowed",
        )

    main_image_url = image_urls[0] if image_urls else payload.main_image_url

    product = Product(
        shop_id=current_user.shop_id,
        name=payload.name,
        sku=payload.sku,
        category=payload.category,
        description=payload.description,
        buying_price=payload.buying_price,
        mrp=payload.mrp,
        selling_price=payload.selling_price,
        stock_quantity=payload.stock_quantity,
        low_stock_threshold=payload.low_stock_threshold,
        unit=payload.unit,
        barcode=payload.barcode,
        is_active=payload.is_active,
        main_image_url=main_image_url,
    )

    db.add(product)
    db.flush()

    now = datetime.now(timezone.utc)
    for index, image_url in enumerate(image_urls):
        db.add(
            ProductImage(
                product_id=product.id,
                image_url=image_url,
                sort_order=index,
                is_main=index == 0,
                created_at=now,
            )
        )

    record_business_audit(
        db,
        shop_id=current_user.shop_id,
        actor=current_user,
        action=BusinessAuditAction.PRODUCT_CREATED,
        entity_type="product",
        entity_id=product.id,
        summary=f"Product {product.sku} created",
        after_data=_product_audit_snapshot(product),
    )

    db.commit()
    db.refresh(product)

    return (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == product.id)
        .first()
    )


# Server-side sort options. Sorting used to happen in the browser over the
# full product list, which only worked because the whole table was returned in
# one response. With pagination the ordering has to be applied in SQL so that
# page 1 really is the first page of the sorted result.
_PRODUCT_SORTS = {
    "date_desc": (Product.created_at.desc(),),
    "date_asc": (Product.created_at.asc(),),
    "name_asc": (Product.name.asc(),),
    "name_desc": (Product.name.desc(),),
    "stock_asc": (Product.stock_quantity.asc(),),
    "stock_desc": (Product.stock_quantity.desc(),),
}

DEFAULT_PRODUCT_PAGE_SIZE = 50
MAX_PRODUCT_PAGE_SIZE = 200


def list_products(
    current_user: User,
    db: Session,
    search: str | None = None,
    category: str | None = None,
    stock_status: str | None = None,
    sort_by: str = "date_desc",
    page: int = 1,
    page_size: int = DEFAULT_PRODUCT_PAGE_SIZE,
):
    # selectinload rather than joinedload: images is a collection, so a JOIN
    # multiplies the product row once per image and the driver ships all that
    # duplication. selectinload fetches the images in one extra query keyed by
    # product id, which keeps the payload proportional to the real data.
    query = (
        db.query(Product)
        .options(selectinload(Product.images))
        .filter(Product.shop_id == current_user.shop_id)
    )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(search_term))
            | (Product.sku.ilike(search_term))
            | (Product.category.ilike(search_term))
        )

    if category:
        query = query.filter(Product.category == category)

    if stock_status == "in_stock":
        query = query.filter(Product.stock_quantity > Product.low_stock_threshold)
    elif stock_status == "low_stock":
        query = query.filter(
            Product.stock_quantity > 0,
            Product.stock_quantity <= Product.low_stock_threshold,
        )
    elif stock_status == "out_of_stock":
        query = query.filter(Product.stock_quantity == 0)

    total = query.count()

    page = max(page, 1)
    page_size = max(min(page_size, MAX_PRODUCT_PAGE_SIZE), 1)

    order_by = _PRODUCT_SORTS.get(sort_by, _PRODUCT_SORTS["date_desc"])

    items = (
        query.order_by(*order_by, Product.id.desc())  # id tiebreak = stable paging
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def list_product_categories(current_user: User, db: Session) -> list[str]:
    """Distinct categories for this shop's products.

    The products page previously fetched every product a second time purely to
    build this list in the browser. One cheap DISTINCT query replaces that
    full-table round trip.
    """
    rows = (
        db.query(Product.category)
        .filter(
            Product.shop_id == current_user.shop_id,
            Product.category.isnot(None),
            Product.category != "",
        )
        .distinct()
        .order_by(Product.category.asc())
        .all()
    )

    return [row[0] for row in rows]


def get_product(product_id: int, current_user: User, db: Session):
    product = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == product_id, Product.shop_id == current_user.shop_id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


def _get_product_for_update(product_id: int, current_user: User, db: Session):
    product = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == product_id, Product.shop_id == current_user.shop_id)
        .with_for_update()
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: User,
    db: Session,
    new_image_urls: list[str] | None = None,
):
    product = _get_product_for_update(product_id, current_user, db)
    before_audit = _product_audit_snapshot(product)

    if payload.sku and payload.sku != product.sku:
        existing = (
            db.query(Product)
            .filter(
                Product.shop_id == current_user.shop_id,
                Product.sku == payload.sku,
                Product.id != product_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SKU already exists",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    if new_image_urls:
        existing_count = len(product.images)
        if existing_count + len(new_image_urls) > MAX_PRODUCT_IMAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 5 images allowed",
            )

        start_order = existing_count
        now = datetime.now(timezone.utc)

        for index, image_url in enumerate(new_image_urls):
            db.add(
                ProductImage(
                    product_id=product.id,
                    image_url=image_url,
                    sort_order=start_order + index,
                    is_main=False if product.images else index == 0,
                    created_at=now,
                )
            )

        if not product.main_image_url and new_image_urls:
            product.main_image_url = new_image_urls[0]

    before_changed, after_changed = _product_changed_fields(before_audit, product)
    if before_changed:
        record_business_audit(
            db,
            shop_id=current_user.shop_id,
            actor=current_user,
            action=BusinessAuditAction.PRODUCT_UPDATED,
            entity_type="product",
            entity_id=product.id,
            summary=f"Product {product.sku} updated",
            before_data=before_changed,
            after_data=after_changed,
        )

    db.commit()

    return (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == product.id)
        .first()
    )


def delete_product(product_id: int, current_user: User, db: Session):
    product = get_product(product_id, current_user, db)
    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}


def get_product_stats(current_user: User, db: Session):
    base_query = db.query(Product).filter(Product.shop_id == current_user.shop_id)

    total_items = base_query.count()

    out_of_stock = (
        db.query(Product)
        .filter(Product.shop_id == current_user.shop_id, Product.stock_quantity == 0)
        .count()
    )

    low_stock_count = (
        db.query(Product)
        .filter(
            Product.shop_id == current_user.shop_id,
            Product.stock_quantity > 0,
            Product.stock_quantity <= Product.low_stock_threshold,
        )
        .count()
    )

    inventory_value = (
        db.query(func.coalesce(func.sum(Product.buying_price * Product.stock_quantity), 0))
        .filter(Product.shop_id == current_user.shop_id)
        .scalar()
    )

    return ProductStatsResponse(
        total_items=total_items,
        out_of_stock=out_of_stock,
        low_stock_count=low_stock_count,
        inventory_value=Decimal(str(inventory_value or 0)),
    )
    
    
    
    
def delete_product_image(image_id: int, current_user: User, db: Session):
    image = (
        db.query(ProductImage)
        .join(Product, ProductImage.product_id == Product.id)
        .filter(
            ProductImage.id == image_id,
            Product.shop_id == current_user.shop_id,
        )
        .first()
    )

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product image not found",
        )

    product = image.product

    file_path = image.image_url.lstrip("/")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass

    was_main = image.is_main

    db.delete(image)
    db.flush()

    remaining_images = (
        db.query(ProductImage)
        .filter(ProductImage.product_id == product.id)
        .order_by(ProductImage.sort_order.asc(), ProductImage.id.asc())
        .all()
    )

    if not remaining_images:
        product.main_image_url = None
    else:
        if was_main:
            first_image = remaining_images[0]
            for img in remaining_images:
              img.is_main = False
            first_image.is_main = True
            product.main_image_url = first_image.image_url

    db.commit()

    return {"message": "Product image removed successfully"}
