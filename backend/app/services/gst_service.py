from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status


GST_TREATMENT_NON_GST = "non_gst"
GST_TREATMENT_INTRA_STATE = "intra_state"
GST_TREATMENT_INTER_STATE = "inter_state"


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money(value) -> Decimal:
    return to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def rate(value) -> Decimal:
    return to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _clean_state(value: str | None) -> str | None:
    cleaned = _clean(value)
    return cleaned.lower() if cleaned else None


def _gst_state_code_from_gstin(gstin: str | None) -> str | None:
    cleaned = _clean(gstin)
    if cleaned and len(cleaned) >= 2 and cleaned[:2].isdigit():
        return cleaned[:2]
    return None


def resolve_gst_state_code(*, explicit_code: str | None = None, gstin: str | None = None) -> str | None:
    cleaned_code = _clean(explicit_code)
    if cleaned_code:
        return cleaned_code[:2]
    return _gst_state_code_from_gstin(gstin)


@dataclass(frozen=True)
class GstLineInput:
    taxable_before_invoice_discount: Decimal
    gst_rate: Decimal


@dataclass(frozen=True)
class GstLineResult:
    taxable_value: Decimal
    gst_rate: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal


@dataclass(frozen=True)
class GstInvoiceResult:
    tax_treatment: str
    seller_gstin: str | None
    seller_state: str | None
    seller_state_code: str | None
    customer_gstin: str | None
    customer_state: str | None
    customer_state_code: str | None
    taxable_before_invoice_discount: Decimal
    taxable_value: Decimal
    extra_discount_amount: Decimal
    total_tax_amount: Decimal
    final_amount: Decimal
    lines: list[GstLineResult]


def determine_tax_treatment(
    *,
    gst_enabled: bool,
    seller_gstin: str | None,
    seller_state: str | None,
    seller_state_code: str | None,
    customer_gstin: str | None,
    customer_state: str | None,
    customer_state_code: str | None,
    has_taxable_gst_items: bool,
) -> str:
    if not gst_enabled or not _clean(seller_gstin) or not has_taxable_gst_items:
        return GST_TREATMENT_NON_GST

    seller_code = resolve_gst_state_code(explicit_code=seller_state_code, gstin=seller_gstin)
    customer_code = resolve_gst_state_code(explicit_code=customer_state_code, gstin=customer_gstin)

    if seller_code and customer_code:
        return GST_TREATMENT_INTRA_STATE if seller_code == customer_code else GST_TREATMENT_INTER_STATE

    seller_state_clean = _clean_state(seller_state)
    customer_state_clean = _clean_state(customer_state)

    if seller_state_clean and customer_state_clean:
        return (
            GST_TREATMENT_INTRA_STATE
            if seller_state_clean == customer_state_clean
            else GST_TREATMENT_INTER_STATE
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Customer state is required for GST invoices when the shop is GST enabled "
            "and a product has a GST rate."
        ),
    )


def _line_tax(taxable_value: Decimal, gst_rate: Decimal, treatment: str) -> GstLineResult:
    taxable_value = money(taxable_value)
    gst_rate = rate(gst_rate)
    total_tax = money(taxable_value * gst_rate / Decimal("100"))

    if treatment == GST_TREATMENT_INTRA_STATE:
        cgst_amount = money(total_tax / Decimal("2"))
        sgst_amount = money(total_tax - cgst_amount)
        split_rate = rate(gst_rate / Decimal("2"))
        return GstLineResult(
            taxable_value=taxable_value,
            gst_rate=gst_rate,
            cgst_rate=split_rate,
            cgst_amount=cgst_amount,
            sgst_rate=split_rate,
            sgst_amount=sgst_amount,
            igst_rate=Decimal("0.00"),
            igst_amount=Decimal("0.00"),
            total_tax_amount=money(cgst_amount + sgst_amount),
        )

    if treatment == GST_TREATMENT_INTER_STATE:
        return GstLineResult(
            taxable_value=taxable_value,
            gst_rate=gst_rate,
            cgst_rate=Decimal("0.00"),
            cgst_amount=Decimal("0.00"),
            sgst_rate=Decimal("0.00"),
            sgst_amount=Decimal("0.00"),
            igst_rate=gst_rate,
            igst_amount=total_tax,
            total_tax_amount=total_tax,
        )

    return GstLineResult(
        taxable_value=taxable_value,
        gst_rate=Decimal("0.00"),
        cgst_rate=Decimal("0.00"),
        cgst_amount=Decimal("0.00"),
        sgst_rate=Decimal("0.00"),
        sgst_amount=Decimal("0.00"),
        igst_rate=Decimal("0.00"),
        igst_amount=Decimal("0.00"),
        total_tax_amount=Decimal("0.00"),
    )


