// import { Mail, MapPin, Phone } from 'lucide-react'
// import type { Invoice } from '../../features/billing/types'

// type ShopInfo = {
//   name: string
//   logoUrl?: string | null
//   email?: string | null
//   phone?: string | null
//   address?: string | null
//   city?: string | null
//   state?: string | null
//   pincode?: string | null
//   ownerName?: string | null
// }

// type InvoicePreviewDocumentProps = {
//   invoice: Invoice
//   shopInfo: ShopInfo
// }

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// const money = (value: string | number) => {
//   const amount = Number(value || 0)
//   return amount.toLocaleString('en-IN', {
//     style: 'currency',
//     currency: 'INR',
//     maximumFractionDigits: 2,
//   })
// }

// const formatDate = (value: string) => {
//   if (!value) return '-'
//   return new Date(value).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: '2-digit',
//     year: 'numeric',
//   })
// }

// const formatDateTime = (value?: string | null) => {
//   if (!value) return '-'
//   return new Date(value).toLocaleString('en-IN', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//     hour: '2-digit',
//     minute: '2-digit',
//   })
// }

// const resolveImageUrl = (path?: string | null) => {
//   if (!path) return null
//   if (path.startsWith('http://') || path.startsWith('https://')) return path
//   return `${API_BASE_URL}${path}`
// }

// const getInitial = (name: string) => {
//   return name?.trim()?.charAt(0)?.toUpperCase() || 'S'
// }

// export default function InvoicePreviewDocument({
//   invoice,
//   shopInfo,
// }: InvoicePreviewDocumentProps) {
//   const logoUrl = resolveImageUrl(shopInfo.logoUrl)
//   const billedAmount = Number(invoice.billed_amount || invoice.final_amount || 0)
//   const extraDiscountAmount = Number(invoice.extra_discount_amount || 0)
//   const totalDiscountAmount = Number(invoice.total_discount_amount || 0)
//   const itemDiscountAmount = Math.max(totalDiscountAmount - extraDiscountAmount, 0)
//   const taxableValue = invoice.items.reduce(
//     (sum, item) => sum + Number(item.taxable_value || 0),
//     0,
//   )
//   const cgstAmount = invoice.items.reduce((sum, item) => sum + Number(item.cgst_amount || 0), 0)
//   const sgstAmount = invoice.items.reduce((sum, item) => sum + Number(item.sgst_amount || 0), 0)
//   const igstAmount = invoice.items.reduce((sum, item) => sum + Number(item.igst_amount || 0), 0)

//   const customerAddress = [
//     invoice.customer_address_snapshot,
//     invoice.customer_city_snapshot,
//     invoice.customer_state_snapshot,
//     invoice.customer_pincode_snapshot,
//   ]
//     .filter(Boolean)
//     .join(', ')

//   const shopAddress = [
//     shopInfo.address,
//     shopInfo.city,
//     shopInfo.state,
//     shopInfo.pincode,
//   ]
//     .filter(Boolean)
//     .join(', ')

//   return (
//     <div
//       id="invoice-print-area"
//       className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.4)] print:shadow-none"
//     >
//       <div className="invoice-page">
//         <div className="pb-4">
//           <div className="grid items-start gap-5 sm:grid-cols-[220px_1fr]">
//             <div className="flex justify-center sm:justify-start">
//               {logoUrl ? (
//                 <img
//                   src={logoUrl}
//                   alt={shopInfo.name}
//                   className="h-20 w-auto max-w-[200px] object-contain"
//                   decoding="async"
//                 />
//               ) : (
//                 <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-2xl font-black text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)]">
//                   {getInitial(shopInfo.name)}
//                 </div>
//               )}
//             </div>

//             <div className="text-center sm:text-right">
//               <h1 className="text-[24px] font-black tracking-[-0.04em] text-slate-950">
//                 {shopInfo.name}
//               </h1>

//               {shopInfo.ownerName && (
//                 <p className="mt-1 text-[12px] font-semibold text-slate-600">
//                   Proprietor: {shopInfo.ownerName}
//                 </p>
//               )}

