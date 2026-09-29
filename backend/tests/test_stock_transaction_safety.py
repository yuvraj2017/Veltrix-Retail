from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.invoice import Invoice
from app.models.product import Product
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.services.invoice_service import create_invoice, delete_invoice, update_invoice


def _make_product(
    db_session,
    shop_id: int,
    *,
    sku: str,
    stock_quantity: int,
    mrp: Decimal = Decimal("100.00"),
) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Product {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("40.00"),
        mrp=mrp,
        selling_price=mrp,
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _create_payload(
    items: list[tuple[Product, int | str | Decimal]],
    *,
    invoice_date: date = date(2026, 9, 27),
) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "customer": {
                "first_name": "Stock",
                "last_name": "Customer",
                "phone": "9000000000",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
                for product, quantity in items
            ],
            "invoice_date": invoice_date,
            "payment_status": "pending",
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _update_payload(
    items: list[tuple[Product, int | str | Decimal]],
    *,
    invoice_date: date = date(2026, 9, 27),
) -> InvoiceUpdate:
    return InvoiceUpdate.model_validate(
        {
            "customer": {
                "first_name": "Stock",
                "last_name": "Customer",
                "phone": "9000000000",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": quantity,
                    "discount_percentage": 0,
                }
                for product, quantity in items
            ],
            "invoice_date": invoice_date,
            "payment_status": "pending",
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _stock(db_session, product: Product) -> int:
    db_session.refresh(product)
    return product.stock_quantity


def test_invoice_with_sufficient_stock_deducts_quantity(db_session, make_user):
    user = make_user(email="stock-basic@example.com")
    product = _make_product(db_session, user.shop_id, sku="BASIC", stock_quantity=5)

    invoice = create_invoice(_create_payload([(product, 2)]), db_session, user)

    assert invoice.id
    assert _stock(db_session, product) == 3


def test_insufficient_stock_is_rejected_without_negative_stock(db_session, make_user):
    user = make_user(email="stock-insufficient@example.com")
    product = _make_product(db_session, user.shop_id, sku="LOW", stock_quantity=1)

    with pytest.raises(HTTPException) as exc:
        create_invoice(_create_payload([(product, 2)]), db_session, user)

    db_session.rollback()
    assert exc.value.status_code == 400
    assert _stock(db_session, product) == 1
    assert db_session.query(Invoice).count() == 0


def test_multi_item_invoice_failure_is_atomic(db_session, make_user):
    user = make_user(email="stock-atomic@example.com")
    product_a = _make_product(db_session, user.shop_id, sku="A", stock_quantity=10)
    product_b = _make_product(db_session, user.shop_id, sku="B", stock_quantity=0)

    with pytest.raises(HTTPException):
        create_invoice(_create_payload([(product_a, 2), (product_b, 1)]), db_session, user)

    db_session.rollback()
    assert _stock(db_session, product_a) == 10
    assert _stock(db_session, product_b) == 0
    assert db_session.query(Invoice).count() == 0


def test_duplicate_invoice_lines_are_aggregated_for_stock_validation(db_session, make_user):
    user = make_user(email="stock-duplicate@example.com")
    product = _make_product(db_session, user.shop_id, sku="DUP", stock_quantity=5)

    with pytest.raises(HTTPException) as exc:
        create_invoice(_create_payload([(product, 3), (product, 4)]), db_session, user)

    db_session.rollback()
    assert exc.value.status_code == 400
    assert _stock(db_session, product) == 5
    assert db_session.query(Invoice).count() == 0


def test_fractional_quantity_rejected_for_integer_stock(db_session, make_user):
    user = make_user(email="stock-fractional@example.com")
    product = _make_product(db_session, user.shop_id, sku="FRAC", stock_quantity=5)

    with pytest.raises(HTTPException) as exc:
        create_invoice(_create_payload([(product, Decimal("0.5"))]), db_session, user)

    db_session.rollback()
    assert exc.value.status_code == 400
    assert "Fractional stock quantity is not supported" in exc.value.detail
    assert _stock(db_session, product) == 5


def test_sequential_final_stock_sale_allows_only_one_invoice(db_session, make_user):
    user = make_user(email="stock-final@example.com")
    product = _make_product(db_session, user.shop_id, sku="FINAL", stock_quantity=1)

    first = create_invoice(_create_payload([(product, 1)]), db_session, user)
    assert first.id

    with pytest.raises(HTTPException):
        create_invoice(_create_payload([(product, 1)]), db_session, user)

    db_session.rollback()
    assert _stock(db_session, product) == 0
    assert db_session.query(Invoice).count() == 1


def test_invoice_creation_rollback_restores_stock(db_session, make_user, monkeypatch):
    user = make_user(email="stock-rollback@example.com")
    product = _make_product(db_session, user.shop_id, sku="ROLL", stock_quantity=5)

    def fail_commit():
        raise RuntimeError("forced commit failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    with pytest.raises(RuntimeError):
        create_invoice(_create_payload([(product, 2)]), db_session, user)

    assert _stock(db_session, product) == 5
    assert db_session.query(Invoice).count() == 0


def test_invoice_edit_quantity_increase_and_decrease_adjust_stock(db_session, make_user):
    user = make_user(email="stock-edit-quantity@example.com")
    product = _make_product(db_session, user.shop_id, sku="EDITQ", stock_quantity=10)

    invoice = create_invoice(_create_payload([(product, 2)]), db_session, user)
    assert _stock(db_session, product) == 8

    update_invoice(invoice.id, _update_payload([(product, 4)]), db_session, user)
    assert _stock(db_session, product) == 6

    update_invoice(invoice.id, _update_payload([(product, 1)]), db_session, user)
    assert _stock(db_session, product) == 9


def test_invoice_edit_product_replacement_adjusts_both_products(db_session, make_user):
    user = make_user(email="stock-edit-replace@example.com")
    product_a = _make_product(db_session, user.shop_id, sku="OLD", stock_quantity=10)
    product_b = _make_product(db_session, user.shop_id, sku="NEW", stock_quantity=10)

    invoice = create_invoice(_create_payload([(product_a, 3)]), db_session, user)
    assert _stock(db_session, product_a) == 7
    assert _stock(db_session, product_b) == 10

    update_invoice(invoice.id, _update_payload([(product_b, 4)]), db_session, user)

    assert _stock(db_session, product_a) == 10
    assert _stock(db_session, product_b) == 6


def test_invoice_edit_insufficient_stock_rolls_back(db_session, make_user):
    user = make_user(email="stock-edit-insufficient@example.com")
    product_a = _make_product(db_session, user.shop_id, sku="EDITA", stock_quantity=5)
    product_b = _make_product(db_session, user.shop_id, sku="EDITB", stock_quantity=0)

    invoice = create_invoice(_create_payload([(product_a, 2)]), db_session, user)
    assert _stock(db_session, product_a) == 3

    with pytest.raises(HTTPException):
        update_invoice(invoice.id, _update_payload([(product_b, 1)]), db_session, user)

    db_session.rollback()
    assert _stock(db_session, product_a) == 3
    assert _stock(db_session, product_b) == 0


def test_repeated_cancellation_does_not_change_stock(db_session, make_user):
    user = make_user(email="stock-cancel@example.com")
    product = _make_product(db_session, user.shop_id, sku="CANCEL", stock_quantity=5)

    invoice = create_invoice(_create_payload([(product, 2)]), db_session, user)
    assert _stock(db_session, product) == 3

    delete_invoice(invoice.id, db_session, user)
    delete_invoice(invoice.id, db_session, user)

    assert _stock(db_session, product) == 3


def test_invoice_cannot_sell_other_shop_product(db_session, make_user):
    seller = make_user(email="stock-tenant-seller@example.com")
    other = make_user(email="stock-tenant-other@example.com")
    other_product = _make_product(db_session, other.shop_id, sku="OTHER", stock_quantity=5)

    with pytest.raises(HTTPException) as exc:
        create_invoice(_create_payload([(other_product, 1)]), db_session, seller)

    db_session.rollback()
    assert exc.value.status_code == 404
    assert _stock(db_session, other_product) == 5