def calculate_gst_invoice(
    *,
    gst_enabled: bool,
    seller_gstin: str | None,
    seller_state: str | None,
    seller_state_code: str | None,
    customer_gstin: str | None,
    customer_state: str | None,
    customer_state_code: str | None,
    lines: list[GstLineInput],
    requested_taxable_payable_amount: Decimal | None,
) -> GstInvoiceResult:
    normalized_lines = [
        GstLineInput(
            taxable_before_invoice_discount=money(line.taxable_before_invoice_discount),
            gst_rate=rate(line.gst_rate),
        )
        for line in lines
    ]

    taxable_before_discount = money(
        sum((line.taxable_before_invoice_discount for line in normalized_lines), Decimal("0.00"))
    )

    if requested_taxable_payable_amount is None:
        taxable_after_discount = taxable_before_discount
    else:
        taxable_after_discount = money(requested_taxable_payable_amount)

    if taxable_after_discount > taxable_before_discount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total payable cannot be greater than taxable billed amount",
        )

    if taxable_after_discount < Decimal("0.00"):
        taxable_after_discount = Decimal("0.00")

    extra_discount = money(taxable_before_discount - taxable_after_discount)
    has_taxable_gst_items = any(line.gst_rate > Decimal("0.00") for line in normalized_lines)

    resolved_seller_code = resolve_gst_state_code(
        explicit_code=seller_state_code,
        gstin=seller_gstin,
    )
    resolved_customer_code = resolve_gst_state_code(
        explicit_code=customer_state_code,
        gstin=customer_gstin,
    )
    treatment = determine_tax_treatment(
        gst_enabled=gst_enabled,
        seller_gstin=seller_gstin,
        seller_state=seller_state,
        seller_state_code=resolved_seller_code,
        customer_gstin=customer_gstin,
        customer_state=customer_state,
        customer_state_code=resolved_customer_code,
        has_taxable_gst_items=has_taxable_gst_items,
    )

    line_results: list[GstLineResult] = []
    remaining_taxable = taxable_after_discount
    remaining_source = taxable_before_discount

    for index, line in enumerate(normalized_lines):
        if taxable_before_discount == Decimal("0.00"):
            line_taxable = Decimal("0.00")
        elif index == len(normalized_lines) - 1:
            line_taxable = remaining_taxable
        else:
            line_taxable = money(
                taxable_after_discount
                * line.taxable_before_invoice_discount
                / taxable_before_discount
            )
            remaining_taxable = money(remaining_taxable - line_taxable)
            remaining_source = money(remaining_source - line.taxable_before_invoice_discount)

        if remaining_source <= Decimal("0.00") and index < len(normalized_lines) - 1:
            remaining_taxable = Decimal("0.00")

        line_results.append(_line_tax(line_taxable, line.gst_rate, treatment))

    total_tax = money(sum((line.total_tax_amount for line in line_results), Decimal("0.00")))

    return GstInvoiceResult(
        tax_treatment=treatment,
        seller_gstin=_clean(seller_gstin),
        seller_state=_clean(seller_state),
        seller_state_code=resolved_seller_code,
        customer_gstin=_clean(customer_gstin),
        customer_state=_clean(customer_state),
        customer_state_code=resolved_customer_code,
        taxable_before_invoice_discount=taxable_before_discount,
        taxable_value=taxable_after_discount,
        extra_discount_amount=extra_discount,
        total_tax_amount=total_tax,
        final_amount=money(taxable_after_discount + total_tax),
        lines=line_results,
    )
