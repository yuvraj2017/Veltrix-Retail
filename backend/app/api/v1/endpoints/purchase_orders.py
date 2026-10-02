from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_active_shop_access
from app.models.user import User
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptResponse,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
    PurchaseReturnCreate,
    PurchaseReturnEligibilityItem,
    PurchaseReturnResponse,
)
from app.services.purchase_service import (
    cancel_purchase_order,
    create_goods_receipt,
    create_purchase_order,
    get_purchase_order,
    list_goods_receipts,
    list_purchase_orders,
    update_purchase_order,
    create_purchase_return,
    get_purchase_return_eligibility,
    list_purchase_returns,
)


router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def add_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return create_purchase_order(db, payload=payload, current_user=current_user)


@router.get("", response_model=PurchaseOrderListResponse)
def get_purchase_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_purchase_orders(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
    )


@router.get("/{po_id}", response_model=PurchaseOrderResponse)
def get_single_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_purchase_order(db, po_id=po_id, current_user=current_user)


@router.put("/{po_id}", response_model=PurchaseOrderResponse)
def edit_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return update_purchase_order(db, po_id=po_id, payload=payload, current_user=current_user)


@router.post("/{po_id}/cancel", response_model=PurchaseOrderResponse)
def cancel_single_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return cancel_purchase_order(db, po_id=po_id, current_user=current_user)


@router.post(
    "/{po_id}/receipts",
    response_model=GoodsReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
def receive_purchase_order(
    po_id: int,
    payload: GoodsReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return create_goods_receipt(db, po_id=po_id, payload=payload, current_user=current_user)


@router.get("/{po_id}/receipts", response_model=list[GoodsReceiptResponse])
def get_purchase_order_receipts(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_goods_receipts(db, po_id=po_id, current_user=current_user)


@router.get(
    "/{po_id}/return-eligibility",
    response_model=list[PurchaseReturnEligibilityItem],
)
def get_return_eligibility(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return get_purchase_return_eligibility(db, po_id=po_id, current_user=current_user)


@router.post(
    "/{po_id}/returns",
    response_model=PurchaseReturnResponse,
    status_code=status.HTTP_201_CREATED,
)
def return_purchase_order_goods(
    po_id: int,
    payload: PurchaseReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return create_purchase_return(db, po_id=po_id, payload=payload, current_user=current_user)


@router.get("/{po_id}/returns", response_model=list[PurchaseReturnResponse])
def get_purchase_order_returns(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_shop_access),
):
    return list_purchase_returns(db, po_id=po_id, current_user=current_user)