//               {shopAddress && (
//                 <div className="mt-1.5 flex items-start justify-center gap-1.5 text-[11px] font-medium leading-5 text-slate-600 sm:justify-end">
//                   <MapPin size={13} className="mt-0.5 shrink-0 text-indigo-600" />
//                   <span className="max-w-[360px]">{shopAddress}</span>
//                 </div>
//               )}

//               <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600 sm:justify-end">
//                 {invoice.seller_gst_number_snapshot && (
//                   <span>GSTIN: {invoice.seller_gst_number_snapshot}</span>
//                 )}
//                 {shopInfo.phone && (
//                   <span className="inline-flex items-center gap-1.5">
//                     <Phone size={12} className="text-indigo-600" />
//                     {shopInfo.phone}
//                   </span>
//                 )}
//                 {shopInfo.email && (
//                   <span className="inline-flex items-center gap-1.5">
//                     <Mail size={12} className="text-indigo-600" />
//                     {shopInfo.email}
//                   </span>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="mb-6 flex items-center gap-4">
//           <div className="h-[10px] flex-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//           <h2 className="text-[42px] font-black uppercase tracking-[-0.06em] text-slate-800">
//             Invoice
//           </h2>
//           <div className="h-[10px] w-[52px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//         </div>

//         <div className="grid gap-6 pb-6 sm:grid-cols-[1.2fr_0.8fr]">
//           <div>
//             <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
//               Invoice To:
//             </p>

//             <h3 className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
//               {invoice.customer_name_snapshot}
//             </h3>

//             <div className="mt-3 space-y-1.5 text-[13px] font-medium leading-5 text-slate-600">
//               {invoice.customer_phone_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Phone size={13} className="text-indigo-600" />
//                   {invoice.customer_phone_snapshot}
//                 </p>
//               )}
//               {invoice.customer_email_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Mail size={13} className="text-indigo-600" />
//                   {invoice.customer_email_snapshot}
//                 </p>
//               )}
//               <p>{customerAddress || 'Address not added'}</p>
//               {invoice.customer_gst_number_snapshot && (
//                 <p>GSTIN: {invoice.customer_gst_number_snapshot}</p>
//               )}
//             </div>
//           </div>

//           <div className="sm:pl-6">
//             <div className="rounded-[22px] border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/90 p-5 shadow-[0_14px_34px_rgba(79,70,229,0.08)]">
//               <div className="mb-3">
//                 <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
//                   Invoice Details
//                 </p>
//               </div>
//               <div className="space-y-3 text-[14px]">
//                 <MetaRow label="Invoice#" value={invoice.invoice_number} />
//                 <MetaRow label="Date" value={formatDate(invoice.invoice_date)} />
//                 <MetaRow label="Payment" value={invoice.payment_status || 'pending'} />
//                 <MetaRow label="Mode" value={invoice.payment_mode || '-'} />
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="overflow-hidden rounded-[18px] border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
//           <div className="grid grid-cols-[0.35fr_1.45fr_0.55fr_0.5fr_0.8fr_0.7fr_0.8fr] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-4 py-3 text-[10px] font-black uppercase tracking-[0.08em] text-white">
//             <div>Sl.</div>
//             <div>Item Description</div>
//             <div>HSN</div>
//             <div>Qty.</div>
//             <div className="text-right">Taxable</div>
//             <div className="text-right">GST</div>
//             <div className="text-right">Total</div>
//           </div>

//           <div>
//             {invoice.items.map((item, index) => (
//               <div
//                 key={item.id}
//                 className={`invoice-row grid grid-cols-[0.35fr_1.45fr_0.55fr_0.5fr_0.8fr_0.7fr_0.8fr] items-center px-4 py-4 text-[12px] ${
//                   index % 2 === 0 ? 'bg-slate-50' : 'bg-white'
//                 }`}
//               >
//                 <div className="font-black text-slate-700">{index + 1}</div>

