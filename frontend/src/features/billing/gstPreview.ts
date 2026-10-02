import type { CustomerPayload, LocalInvoiceItem } from './types'

export type GstPreview = {
  taxTreatment: 'non_gst' | 'intra_state' | 'inter_state' | 'undetermined'
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalTaxAmount: number
  grandTotal: number
  requiresCustomerState: boolean
}

type ShopTaxProfile = {
  gst_enabled?: boolean | null
  gstin?: string | null
  state?: string | null
  gst_state_code?: string | null
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getStateCode = (explicitCode?: string | null, gstin?: string | null) => {
  const cleanedCode = (explicitCode || '').trim()
  if (/^\d{2}$/.test(cleanedCode)) return cleanedCode

  const cleanedGstin = (gstin || '').trim()
  const gstinCode = cleanedGstin.slice(0, 2)
  return /^\d{2}$/.test(gstinCode) ? gstinCode : null
}

const getStateName = (state?: string | null) => {
  const cleaned = (state || '').trim().toLowerCase()
  return cleaned || null
}

export function calculateGstPreview({
  shop,
  customer,
  items,
  taxablePayableAmount,
}: {
  shop: ShopTaxProfile | null
  customer: CustomerPayload
  items: LocalInvoiceItem[]
  taxablePayableAmount: number
}): GstPreview {
  const lineTaxableBeforeDiscount = items.map((item) => money(Number(item.total_selling_price || 0)))
  const taxableBeforeDiscount = money(
    lineTaxableBeforeDiscount.reduce((sum, value) => sum + value, 0),
  )
  const taxableValue = money(Math.min(Math.max(taxablePayableAmount, 0), taxableBeforeDiscount))
  const hasGstItems = items.some((item) => Number(item.gst_rate || 0) > 0)

  if (!shop?.gst_enabled || !shop.gstin || !hasGstItems || taxableBeforeDiscount <= 0) {
    return {
      taxTreatment: 'non_gst',
      taxableValue,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      grandTotal: taxableValue,
      requiresCustomerState: false,
    }
  }

  const sellerCode = getStateCode(shop.gst_state_code, shop.gstin)
  const customerCode = getStateCode(null, customer.gst_number)
  const sellerState = getStateName(shop.state)
  const customerState = getStateName(customer.state)

  let taxTreatment: GstPreview['taxTreatment'] = 'undetermined'
  if (sellerCode && customerCode) {
    taxTreatment = sellerCode === customerCode ? 'intra_state' : 'inter_state'
  } else if (sellerState && customerState) {
    taxTreatment = sellerState === customerState ? 'intra_state' : 'inter_state'
  }

  if (taxTreatment === 'undetermined') {
    return {
      taxTreatment,
      taxableValue,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      grandTotal: taxableValue,
      requiresCustomerState: true,
    }
  }

  let remainingTaxable = taxableValue
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0

  items.forEach((item, index) => {
    const sourceTaxable = lineTaxableBeforeDiscount[index] || 0
    const allocatedTaxable =
      index === items.length - 1
        ? money(remainingTaxable)
        : money(taxableBeforeDiscount > 0 ? (sourceTaxable / taxableBeforeDiscount) * taxableValue : 0)

    remainingTaxable = money(remainingTaxable - allocatedTaxable)
    const lineTax = money((allocatedTaxable * Number(item.gst_rate || 0)) / 100)

    if (taxTreatment === 'intra_state') {
      const cgst = money(lineTax / 2)
      cgstAmount = money(cgstAmount + cgst)
      sgstAmount = money(sgstAmount + money(lineTax - cgst))
    } else {
      igstAmount = money(igstAmount + lineTax)
    }
  })

  const totalTaxAmount = money(cgstAmount + sgstAmount + igstAmount)

  return {
    taxTreatment,
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTaxAmount,
    grandTotal: money(taxableValue + totalTaxAmount),
    requiresCustomerState: false,
  }
}
