from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.stock import (
    PhysicalStockCountCreate,
    StockAdjustmentCreate,
    StockAdjustmentResult,
    StockMovementListResponse,
    StockReconciliationResponse,
    InventoryActivityResponse,
    InventoryMovementListResponse,
    InventoryProductListResponse,
    InventorySummaryResponse,
    ProductInventoryDetailResponse,
    PurchasingReportResponse,
    VendorPurchasingInsightResponse,
)
from app.services.stock_service import (
    create_stock_adjustment,
    list_product_stock_movements,
    reconcile_physical_stock_count,
    reconcile_stock_balances,
)
from app.services.inventory_reporting_service import (
    csv_text,
    get_inventory_activity,
    get_inventory_summary,
    get_product_inventory_detail,
    list_inventory_movements,
    list_inventory_products,
    list_purchasing_report,
    list_reconciliation_report,
    list_vendor_purchasing_insights,
)


router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/summary", response_model=InventorySummaryResponse)
def inventory_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_inventory_summary(db, shop_id=current_user.shop_id)


@router.get("/products", response_model=InventoryProductListResponse)
def inventory_products(
    search: str | None = Query(default=None, max_length=200),
    stock_status: str | None = Query(default=None),
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_inventory_products(
        db,
        shop_id=current_user.shop_id,
        search=search,
        stock_status=stock_status,
        active_only=active_only,
        page=page,
        page_size=page_size,
    )


@router.get("/movements", response_model=InventoryMovementListResponse)
def inventory_movements(
    search: str | None = Query(default=None, max_length=200),
    product_id: int | None = Query(default=None, gt=0),
    movement_type: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_inventory_movements(
        db,
        shop_id=current_user.shop_id,
        search=search,
        product_id=product_id,
        movement_type=movement_type,
        direction=direction,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/reconciliation/report")
def inventory_reconciliation_report(
    search: str | None = Query(default=None, max_length=200),
    mismatches_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_reconciliation_report(
        db,
        shop_id=current_user.shop_id,
        search=search,
        mismatches_only=mismatches_only,
        page=page,
        page_size=page_size,
    )


@router.get("/activity", response_model=InventoryActivityResponse)
def inventory_activity(
    date_from: date = Query(default_factory=lambda: date.today() - timedelta(days=29)),
    date_to: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_inventory_activity(
        db, shop_id=current_user.shop_id, date_from=date_from, date_to=date_to
    )


@router.get("/purchasing", response_model=PurchasingReportResponse)
def inventory_purchasing_report(
    search: str | None = Query(default=None, max_length=200),
    vendor_id: int | None = Query(default=None, gt=0),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_purchasing_report(
        db,
        shop_id=current_user.shop_id,
        search=search,
        vendor_id=vendor_id,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/vendor-insights", response_model=VendorPurchasingInsightResponse)
def vendor_purchasing_insights(
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_vendor_purchasing_insights(
        db, shop_id=current_user.shop_id, search=search, page=page, page_size=page_size
    )


@router.get("/products/{product_id}/detail", response_model=ProductInventoryDetailResponse)
def product_inventory_detail(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_product_inventory_detail(db, shop_id=current_user.shop_id, product_id=product_id)


@router.get("/exports/{report_name}")
def export_inventory_report(
    report_name: str,
    search: str | None = Query(default=None, max_length=200),
    stock_status: str | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    vendor_id: int | None = Query(default=None, gt=0),
    po_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    mismatches_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    if report_name in {"inventory", "low-stock"}:
        status_filter = "actionable" if report_name == "low-stock" else stock_status
        result = list_inventory_products(
            db,
            shop_id=current_user.shop_id,
            search=search,
            stock_status=status_filter,
            active_only=True,
            page=1,
            page_size=100000,
        )
        text = csv_text(
            ["Product", "SKU", "Barcode", "Status", "Current Stock", "Low Stock Threshold", "Incoming Stock", "Buying Price", "Current Inventory Value"],
            [[item["name"], item["sku"], item["barcode"] or "", item["stock_status"], item["stock_quantity"], item["low_stock_threshold"], item["incoming_quantity"], item["buying_price"], item["inventory_value"]] for item in result["items"]],
        )
    elif report_name == "movements":
        result = list_inventory_movements(
            db,
            shop_id=current_user.shop_id,
            search=search,
            movement_type=movement_type,
            direction=direction,
            date_from=date_from,
            date_to=date_to,
            page=1,
            page_size=100000,
        )
        text = csv_text(
            ["Date/Time", "Product", "SKU", "Movement Type", "Before", "Change", "After", "Reason", "Reference", "Actor"],
            [[item["occurred_at"].isoformat(), item["product_name"], item["product_sku"], item["movement_type"], item["quantity_before"], item["quantity_delta"], item["quantity_after"], item["reason"] or "", item["reference_label"], item["actor_name"] or ""] for item in result["items"]],
        )
    elif report_name == "reconciliation":
        result = list_reconciliation_report(
            db,
            shop_id=current_user.shop_id,
            search=search,
            mismatches_only=mismatches_only,
            page=1,
            page_size=100000,
        )
        text = csv_text(
            ["Product", "SKU", "Current Stock", "Ledger Stock", "Difference", "Status"],
            [[item["product_name"], item["sku"], item["current_balance"], item["ledger_balance"], item["difference"], "Matched" if item["matches"] else "Mismatch"] for item in result["items"]],
        )
    elif report_name == "purchase-orders":
        result = list_purchasing_report(
            db,
            shop_id=current_user.shop_id,
            search=search,
            vendor_id=vendor_id,
            status_filter=po_status,
            date_from=date_from,
            date_to=date_to,
            page=1,
            page_size=100000,
        )
        text = csv_text(
            ["PO Number", "Vendor", "Order Date", "Expected Date", "Status", "Ordered Quantity", "Received Quantity", "Remaining Quantity", "Ordered Value", "Returned Quantity", "Returned Value"],
            [[item["purchase_order_number"], item["vendor_name"], item["order_date"], item["expected_date"] or "", item["status"], item["ordered_quantity"], item["received_quantity"], item["remaining_quantity"], item["ordered_value"], item["purchase_return_quantity"], item["purchase_return_value"]] for item in result["items"]],
        )
    else:
        return Response(status_code=404, content="Unknown inventory export")
    return Response(
        content="\ufeff" + text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{report_name}.csv"'},
    )


@router.post(
    "/products/{product_id}/adjustments",
    response_model=StockAdjustmentResult,
)
def adjust_product_stock(
    product_id: int,
    payload: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return create_stock_adjustment(
        db,
        product_id=product_id,
        payload=payload,
        current_user=current_user,
    )


@router.post(
    "/products/{product_id}/physical-count",
    response_model=StockAdjustmentResult,
)
def record_product_physical_count(
    product_id: int,
    payload: PhysicalStockCountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return reconcile_physical_stock_count(
        db,
        product_id=product_id,
        payload=payload,
        current_user=current_user,
    )


@router.get(
    "/products/{product_id}/movements",
    response_model=StockMovementListResponse,
)
def product_stock_history(
    product_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_product_stock_movements(
        db,
        shop_id=current_user.shop_id,
        product_id=product_id,
        page=page,
        page_size=page_size,
    )


@router.get("/reconciliation", response_model=StockReconciliationResponse)
def stock_reconciliation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return reconcile_stock_balances(db, shop_id=current_user.shop_id)