//                 <div>
//                   <p className="font-black tracking-[0.01em] text-slate-900">
//                     {item.product_name_snapshot}
//                   </p>
//                   <p className="mt-1 text-[10px] font-semibold text-slate-500">
//                     {`Code: ${item.product_code}`}
//                     {Number(item.selling_price_per_unit) > 0
//                       ? ` • Rate: ${money(item.selling_price_per_unit)}`
//                       : ''}
//                     {Number(item.discount_percentage) > 0
//                       ? ` • Discount: ${Number(item.discount_percentage)}%`
//                       : ''}
//                   </p>
//                   {(Number(item.cgst_amount || 0) > 0 ||
//                     Number(item.sgst_amount || 0) > 0 ||
//                     Number(item.igst_amount || 0) > 0) && (
//                     <p className="mt-1 text-[10px] font-semibold text-slate-500">
//                       CGST {money(item.cgst_amount || 0)} | SGST {money(item.sgst_amount || 0)} | IGST {money(item.igst_amount || 0)}
//                     </p>
//                   )}
//                 </div>

//                 <div className="font-black text-slate-700">{item.hsn_sac_snapshot || '-'}</div>
//                 <div className="font-black text-slate-700">{Number(item.quantity)}</div>
//                 <div className="text-right font-black text-slate-900">
//                   {money(item.taxable_value || item.total_selling_price)}
//                 </div>
//                 <div className="text-right font-black text-slate-700">
//                   {Number(item.gst_rate || 0)}%
//                 </div>
//                 <div className="text-right font-black text-slate-900">
//                   {money(Number(item.taxable_value || item.total_selling_price) + Number(item.total_tax_amount || 0))}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         <div className="mt-5 grid gap-8 sm:grid-cols-[1fr_340px]">
//           <div>
//             <p className="text-[16px] font-black tracking-[0.01em] text-slate-800">
//               Thank you for your business
//             </p>

//             <div className="mt-6">
//               <h4 className="text-[16px] font-black text-slate-800">
//                 Terms & Conditions
//               </h4>
//               <p className="mt-2 max-w-[480px] text-[11px] leading-6 text-slate-600">
//                 Goods once sold will not be taken back unless otherwise agreed.
//                 Please verify all items at the time of billing. Payment related
//                 issues should be referenced with the invoice number.
//               </p>
//             </div>
//           </div>

//           <div>
//             <div className="space-y-2 text-[14px]">
//               <SummaryRow label="Sub Total:" value={money(invoice.subtotal_amount)} />
//               {itemDiscountAmount > 0 && (
//                 <SummaryRow label="Item Discount:" value={`-${money(itemDiscountAmount)}`} />
//               )}
//               {taxableValue > 0 && <SummaryRow label="Taxable Value:" value={money(taxableValue)} />}
//               {cgstAmount > 0 && <SummaryRow label="CGST:" value={money(cgstAmount)} />}
//               {sgstAmount > 0 && <SummaryRow label="SGST:" value={money(sgstAmount)} />}
//               {igstAmount > 0 && <SummaryRow label="IGST:" value={money(igstAmount)} />}
//               <SummaryRow label="Total GST:" value={money(invoice.total_tax_amount)} />
//               <SummaryRow label="Total Billed Amount:" value={money(billedAmount)} />
//               {extraDiscountAmount > 0 && (
//                 <SummaryRow label="Extra Discount:" value={`-${money(extraDiscountAmount)}`} />
//               )}
//               <SummaryRow label="Total Discount:" value={`-${money(totalDiscountAmount)}`} />
//               <SummaryRow label="Paid:" value={money(invoice.paid_amount)} />
//               <SummaryRow label="Balance Due:" value={money(invoice.remaining_amount)} />
//               <SummaryRow label="Payment Status:" value={invoice.payment_status || 'pending'} />
//             </div>

