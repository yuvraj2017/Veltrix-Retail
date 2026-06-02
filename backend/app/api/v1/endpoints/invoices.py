from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceListPaginatedResponse,
    InvoiceMessageResponse,
    InvoicePreviewResponse,
    InvoiceResponse,
    InvoiceSharePayload,
    InvoiceShareResponse,
    InvoiceStatsResponse,
    InvoiceUpdate,
)
from app.services.invoice_service import (
    build_invoice_share_url,
    create_invoice,
    delete_invoice,
    get_invoice,
    get_invoice_preview,
    get_invoice_stats,
    list_invoices,
    update_invoice,
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("", response_model=InvoiceListPaginatedResponse)
def get_invoices(
    search: Optional[str] = Query(default=None),
    payment_status: Optional[str] = Query(default=None),
    invoice_status: Optional[str] = Query(default=None),
    invoice_date: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_invoices(
        db=db,
        current_user=current_user,
        search=search,
        payment_status=payment_status,
        invoice_status=invoice_status,
        invoice_date=invoice_date,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=InvoiceStatsResponse)
def invoice_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_stats(db, current_user)


@router.post("", response_model=InvoiceResponse, status_code=201)
def add_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_invoice(payload, db, current_user)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_single_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice(invoice_id, db, current_user)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def edit_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_invoice(invoice_id, payload, db, current_user)


@router.delete("/{invoice_id}", response_model=InvoiceMessageResponse)
def remove_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return delete_invoice(invoice_id, db, current_user)


@router.get("/{invoice_id}/preview", response_model=InvoicePreviewResponse)
def preview_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_preview(invoice_id, db, current_user)


@router.get("/{invoice_id}/pdf", response_model=InvoiceMessageResponse)
def get_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice(invoice_id, db, current_user)

    return {
        "message": (
            f"PDF generation endpoint is ready for invoice "
            f"{invoice.invoice_number}. PDF file generation will be implemented next."
        )
    }


@router.get("/{invoice_id}/download", response_model=InvoiceMessageResponse)
def download_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice(invoice_id, db, current_user)

    return {
        "message": (
            f"Download endpoint is ready for invoice "
            f"{invoice.invoice_number}. File download will be implemented next."
        )
    }


@router.post("/{invoice_id}/share", response_model=InvoiceShareResponse)
def share_invoice(
    invoice_id: int,
    payload: InvoiceSharePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    share_data = build_invoice_share_url(invoice_id, db, current_user)

    if payload.phone:
        clean_phone = "".join(ch for ch in payload.phone if ch.isdigit())
        message = payload.message or "Your invoice is ready."
        share_data["whatsapp_url"] = (
            f"https://wa.me/{clean_phone}?text={message.replace(' ', '%20')}"
        )

    return share_data