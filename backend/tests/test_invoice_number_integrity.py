from datetime import date, timedelta
from decimal import Decimal
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.invoice import Invoice
from app.models.product import Product
from app.schemas.invoice import InvoiceCreate
from app.services.invoice_service import _generate_invoice_number, create_invoice


def _make_product(db_session, shop_id: int, sku: str = "SKU-001") -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"Product {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("40.00"),
        mrp=Decimal("100.00"),
        selling_price=Decimal("100.00"),
        stock_quantity=100,
        low_stock_threshold=5,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _invoice_payload(product: Product, invoice_date: date) -> InvoiceCreate:
    return InvoiceCreate.model_validate(
        {
            "customer": {
                "first_name": "Retail",
                "last_name": "Customer",
                "phone": "9000000000",
            },
            "items": [
                {
                    "product_id": product.id,
                    "product_code": product.sku,
                    "quantity": 1,
                    "discount_percentage": 0,
                }
            ],
            "invoice_date": invoice_date,
            "payment_status": "pending",
            "payment_mode": "cash",
            "paid_amount": 0,
            "total_tax_amount": 0,
            "invoice_status": "saved",
        }
    )


def _minimal_invoice(shop_id: int, invoice_number: str, invoice_date: date) -> Invoice:
    return Invoice(
        shop_id=shop_id,
        invoice_number=invoice_number,
        customer_name_snapshot="Existing Customer",
        customer_phone_snapshot="9000000000",
        invoice_date=invoice_date,
        subtotal_amount=Decimal("0.00"),
        total_discount_amount=Decimal("0.00"),
        total_tax_amount=Decimal("0.00"),
        billed_amount=Decimal("0.00"),
        extra_discount_amount=Decimal("0.00"),
        final_amount=Decimal("0.00"),
        paid_amount=Decimal("0.00"),
        remaining_amount=Decimal("0.00"),
        total_buy_cost=Decimal("0.00"),
        total_profit=Decimal("0.00"),
        payment_status="pending",
        invoice_status="saved",
    )


def test_invoice_creation_preserves_existing_format(db_session, make_user):
    user = make_user(email="invoice-format@example.com")
    product = _make_product(db_session, user.shop_id)
    invoice_date = date(2026, 9, 27)

    invoice = create_invoice(_invoice_payload(product, invoice_date), db_session, user)

    assert invoice.invoice_number == "INV-20260927-001"


def test_invoice_sequence_increments_and_resets_daily(db_session, make_user):
    user = make_user(email="invoice-sequence@example.com")
    product = _make_product(db_session, user.shop_id)
    invoice_date = date(2026, 9, 27)
    next_date = invoice_date + timedelta(days=1)

    first = create_invoice(_invoice_payload(product, invoice_date), db_session, user)
    second = create_invoice(_invoice_payload(product, invoice_date), db_session, user)
    next_day = create_invoice(_invoice_payload(product, next_date), db_session, user)

    assert first.invoice_number == "INV-20260927-001"
    assert second.invoice_number == "INV-20260927-002"
    assert next_day.invoice_number == "INV-20260928-001"


def test_separate_shops_have_independent_invoice_sequences(db_session, make_user):
    first_user = make_user(email="invoice-shop-one@example.com")
    second_user = make_user(email="invoice-shop-two@example.com")
    invoice_date = date(2026, 9, 27)

    first_product = _make_product(db_session, first_user.shop_id, sku="SHOP-1")
    second_product = _make_product(db_session, second_user.shop_id, sku="SHOP-2")

    first_invoice = create_invoice(
        _invoice_payload(first_product, invoice_date),
        db_session,
        first_user,
    )
    second_invoice = create_invoice(
        _invoice_payload(second_product, invoice_date),
        db_session,
        second_user,
    )

    assert first_invoice.invoice_number == "INV-20260927-001"
    assert second_invoice.invoice_number == "INV-20260927-001"


def test_database_rejects_duplicate_invoice_number_in_same_shop(db_session, make_user):
    user = make_user(email="invoice-duplicate@example.com")
    invoice_date = date(2026, 9, 27)

    db_session.add(_minimal_invoice(user.shop_id, "INV-20260927-001", invoice_date))
    db_session.commit()

    db_session.add(_minimal_invoice(user.shop_id, "INV-20260927-001", invoice_date))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_database_allows_same_invoice_number_in_different_shops(db_session, make_user):
    first_user = make_user(email="invoice-scope-one@example.com")
    second_user = make_user(email="invoice-scope-two@example.com")
    invoice_date = date(2026, 9, 27)

    db_session.add(_minimal_invoice(first_user.shop_id, "INV-20260927-001", invoice_date))
    db_session.add(_minimal_invoice(second_user.shop_id, "INV-20260927-001", invoice_date))
    db_session.commit()

    assert db_session.query(Invoice).count() == 2


def test_sequence_allocation_does_not_depend_on_invoice_count(db_session, make_user):
    user = make_user(email="invoice-allocation@example.com")
    invoice_date = date(2026, 9, 27)

    first_number = _generate_invoice_number(db_session, user.shop_id, invoice_date)
    second_number = _generate_invoice_number(db_session, user.shop_id, invoice_date)

    assert first_number == "INV-20260927-001"
    assert second_number == "INV-20260927-002"
    assert db_session.query(Invoice).count() == 0


def test_sequence_allocation_can_recover_after_rollback(db_session, make_user):
    user = make_user(email="invoice-rollback@example.com")
    invoice_date = date(2026, 9, 27)

    allocated_number = _generate_invoice_number(db_session, user.shop_id, invoice_date)
    db_session.rollback()
    recovered_number = _generate_invoice_number(db_session, user.shop_id, invoice_date)

    assert allocated_number == "INV-20260927-001"
    assert recovered_number == "INV-20260927-002"


def test_migration_duplicate_precheck_fails_clearly(monkeypatch):
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260927_0006_invoice_number_integrity.py"
    )
    spec = importlib.util.spec_from_file_location("invoice_number_integrity", migration_path)
    migration = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(migration)

    class FakeResult:
        def mappings(self):
            return self

        def all(self):
            return [
                {
                    "shop_id": 1,
                    "invoice_number": "INV-20260927-001",
                    "duplicate_count": 2,
                }
            ]

    class FakeBind:
        def execute(self, _statement):
            return FakeResult()

    class FakeOp:
        def get_bind(self):
            return FakeBind()

    monkeypatch.setattr(migration, "op", FakeOp())
    monkeypatch.setattr(migration, "_has_table", lambda table_name: table_name == "invoices")

    with pytest.raises(RuntimeError, match="duplicate .*shop_id=1"):
        migration._assert_no_duplicate_invoice_numbers()
