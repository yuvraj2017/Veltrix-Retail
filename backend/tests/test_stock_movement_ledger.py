import importlib.util
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException

from app.models.invoice import Invoice
from app.models.invoice_return import InvoiceReturnItem
from app.models.product import Product
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.invoice import (
    InvoiceCancelPayload,
    InvoiceCreate,
    InvoiceRefundCreate,
    InvoiceReturnCreate,
    InvoiceUpdate,
)
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.invoice_service import (
    add_return_refund,
    cancel_invoice,
    create_invoice,
    create_invoice_return,
    update_invoice,
)
from app.services.product_service import create_product, delete_product, update_product
from app.services.stock_service import reconcile_stock_balances


def _product_payload(*, sku: str, stock: int = 10) -> ProductCreate:
    return ProductCreate(
        name=f"Ledger {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("50.00"),
        mrp=Decimal("100.00"),
        selling_price=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        stock_quantity=stock,
        low_stock_threshold=1,
        unit="pcs",
    )


def _invoice_payload(
    product: Product,
    *,
    key: str,
    quantity: int,
    invoice_status: str = "saved",
    paid_amount: Decimal = Decimal("0.00"),
) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "client_request_id": key,
            "customer": {
                "first_name": "Stock",
                "last_name": "Ledger",
                "phone": "9000012345",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": date(2026, 10, 2),
            "payment_status": "pending",
            "payment_mode": "cash" if paid_amount else None,
            "paid_amount": paid_amount,
            "total_tax_amount": 0,
            "invoice_status": invoice_status,
        }
    )


def _draft_update(product: Product, quantity: int, *, status_value: str = "draft") -> InvoiceUpdate:
    return InvoiceUpdate.model_validate(
        {
            "customer": {
                "first_name": "Stock",
                "last_name": "Ledger",
                "phone": "9000012345",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": date(2026, 10, 2),
            "payment_status": "pending",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": status_value,
        }
    )


def _movements(db, product: Product):
    return (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product.id)
        .order_by(StockMovement.id.asc())
        .all()
    )


