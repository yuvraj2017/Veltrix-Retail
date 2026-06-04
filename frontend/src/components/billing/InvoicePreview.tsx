import { Mail, MapPin, Phone } from 'lucide-react'
import type { Invoice } from '../../features/billing/types'

type ShopInfo = {
  name: string
  logoUrl?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  ownerName?: string | null
}

type InvoicePreviewProps = {
  invoice: Invoice
  shopInfo: ShopInfo
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const money = (value: string | number) => {
  const amount = Number(value || 0)
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const formatDate = (value: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const resolveImageUrl = (path?: string | null) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path}`
}

const getInitial = (name: string) => {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'S'
}

export default function InvoicePreview({
  invoice,
  shopInfo,
}: InvoicePreviewProps) {
  const logoUrl = resolveImageUrl(shopInfo.logoUrl)

  const customerAddress = [
    invoice.customer_address_snapshot,
    invoice.customer_city_snapshot,
    invoice.customer_state_snapshot,
    invoice.customer_pincode_snapshot,
  ]
    .filter(Boolean)
    .join(', ')

  const shopAddress = [
    shopInfo.address,
    shopInfo.city,
    shopInfo.state,
    shopInfo.pincode,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    // NOTE: The invoice itself always stays white for print correctness.
    // Dark mode only applies to the outer shell (handled in InvoicePreviewPage).
    // The invoice-print-area is intentionally kept light (bg-white) so PDFs/prints are always clean.
    <div
      id="invoice-print-area"
      className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.4)] print:shadow-none"
    >
      <div className="invoice-page">

        {/* Top Brand Header */}
        <div className="pb-4">
          <div className="grid items-start gap-5 sm:grid-cols-[220px_1fr]">
            <div className="flex justify-center sm:justify-start">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={shopInfo.name}
                  className="h-20 w-auto max-w-[200px] object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-2xl font-black text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)]">
                  {getInitial(shopInfo.name)}
                </div>
              )}
            </div>

            <div className="text-center sm:text-right">
              <h1 className="text-[24px] font-black tracking-[-0.04em] text-slate-950">
                {shopInfo.name}
              </h1>

              {shopInfo.ownerName && (
                <p className="mt-1 text-[12px] font-semibold text-slate-600">
                  Proprietor: {shopInfo.ownerName}
                </p>
              )}

              {shopAddress && (
                <div className="mt-1.5 flex items-start justify-center gap-1.5 text-[11px] font-medium leading-5 text-slate-600 sm:justify-end">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span className="max-w-[360px]">{shopAddress}</span>
                </div>
              )}

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600 sm:justify-end">
                {shopInfo.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={12} className="text-indigo-600" />
                    {shopInfo.phone}
                  </span>
                )}
                {shopInfo.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={12} className="text-indigo-600" />
                    {shopInfo.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Title Band */}
        <div className="mb-6 flex items-center gap-4">
          <div className="h-[10px] flex-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
          <h2 className="text-[42px] font-black uppercase tracking-[-0.06em] text-slate-800">
            Invoice
          </h2>
          <div className="h-[10px] w-[52px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
        </div>

        {/* Customer + Meta */}
        <div className="grid gap-6 pb-6 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Invoice To:
            </p>

            <h3 className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
              {invoice.customer_name_snapshot}
            </h3>

            <div className="mt-3 space-y-1.5 text-[13px] font-medium leading-5 text-slate-600">
              {invoice.customer_phone_snapshot && (
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-indigo-600" />
                  {invoice.customer_phone_snapshot}
                </p>
              )}
              {invoice.customer_email_snapshot && (
                <p className="flex items-center gap-2">
                  <Mail size={13} className="text-indigo-600" />
                  {invoice.customer_email_snapshot}
                </p>
              )}
              <p>{customerAddress || 'Address not added'}</p>
            </div>
          </div>

          <div className="sm:pl-6">
            <div className="rounded-[22px] border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/90 p-5 shadow-[0_14px_34px_rgba(79,70,229,0.08)]">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                  Invoice Details
                </p>
              </div>
              <div className="space-y-3 text-[14px]">
                <MetaRow label="Invoice#" value={invoice.invoice_number} />
                <MetaRow label="Date" value={formatDate(invoice.invoice_date)} />
                <MetaRow label="Payment" value={invoice.payment_status || 'pending'} />
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-hidden rounded-[18px] border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-white">
            <div>Sl.</div>
            <div>Item Description</div>
            <div>Price</div>
            <div>Qty.</div>
            <div className="text-right">Total</div>
          </div>

          <div>
            {invoice.items.map((item, index) => (
              <div
                key={item.id}
                className={`invoice-row grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] items-center px-4 py-4 text-[13px] ${
                  index % 2 === 0 ? 'bg-slate-50' : 'bg-white'
                }`}
              >
                <div className="font-black text-slate-700">{index + 1}</div>

                <div>
                  <p className="font-black tracking-[0.01em] text-slate-900">
                    {item.product_name_snapshot}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                    Code: {item.product_code}
                    {Number(item.discount_percentage) > 0
                      ? ` • Discount: ${Number(item.discount_percentage)}%`
                      : ''}
                  </p>
                </div>

                <div className="font-black text-slate-700">{money(item.mrp)}</div>
                <div className="font-black text-slate-700">{Number(item.quantity)}</div>
                <div className="text-right font-black text-slate-900">
                  {money(item.total_selling_price)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lower Summary */}
        <div className="mt-5 grid gap-8 sm:grid-cols-[1fr_340px]">
          <div>
            <p className="text-[16px] font-black tracking-[0.01em] text-slate-800">
              Thank you for your business
            </p>

            <div className="mt-6">
              <h4 className="text-[16px] font-black text-slate-800">
                Terms & Conditions
              </h4>
              <p className="mt-2 max-w-[480px] text-[11px] leading-6 text-slate-600">
                Goods once sold will not be taken back unless otherwise agreed.
                Please verify all items at the time of billing. Payment related
                issues should be referenced with the invoice number.
              </p>
            </div>
          </div>

          <div>
            <div className="space-y-2 text-[14px]">
              <SummaryRow label="Sub Total:" value={money(invoice.subtotal_amount)} />
              <SummaryRow label="Tax:" value={money(invoice.total_tax_amount)} />
              <SummaryRow
                label="Discount:"
                value={`-${money(invoice.total_discount_amount)}`}
              />
              <SummaryRow label="Paid:" value={money(invoice.paid_amount)} />
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-indigo-200 bg-white shadow-[0_18px_36px_rgba(79,70,229,0.10)]">
              <div className="bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-5 py-4 text-white">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[13px] font-black uppercase tracking-[0.16em] text-white/90">
                    Grand Total
                  </span>
                  <span className="text-[28px] font-black tracking-[-0.04em]">
                    {money(invoice.final_amount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-[11px] font-semibold text-slate-500">
                <span>Remaining</span>
                <span className="font-black text-rose-600">
                  {money(invoice.remaining_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between gap-6 border-t-4 border-indigo-500 pt-6">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-slate-700">
            <span>{shopInfo.phone || 'Phone'}</span>
            <span className="mx-3 text-slate-400">|</span>
            <span>{shopAddress || 'Address'}</span>
            {shopInfo.email && (
              <>
                <span className="mx-3 text-slate-400">|</span>
                <span>{shopInfo.email}</span>
              </>
            )}
          </div>

          <div className="min-w-[180px] text-center">
            <div className="mx-auto mb-3 h-px w-[150px] bg-slate-400" />
            <p className="text-[13px] font-black uppercase tracking-[0.08em] text-slate-700">
              Authorised Sign
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-black tracking-[0.02em] text-slate-800">{label}</span>
      <span className="max-w-[150px] break-words text-right font-semibold text-slate-600">
        {value}
      </span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-black text-slate-800">{label}</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  )
}