//             {invoice.payments?.length > 0 && (
//               <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
//                 <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
//                   Payment History
//                 </p>
//                 <div className="space-y-2">
//                   {invoice.payments.map((payment) => (
//                     <div key={payment.id} className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
//                       <div>
//                         <p className="font-black text-slate-800">
//                           {payment.payment_method.replaceAll('_', ' ')}
//                         </p>
//                         <p className="text-slate-500">
//                           {formatDateTime(payment.received_at)}
//                           {payment.payment_reference ? ` | Ref: ${payment.payment_reference}` : ''}
//                         </p>
//                       </div>
//                       <div className="font-black text-slate-900">{money(payment.amount)}</div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {invoice.returns?.length > 0 && (
//               <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 p-4">
//                 <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">
//                   Returns / Credit Notes
//                 </p>
//                 <div className="space-y-3">
//                   {invoice.returns.map((returnRecord) => (
//                     <div key={returnRecord.id} className="border-b border-rose-100 pb-3 last:border-b-0 last:pb-0">
//                       <div className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
//                         <div>
//                           <p className="font-black text-slate-800">
//                             {returnRecord.return_number} / {returnRecord.credit_note_number}
//                           </p>
//                           <p className="text-slate-500">
//                             {formatDateTime(returnRecord.completed_at)}
//                             {returnRecord.reason ? ` | ${returnRecord.reason}` : ''}
//                           </p>
//                         </div>
//                         <div className="font-black text-rose-700">-{money(returnRecord.total_amount)}</div>
//                       </div>
//                       <div className="mt-2 space-y-1 text-[10px] font-semibold text-slate-600">
//                         {returnRecord.items.map((item) => (
//                           <div key={item.id} className="flex justify-between gap-3">
//                             <span>{item.product_name_snapshot} x {Number(item.quantity)}</span>
//                             <span>{money(item.total_amount)}</span>
//                           </div>
//                         ))}
//                       </div>
//                       {returnRecord.refunds?.length > 0 && (
//                         <div className="mt-2 space-y-1 text-[10px] font-semibold text-slate-500">
//                           {returnRecord.refunds.map((refund) => (
//                             <div key={refund.id} className="flex justify-between gap-3">
//                               <span>Refund {refund.refund_method.replaceAll('_', ' ')}</span>
//                               <span>{money(refund.amount)}</span>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             <div className="mt-4 overflow-hidden rounded-[18px] border border-indigo-200 bg-white shadow-[0_18px_36px_rgba(79,70,229,0.10)]">
//               <div className="bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-5 py-4 text-white">
//                 <div className="flex items-center justify-between gap-4">
//                   <span className="text-[13px] font-black uppercase tracking-[0.16em] text-white/90">
//                     Total Payable
//                   </span>
//                   <span className="text-[28px] font-black tracking-[-0.04em]">
//                     {money(invoice.final_amount)}
//                   </span>
//                 </div>
//               </div>

//               <div className="flex items-center justify-between px-5 py-3 text-[11px] font-semibold text-slate-500">
//                 <span>Remaining</span>
//                 <span className="font-black text-rose-600">
//                   {money(invoice.remaining_amount)}
//                 </span>
//               </div>
//             </div>

//             {extraDiscountAmount > 0 && (
//               <p className="mt-3 text-right text-[11px] font-semibold leading-5 text-slate-500">
//                 Invoice payable was reduced by an extra discount of{' '}
//                 <span className="font-black text-rose-600">
//                   {money(extraDiscountAmount)}
//                 </span>
//                 .
//               </p>
//             )}
//           </div>
//         </div>

//         {invoice.notes && (
//           <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4">
//             <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
//               Notes
//             </p>
//             <p className="mt-2 text-[12px] leading-6 text-slate-700">{invoice.notes}</p>
//           </div>
//         )}

//         <div className="mt-8 flex items-end justify-between gap-6 border-t-4 border-indigo-500 pt-6">
//           <div className="text-[12px] font-semibold tracking-[0.04em] text-slate-700">
//             <span>{shopInfo.phone || 'Phone'}</span>
//             <span className="mx-3 text-slate-400">|</span>
//             <span>{shopAddress || 'Address'}</span>
//             {shopInfo.email && (
//               <>
//                 <span className="mx-3 text-slate-400">|</span>
//                 <span>{shopInfo.email}</span>
//               </>
//             )}
//           </div>