def test_migration_backfills_opening_balance_without_changing_stock(db_session, make_user):
    user = make_user(email="ledger-migration@example.com")
    product = Product(
        shop_id=user.shop_id,
        name="Legacy Product",
        sku="LEGACY-OPEN",
        category="General",
        buying_price=Decimal("10.00"),
        mrp=Decimal("20.00"),
        selling_price=Decimal("20.00"),
        stock_quantity=7,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    zero_product = Product(
        shop_id=user.shop_id,
        name="Legacy Zero",
        sku="LEGACY-ZERO",
        category="General",
        buying_price=Decimal("10.00"),
        mrp=Decimal("20.00"),
        selling_price=Decimal("20.00"),
        stock_quantity=0,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add_all([product, zero_product])
    db_session.commit()

    path = Path(__file__).parents[1] / "alembic" / "versions" / "20261002_0014_stock_movement_ledger.py"
    spec = importlib.util.spec_from_file_location("phase3b_migration", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(db_session.connection()))
    module._backfill_opening_balances()
    db_session.flush()

    rows = db_session.query(StockMovement).order_by(StockMovement.product_id).all()
    assert [(row.quantity_before, row.quantity_delta, row.quantity_after) for row in rows] == [
        (0, 7, 7),
        (0, 0, 0),
    ]
    db_session.refresh(product)
    assert product.stock_quantity == 7


def test_product_opening_balance_and_reconciliation(db_session, make_user):
    user = make_user(email="ledger-opening@example.com")
    product = create_product(_product_payload(sku="OPEN", stock=6), user, db_session)

    movement = _movements(db_session, product)[0]
    assert (movement.movement_type, movement.quantity_before, movement.quantity_delta, movement.quantity_after) == (
        StockMovementType.OPENING_BALANCE,
        0,
        6,
        6,
    )
    result = reconcile_stock_balances(db_session, shop_id=user.shop_id)
    assert result["mismatch_count"] == 0


def test_finalized_sale_and_invoice_retry_create_one_movement(db_session, make_user):
    user = make_user(email="ledger-sale@example.com")
    product = create_product(_product_payload(sku="SALE", stock=5), user, db_session)
    payload = _invoice_payload(product, key="ledger-sale-key", quantity=2)

    first = create_invoice(payload, db_session, user)
    replay = create_invoice(payload, db_session, user)
    db_session.refresh(product)

    assert replay.id == first.id
    assert product.stock_quantity == 3
    sales = [row for row in _movements(db_session, product) if row.movement_type == StockMovementType.SALE]
    assert len(sales) == 1
    assert sales[0].quantity_delta == -2


@pytest.mark.parametrize(
    ("restocked", "disposition", "expected_stock", "movement_count"),
    [(2, "restock", 10, 1), (1, "damaged", 9, 1), (0, "defective", 8, 0)],
)
def test_return_financial_quantity_is_independent_from_restock(
    db_session,
    make_user,
    restocked,
    disposition,
    expected_stock,
    movement_count,
):
    user = make_user(email=f"ledger-return-{restocked}@example.com")
    product = create_product(_product_payload(sku=f"RET-{restocked}", stock=10), user, db_session)
    invoice = create_invoice(
        _invoice_payload(product, key=f"return-invoice-{restocked}", quantity=2),
        db_session,
        user,
    )
    payload = InvoiceReturnCreate.model_validate(
        {
            "client_request_id": f"return-key-{restocked}",
            "reason": "Customer return",
            "items": [
                {
                    "invoice_item_id": invoice.items[0].id,
                    "quantity": 2,
                    "restocked_quantity": restocked,
                    "disposition": disposition,
                }
            ],
        }
    )

    returned = create_invoice_return(invoice.id, payload, db_session, user)
    replay = create_invoice_return(invoice.id, payload, db_session, user)
    db_session.refresh(product)
    item = db_session.query(InvoiceReturnItem).filter_by(return_id=returned.id).one()
    return_movements = [
        row for row in _movements(db_session, product) if row.movement_type == StockMovementType.SALE_RETURN
    ]

    assert replay.id == returned.id
    assert returned.total_amount == invoice.final_amount
    assert returned.total_tax_amount == invoice.total_tax_amount
    assert (item.quantity, item.restocked_quantity, item.non_restocked_quantity) == (
        Decimal("2.00"),
        restocked,
        2 - restocked,
    )
    assert product.stock_quantity == expected_stock
    assert len(return_movements) == movement_count


def test_draft_reserve_resize_and_finalize_does_not_double_deduct(db_session, make_user):
    user = make_user(email="ledger-draft-finalize@example.com")
    product = create_product(_product_payload(sku="DRAFT-FINAL", stock=10), user, db_session)
    invoice = create_invoice(
        _invoice_payload(product, key="draft-final-key", quantity=2, invoice_status="draft"),
        db_session,
        user,
    )
    update_invoice(invoice.id, _draft_update(product, 4), db_session, user)
    update_invoice(invoice.id, _draft_update(product, 1), db_session, user)
    update_invoice(invoice.id, InvoiceUpdate(invoice_status="saved"), db_session, user)
    db_session.refresh(product)

    assert product.stock_quantity == 9
    assert [row.quantity_delta for row in _movements(db_session, product)] == [10, -2, -2, 3, 1, -1]
    assert [row.movement_type for row in _movements(db_session, product)][-2:] == [
        StockMovementType.DRAFT_RELEASE,
        StockMovementType.SALE,
    ]


def test_non_restocked_return_refund_uses_full_financial_quantity(db_session, make_user):
    user = make_user(email="ledger-damaged-refund@example.com")
    product = create_product(_product_payload(sku="DAMAGED-REFUND", stock=5), user, db_session)
    invoice = create_invoice(
        _invoice_payload(
            product,
            key="damaged-refund-invoice",
            quantity=2,
            paid_amount=Decimal("200.00"),
        ),
        db_session,
        user,
    )
    returned = create_invoice_return(
        invoice.id,
        InvoiceReturnCreate.model_validate(
            {
                "client_request_id": "damaged-refund-return",
                "reason": "Damaged",
                "items": [
                    {
                        "invoice_item_id": invoice.items[0].id,
                        "quantity": 2,
                        "restocked_quantity": 0,
                        "disposition": "damaged",
                    }
                ],
            }
        ),
        db_session,
        user,
    )

    assert returned.refundable_amount == invoice.final_amount
    refund = add_return_refund(
        returned.id,
        InvoiceRefundCreate(
            client_request_id="damaged-refund-payment",
            amount=returned.refundable_amount,
            refund_method="cash",
        ),
        db_session,
        user,
    )
    db_session.refresh(product)
    assert refund.amount == invoice.final_amount
    assert product.stock_quantity == 3


def test_draft_cancellation_releases_stock_exactly_once(db_session, make_user):
    user = make_user(email="ledger-draft-cancel@example.com")
    product = create_product(_product_payload(sku="DRAFT-CANCEL", stock=10), user, db_session)
    invoice = create_invoice(
        _invoice_payload(product, key="draft-cancel-key", quantity=3, invoice_status="draft"),
        db_session,
        user,
    )
    payload = InvoiceCancelPayload(reason="Draft abandoned", client_request_id="draft-cancel-request")

    cancel_invoice(invoice.id, payload, db_session, user)
    cancel_invoice(invoice.id, payload, db_session, user)
    db_session.refresh(product)

    assert product.stock_quantity == 10
    releases = [row for row in _movements(db_session, product) if row.movement_type == StockMovementType.DRAFT_RELEASE]
    assert len(releases) == 1
    assert releases[0].quantity_delta == 3


def test_finalized_cancellation_restores_once_through_full_return(db_session, make_user):
    user = make_user(email="ledger-saved-cancel@example.com")
    product = create_product(_product_payload(sku="SAVED-CANCEL", stock=10), user, db_session)
    invoice = create_invoice(
        _invoice_payload(product, key="saved-cancel-key", quantity=2),
        db_session,
        user,
    )
    payload = InvoiceCancelPayload(reason="Void sale", client_request_id="saved-cancel-request")

    cancel_invoice(invoice.id, payload, db_session, user)
    cancel_invoice(invoice.id, payload, db_session, user)
    db_session.refresh(product)

    assert product.stock_quantity == 10
    returns = [row for row in _movements(db_session, product) if row.movement_type == StockMovementType.SALE_RETURN]
    assert len(returns) == 1
    assert returns[0].quantity_delta == 2


def test_direct_stock_overwrite_is_rejected(db_session, make_user):
    user = make_user(email="ledger-direct-edit@example.com")
    product = create_product(_product_payload(sku="NO-OVERWRITE", stock=4), user, db_session)

    with pytest.raises(HTTPException) as exc:
        update_product(product.id, ProductUpdate(stock_quantity=9), user, db_session)

    assert exc.value.status_code == 409
    db_session.rollback()
    db_session.refresh(product)
    assert product.stock_quantity == 4


def test_reconciliation_reports_mismatch_without_repair(db_session, make_user):
    user = make_user(email="ledger-reconcile@example.com")
    product = create_product(_product_payload(sku="MISMATCH", stock=4), user, db_session)
    product.stock_quantity = 3
    db_session.commit()

    result = reconcile_stock_balances(db_session, shop_id=user.shop_id)

    assert result["mismatch_count"] == 1
    assert result["items"][0]["difference"] == -1
    db_session.refresh(product)
    assert product.stock_quantity == 3


def test_stock_history_is_tenant_isolated(client, db_session, make_user, auth_headers):
    user_a = make_user(email="ledger-history-a@example.com")
    user_b = make_user(email="ledger-history-b@example.com")
    product_a = create_product(_product_payload(sku="HISTORY-A", stock=2), user_a, db_session)

    own = client.get(
        f"/api/v1/inventory/products/{product_a.id}/movements",
        headers=auth_headers(user_a.email),
    )
    foreign = client.get(
        f"/api/v1/inventory/products/{product_a.id}/movements",
        headers=auth_headers(user_b.email),
    )

    assert own.status_code == 200
    assert own.json()["total"] == 1
    assert foreign.status_code == 404


def test_product_delete_deactivates_and_preserves_stock_history(db_session, make_user):
    user = make_user(email="ledger-delete@example.com")
    product = create_product(_product_payload(sku="KEEP-HISTORY", stock=3), user, db_session)
    movement_id = _movements(db_session, product)[0].id

    result = delete_product(product.id, user, db_session)
    db_session.refresh(product)

    assert result["message"] == "Product deactivated successfully"
    assert product.is_active is False
    assert db_session.query(StockMovement).filter_by(id=movement_id).one().product_id == product.id


def test_insufficient_stock_creates_no_sale_movement(db_session, make_user):
    user = make_user(email="ledger-insufficient@example.com")
    product = create_product(_product_payload(sku="INSUFFICIENT", stock=1), user, db_session)

    with pytest.raises(HTTPException):
        create_invoice(
            _invoice_payload(product, key="insufficient-key", quantity=2),
            db_session,
            user,
        )
    db_session.rollback()

    assert db_session.query(Invoice).count() == 0
    assert [row.movement_type for row in _movements(db_session, product)] == [
        StockMovementType.OPENING_BALANCE
    ]
