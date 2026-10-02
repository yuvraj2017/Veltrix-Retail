from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.product import Product
from app.schemas.invoice import InvoiceCreate
from app.services.gst_service import GstLineInput, calculate_gst_invoice
from app.services.invoice_service import create_invoice, get_invoice


def _enable_gst(shop):
    shop.gst_enabled = True
    shop.gstin = "24AAAAA0000A1Z5"
    shop.state = "Gujarat"
    shop.gst_state_code = "24"


def _make_product(
    db_session,
    shop_id: int,
    *,
    sku: str,
    mrp: Decimal = Decimal("1000.00"),
    gst_rate: Decimal = Decimal("18.00"),
    hsn_sac: str = "6109",
    stock_quantity: int = 10,
) -> Product:
    product = Product(
        shop_id=shop_id,
        name=f"GST Product {sku}",
        sku=sku,
        category="General",
        buying_price=Decimal("400.00"),
        mrp=mrp,
        selling_price=mrp,
        hsn_sac=hsn_sac,
        gst_rate=gst_rate,
        stock_quantity=stock_quantity,
        low_stock_threshold=1,
        unit="pcs",
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _payload(
    product: Product,
    *,
    customer_state: str | None = "Gujarat",
    customer_gst: str | None = "24BBBBB0000B1Z5",
    discount_percentage: Decimal = Decimal("0.00"),
    total_payable_amount: Decimal | None = None,
) -> InvoiceCreate:
    body = {
        "customer": {
            "first_name": "GST",
            "last_name": "Customer",
            "phone": "9000000000",
            "state": customer_state,
            "gst_number": customer_gst,
        },
        "items": [
            {
                "product_id": product.id,
                "product_code": product.sku,
                "quantity": 1,
                "discount_percentage": discount_percentage,
            }
        ],
        "invoice_date": date(2026, 10, 1),
        "payment_status": "pending",
        "payment_mode": "cash",
        "paid_amount": 0,
        "total_tax_amount": 9999,
        "invoice_status": "saved",
    }
    if total_payable_amount is not None:
        body["total_payable_amount"] = total_payable_amount
    return InvoiceCreate.model_validate(body)


def test_non_gst_invoice_keeps_tax_zero(db_session, make_user):
    user = make_user(email="phase2b-non-gst@example.com")
    product = _make_product(
        db_session,
        user.shop_id,
        sku="GST-ZERO",
        gst_rate=Decimal("18.00"),
    )

    invoice = create_invoice(_payload(product), db_session, user)

    assert invoice.tax_treatment == "non_gst"
    assert invoice.total_tax_amount == Decimal("0.00")
    assert invoice.final_amount == Decimal("1000.00")
    assert invoice.items[0].total_tax_amount == Decimal("0.00")


def test_intra_state_gst_splits_cgst_and_sgst(db_session, make_user):
    user = make_user(email="phase2b-intra@example.com")
    _enable_gst(user.shop)
    product = _make_product(db_session, user.shop_id, sku="GST-INTRA")
    db_session.commit()

    invoice = create_invoice(_payload(product), db_session, user)
    item = invoice.items[0]

    assert invoice.tax_treatment == "intra_state"
    assert item.taxable_value == Decimal("1000.00")
    assert item.gst_rate == Decimal("18.00")
    assert item.cgst_amount == Decimal("90.00")
    assert item.sgst_amount == Decimal("90.00")
    assert item.igst_amount == Decimal("0.00")
    assert invoice.total_tax_amount == Decimal("180.00")
    assert invoice.final_amount == Decimal("1180.00")


def test_inter_state_gst_uses_igst(db_session, make_user):
    user = make_user(email="phase2b-inter@example.com")
    _enable_gst(user.shop)
    product = _make_product(db_session, user.shop_id, sku="GST-INTER")
    db_session.commit()

    invoice = create_invoice(
        _payload(product, customer_state="Maharashtra", customer_gst="27BBBBB0000B1Z5"),
        db_session,
        user,
    )
    item = invoice.items[0]

    assert invoice.tax_treatment == "inter_state"
    assert item.cgst_amount == Decimal("0.00")
    assert item.sgst_amount == Decimal("0.00")
    assert item.igst_amount == Decimal("180.00")
    assert invoice.total_tax_amount == Decimal("180.00")
    assert invoice.final_amount == Decimal("1180.00")


def test_discounted_item_calculates_gst_after_discount(db_session, make_user):
    user = make_user(email="phase2b-discount@example.com")
    _enable_gst(user.shop)
    product = _make_product(db_session, user.shop_id, sku="GST-DISCOUNT")
    db_session.commit()

    invoice = create_invoice(
        _payload(product, discount_percentage=Decimal("10.00")),
        db_session,
        user,
    )
    item = invoice.items[0]

    assert item.taxable_value == Decimal("900.00")
    assert item.cgst_amount == Decimal("81.00")
    assert item.sgst_amount == Decimal("81.00")
    assert invoice.total_tax_amount == Decimal("162.00")
    assert invoice.final_amount == Decimal("1062.00")


def test_gst_rounding_is_deterministic():
    result = calculate_gst_invoice(
        gst_enabled=True,
        seller_gstin="24AAAAA0000A1Z5",
        seller_state="Gujarat",
        seller_state_code="24",
        customer_gstin="24BBBBB0000B1Z5",
        customer_state="Gujarat",
        customer_state_code="24",
        lines=[
            GstLineInput(
                taxable_before_invoice_discount=Decimal("0.05"),
                gst_rate=Decimal("18.00"),
            )
        ],
        requested_taxable_payable_amount=Decimal("0.05"),
    )

    assert result.lines[0].total_tax_amount == Decimal("0.01")
    assert result.total_tax_amount == Decimal("0.01")
    assert result.final_amount == Decimal("0.06")


def test_invoice_stores_product_tax_snapshots(db_session, make_user):
    user = make_user(email="phase2b-snapshot@example.com")
    _enable_gst(user.shop)
    product = _make_product(
        db_session,
        user.shop_id,
        sku="GST-SNAPSHOT",
        gst_rate=Decimal("12.00"),
        hsn_sac="1234",
    )
    db_session.commit()

    invoice = create_invoice(_payload(product), db_session, user)
    item = invoice.items[0]

    product.hsn_sac = "9999"
    product.gst_rate = Decimal("28.00")
    db_session.commit()

    db_session.refresh(item)
    assert item.hsn_sac_snapshot == "1234"
    assert item.gst_rate == Decimal("12.00")


def test_gst_product_access_remains_tenant_scoped(db_session, make_user):
    user_a = make_user(email="phase2b-tenant-a@example.com")
    user_b = make_user(email="phase2b-tenant-b@example.com")
    _enable_gst(user_a.shop)
    product_b = _make_product(db_session, user_b.shop_id, sku="GST-OTHER")
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_invoice(_payload(product_b), db_session, user_a)

    assert exc.value.status_code == 404


def test_legacy_invoice_without_gst_snapshots_remains_readable(db_session, make_user):
    user = make_user(email="phase2b-legacy@example.com")
    invoice = Invoice(
        shop_id=user.shop_id,
        invoice_number="INV-LEGACY-001",
        customer_name_snapshot="Legacy Customer",
        customer_phone_snapshot="9000000000",
        invoice_date=date(2026, 1, 1),
        subtotal_amount=Decimal("100.00"),
        total_discount_amount=Decimal("0.00"),
        total_tax_amount=Decimal("0.00"),
        billed_amount=Decimal("100.00"),
        extra_discount_amount=Decimal("0.00"),
        final_amount=Decimal("100.00"),
        paid_amount=Decimal("0.00"),
        remaining_amount=Decimal("100.00"),
        total_buy_cost=Decimal("40.00"),
        total_profit=Decimal("60.00"),
        payment_status="pending",
        payment_mode="cash",
        invoice_status="saved",
        created_by=user.id,
    )
    db_session.add(invoice)
    db_session.flush()
    db_session.add(
        InvoiceItem(
            shop_id=user.shop_id,
            invoice_id=invoice.id,
            product_code="LEGACY",
            product_name_snapshot="Legacy Item",
            mrp=Decimal("100.00"),
            buy_price=Decimal("40.00"),
            quantity=Decimal("1.00"),
            discount_percentage=Decimal("0.00"),
            discount_amount_per_unit=Decimal("0.00"),
            total_discount_amount=Decimal("0.00"),
            selling_price_per_unit=Decimal("100.00"),
            total_selling_price=Decimal("100.00"),
            total_buy_cost=Decimal("40.00"),
            profit_per_unit=Decimal("60.00"),
            total_profit=Decimal("60.00"),
        )
    )
    db_session.commit()

    fetched = get_invoice(invoice.id, db_session, user)

    assert fetched.invoice_number == "INV-LEGACY-001"
    assert fetched.tax_treatment == "non_gst"
    assert fetched.items[0].total_tax_amount == Decimal("0.00")