//           <div className="min-w-[180px] text-center">
//             <div className="mx-auto mb-3 h-px w-[150px] bg-slate-400" />
//             <p className="text-[13px] font-black uppercase tracking-[0.08em] text-slate-700">
//               Authorised Sign
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// function MetaRow({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="flex items-start justify-between gap-4">
//       <span className="font-black tracking-[0.02em] text-slate-800">{label}</span>
//       <span className="max-w-[150px] break-words text-right font-semibold text-slate-600">
//         {value}
//       </span>
//     </div>
//   )
// }

// function SummaryRow({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="font-black text-slate-800">{label}</span>
//       <span className="font-bold text-slate-700">{value}</span>
//     </div>
//   )
// }



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

type InvoicePreviewDocumentProps = { invoice: Invoice; shopInfo: ShopInfo }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const amount = (value: string | number | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
const numeric = (value: string | number | null | undefined) => Number(value ?? 0)
const positive = (value: string | number | null | undefined) => numeric(value) > 0
const date = (value?: string | null) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const dateTime = (value?: string | null) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
const resolveImageUrl = (path?: string | null) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
const joinAddress = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(', ')
const readable = (value?: string | null) => value?.replace(/_/g, ' ') || '—'

function SummaryLine({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 text-[11px] leading-6 ${emphasize ? 'font-semibold text-[#172b45]' : 'text-slate-600'}`}>
      <span>{label}</span><span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  )
}

export default function InvoicePreviewDocument({ invoice, shopInfo }: InvoicePreviewDocumentProps) {
  const logo = resolveImageUrl(shopInfo.logoUrl)
  const shopAddress = joinAddress(shopInfo.address, shopInfo.city, shopInfo.state, shopInfo.pincode)
  const customerAddress = joinAddress(invoice.customer_address_snapshot, invoice.customer_city_snapshot, invoice.customer_state_snapshot, invoice.customer_pincode_snapshot)
  const items = invoice.items || []
  const payments = invoice.payments || []
  const returns = invoice.returns || []
  const extraDiscount = numeric(invoice.extra_discount_amount)
  const totalDiscount = numeric(invoice.total_discount_amount)
  const itemDiscount = Math.max(0, totalDiscount - extraDiscount)
  const taxable = items.reduce((sum, item) => sum + numeric(item.taxable_value), 0)
  const cgst = items.reduce((sum, item) => sum + numeric(item.cgst_amount), 0)
  const sgst = items.reduce((sum, item) => sum + numeric(item.sgst_amount), 0)
  const igst = items.reduce((sum, item) => sum + numeric(item.igst_amount), 0)
  const billedAmount = numeric(invoice.billed_amount || invoice.final_amount)

  return (
    <div id="invoice-print-area" className="invoice-a4 mx-auto w-full max-w-[794px] bg-white text-[#172b45] shadow-[0_16px_55px_rgba(15,23,42,0.10)] print:max-w-none print:shadow-none">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          #invoice-print-area { width: 100% !important; max-width: none !important; box-shadow: none !important; }
          #invoice-print-area .invoice-page { padding: 0 !important; }
          #invoice-print-area .invoice-scroll { overflow: visible !important; }
          #invoice-print-area table { min-width: 0 !important; width: 100% !important; }
          #invoice-print-area thead { display: table-header-group; }
          #invoice-print-area tr, #invoice-print-area .invoice-keep { break-inside: avoid; page-break-inside: avoid; }
          #invoice-print-area { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="invoice-page px-4 py-6 sm:px-9 sm:py-9 print:px-0 print:py-0">
        {/* Aayal Signature: one restrained orange accent, white canvas and navy typography. */}
        <div className="mb-6 h-[3px] w-12 rounded-full bg-[#e87932]" />
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-slate-200 pb-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {logo && <img src={logo} alt={`${shopInfo.name} logo`} className="max-h-12 max-w-[110px] object-contain" />}
              <div className="min-w-0">
                <h1 className="break-words text-[20px] font-bold leading-tight tracking-tight">{shopInfo.name}</h1>
                {shopInfo.ownerName && <p className="mt-1 text-[10px] text-slate-500">Proprietor: {shopInfo.ownerName}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-0.5 text-[10px] leading-[1.65] text-slate-600">
              {shopAddress && <p>{shopAddress}</p>}
              {(shopInfo.phone || shopInfo.email) && <p className="break-words">{[shopInfo.phone, shopInfo.email].filter(Boolean).join('  ·  ')}</p>}
              {invoice.seller_gst_number_snapshot && <p><span className="font-medium text-slate-700">GSTIN:</span> {invoice.seller_gst_number_snapshot}</p>}
            </div>
          </div>
          <div className="min-w-[155px] text-left sm:text-right">
            <p className="text-[17px] font-bold uppercase tracking-[0.09em]">Tax Invoice</p>
            <p className="mt-2 break-all text-[12px] font-semibold">{invoice.invoice_number}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{date(invoice.invoice_date)}</p>
            {invoice.payment_status && <p className="mt-1 text-[10px] font-semibold capitalize text-[#b75d23]">{readable(invoice.payment_status)}</p>}
          </div>
        </header>

        <section className="invoice-keep grid grid-cols-1 gap-4 py-5 sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">Bill to</p>
            <p className="text-[13px] font-semibold">{invoice.customer_name_snapshot || 'Walk-in Customer'}</p>
            {customerAddress && <p className="mt-1 text-[10px] leading-5 text-slate-600">{customerAddress}</p>}
            {invoice.customer_phone_snapshot && <p className="text-[10px] leading-5 text-slate-600">{invoice.customer_phone_snapshot}</p>}
            {invoice.customer_email_snapshot && <p className="break-all text-[10px] leading-5 text-slate-600">{invoice.customer_email_snapshot}</p>}
            {invoice.customer_gst_number_snapshot && <p className="text-[10px] leading-5 text-slate-600">GSTIN: {invoice.customer_gst_number_snapshot}</p>}
          </div>
          {invoice.payment_mode && <div className="sm:text-right print:text-right">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">Payment mode</p>
            <p className="text-[11px] font-medium capitalize">{readable(invoice.payment_mode)}</p>
          </div>}
        </section>

        <div className="invoice-scroll overflow-x-auto">
          <table className="w-full min-w-[545px] border-collapse text-left text-[10px] leading-4">
            <thead className="border-y border-[#cbd5e1] bg-[#f5f7fa] text-[9px] font-semibold uppercase tracking-[0.04em] text-[#334155]">
              <tr>
                <th className="w-6 px-1.5 py-2.5">#</th>
                <th className="px-1.5 py-2.5">Item description</th>
                <th className="px-1.5 py-2.5">HSN/SAC</th>
                <th className="px-1.5 py-2.5 text-right">Qty</th>
                <th className="px-1.5 py-2.5 text-right">Rate</th>
                <th className="px-1.5 py-2.5 text-right">GST</th>
                <th className="px-1.5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id} className="align-top">
                  <td className="px-1.5 py-2.5 text-slate-500">{index + 1}</td>
                  <td className="px-1.5 py-2.5">
                    <p className="font-semibold text-[#172b45]">{item.product_name_snapshot}</p>
                    {item.product_code && <p className="mt-0.5 break-all text-[9px] text-slate-500">{item.product_code}</p>}
                    {positive(item.discount_percentage) && <p className="text-[9px] text-slate-500">Discount {numeric(item.discount_percentage)}%</p>}
                  </td>
                  <td className="px-1.5 py-2.5 text-slate-600">{item.hsn_sac_snapshot || '—'}</td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">{numeric(item.quantity)}</td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">{amount(item.selling_price_per_unit)}</td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">{numeric(item.gst_rate)}%</td>
                  <td className="px-1.5 py-2.5 text-right font-semibold tabular-nums">{amount(numeric(item.taxable_value ?? item.total_selling_price) + numeric(item.total_tax_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between print:flex-row print:justify-between">
          <div className="min-w-0 flex-1 text-[10px] leading-5 text-slate-600">
            {invoice.notes && <div className="mb-3"><p className="font-semibold text-[#172b45]">Notes</p><p className="whitespace-pre-wrap break-words">{invoice.notes}</p></div>}
            <p>Thank you for your business.</p>
          </div>
          <div className="invoice-keep w-full shrink-0 sm:w-[265px] print:w-[265px]">
            <SummaryLine label="Subtotal" value={amount(invoice.subtotal_amount)} />
            {itemDiscount > 0 && <SummaryLine label="Item discount" value={`−${amount(itemDiscount)}`} />}
            {taxable > 0 && <SummaryLine label="Taxable value" value={amount(taxable)} />}
            {cgst > 0 && <SummaryLine label="CGST" value={amount(cgst)} />}
            {sgst > 0 && <SummaryLine label="SGST" value={amount(sgst)} />}
            {igst > 0 && <SummaryLine label="IGST" value={amount(igst)} />}
            {positive(invoice.total_tax_amount) && <SummaryLine label="Total GST" value={amount(invoice.total_tax_amount)} />}
            {extraDiscount > 0 && <SummaryLine label="Extra discount" value={`−${amount(extraDiscount)}`} />}
            {billedAmount !== numeric(invoice.final_amount) && <SummaryLine label="Billed amount" value={amount(billedAmount)} />}
            <div className="mt-2 border-y border-[#172b45] py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold">Grand total</span>
                <span className="text-[17px] font-bold tabular-nums tracking-tight">{amount(invoice.final_amount)}</span>
              </div>
            </div>
            <div className="mt-2">
              <SummaryLine label="Paid" value={amount(invoice.paid_amount)} />
              <SummaryLine label="Balance due" value={amount(invoice.remaining_amount)} emphasize />
            </div>
          </div>
        </section>

        {payments.length > 0 && <section className="mt-6 border-t border-slate-200 pt-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em]">Payment history</h2>
          <div className="space-y-1.5">{payments.map(payment => (
            <div key={payment.id} className="invoice-keep flex justify-between gap-3 text-[10px] leading-5 text-slate-600">
              <span className="min-w-0 break-words">{readable(payment.payment_method)} · {dateTime(payment.received_at)}{payment.payment_reference ? ` · Ref: ${payment.payment_reference}` : ''}</span>
              <span className="shrink-0 tabular-nums">{amount(payment.amount)}</span>
            </div>
          ))}</div>
        </section>}

        {returns.length > 0 && <section className="mt-5 border-t border-slate-200 pt-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em]">Returns / credit notes</h2>
          <div className="space-y-3">{returns.map(record => (
            <div key={record.id} className="invoice-keep text-[10px] leading-5 text-slate-600">
              <div className="flex justify-between gap-3 font-medium text-[#172b45]">
                <span className="min-w-0 break-words">{record.return_number} / {record.credit_note_number} · {dateTime(record.completed_at)}</span>
                <span className="shrink-0 tabular-nums">−{amount(record.total_amount)}</span>
              </div>
              {record.reason && <p className="text-slate-500">{record.reason}</p>}
              {record.items.map(item => <div key={item.id} className="flex justify-between gap-3 pl-3"><span>{item.product_name_snapshot} × {numeric(item.quantity)}</span><span className="shrink-0 tabular-nums">{amount(item.total_amount)}</span></div>)}
              {record.refunds?.map(refund => <div key={refund.id} className="flex justify-between gap-3 pl-3"><span>Refund · {readable(refund.refund_method)}</span><span className="shrink-0 tabular-nums">{amount(refund.amount)}</span></div>)}
            </div>
          ))}</div>
        </section>}

        <footer className="invoice-keep mt-8 flex items-end justify-between gap-4 border-t border-slate-200 pt-4 text-[10px] text-slate-500">
          <div className="max-w-[65%]">{shopInfo.phone && <p>{shopInfo.phone}</p>}<p className="mt-1">Thank you for shopping with us.</p></div>
          <div className="text-right"><div className="h-7" /><p className="font-medium text-[#172b45]">Authorised signatory</p></div>
        </footer>
      </div>
    </div>
  )
}
