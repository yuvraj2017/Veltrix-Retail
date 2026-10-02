from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductStatsResponse,
    ProductUpdate,
)
from app.services.image_service import ImageProcessingError, save_optimized_image
from app.services.product_service import (
    DEFAULT_PRODUCT_PAGE_SIZE,
    MAX_PRODUCT_PAGE_SIZE,
    create_product,
    delete_product,
    delete_product_image,
    get_product,
    get_product_stats,
    list_product_categories,
    list_products,
    update_product,
)

router = APIRouter(prefix="/products", tags=["Products"])

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_PRODUCT_IMAGES = 5


def save_uploaded_product_images(images: list[UploadFile] | None) -> list[str]:
    if not images:
        return []

    if len(images) > MAX_PRODUCT_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 images allowed",
        )

    saved_urls: list[str] = []

    for image in images:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only png, jpg, jpeg, and webp files are allowed",
            )

        try:
            full_url, _thumbnail_url = save_optimized_image(image, "products")
        except ImageProcessingError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        saved_urls.append(full_url)

    return saved_urls


@router.post("", response_model=ProductResponse, status_code=201)
def create_product_endpoint(
    name: str = Form(...),
    sku: str = Form(...),
    category: str = Form(...),
    description: str | None = Form(None),
    buying_price: Decimal = Form(...),
    mrp: Decimal = Form(...),
    selling_price: Decimal = Form(...),
    hsn_sac: str | None = Form(None),
    gst_rate: Decimal = Form(0),
    stock_quantity: int = Form(...),
    low_stock_threshold: int = Form(...),
    unit: str = Form(...),
    barcode: str | None = Form(None),
    is_active: bool = Form(True),
    main_image_url: str | None = Form(None),
    images: list[UploadFile] | None = File(None),
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    image_urls = save_uploaded_product_images(images)

    payload = ProductCreate(
        name=name,
        sku=sku,
        category=category,
        description=description,
        buying_price=buying_price,
        mrp=mrp,
        selling_price=selling_price,
        hsn_sac=hsn_sac,
        gst_rate=gst_rate,
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
        unit=unit,
        barcode=barcode,
        is_active=is_active,
        main_image_url=main_image_url,
    )

    return create_product(payload, current_user, db, image_urls=image_urls)


@router.get("", response_model=ProductListResponse)
def list_products_endpoint(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    stock_status: str | None = Query(default=None),
    sort_by: str = Query(default="date_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PRODUCT_PAGE_SIZE, ge=1, le=MAX_PRODUCT_PAGE_SIZE),
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return list_products(
        current_user,
        db,
        search=search,
        category=category,
        stock_status=stock_status,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get("/categories", response_model=list[str])
def list_product_categories_endpoint(
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return list_product_categories(current_user, db)


@router.get("/stats", response_model=ProductStatsResponse)
def product_stats_endpoint(
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return get_product_stats(current_user, db)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_endpoint(
    product_id: int,
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return get_product(product_id, current_user, db)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product_endpoint(
    product_id: int,
    name: str | None = Form(None),
    sku: str | None = Form(None),
    category: str | None = Form(None),
    description: str | None = Form(None),
    buying_price: Decimal | None = Form(None),
    mrp: Decimal | None = Form(None),
    selling_price: Decimal | None = Form(None),
    hsn_sac: str | None = Form(None),
    gst_rate: Decimal | None = Form(None),
    stock_quantity: int | None = Form(None),
    low_stock_threshold: int | None = Form(None),
    unit: str | None = Form(None),
    barcode: str | None = Form(None),
    is_active: bool | None = Form(None),
    main_image_url: str | None = Form(None),
    images: list[UploadFile] | None = File(None),
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    image_urls = save_uploaded_product_images(images)

    payload = ProductUpdate(
        name=name,
        sku=sku,
        category=category,
        description=description,
        buying_price=buying_price,
        mrp=mrp,
        selling_price=selling_price,
        hsn_sac=hsn_sac,
        gst_rate=gst_rate,
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
        unit=unit,
        barcode=barcode,
        is_active=is_active,
        main_image_url=main_image_url,
    )

    return update_product(product_id, payload, current_user, db, new_image_urls=image_urls)


@router.delete("/{product_id}")
def delete_product_endpoint(
    product_id: int,
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return delete_product(product_id, current_user, db)



@router.delete("/images/{image_id}")
def delete_product_image_endpoint(
    image_id: int,
    current_user: User = Depends(require_active_shop_access),
    db: Session = Depends(get_db),
):
    return delete_product_image(image_id, current_user, db)
