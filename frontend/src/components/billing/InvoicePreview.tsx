// import { BadgeIndianRupee, Building2, Mail, Phone } from 'lucide-react'

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
// }

// type InvoicePreviewProps = {
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
//   if (!value) return '—'

//   return new Date(value).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: 'long',
//     year: 'numeric',
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

// export default function InvoicePreview({ invoice, shopInfo }: InvoicePreviewProps) {
//   const logoUrl = resolveImageUrl(shopInfo.logoUrl)

//   const shopAddress = [
//     shopInfo.address,
//     shopInfo.city,
//     shopInfo.state,
//     shopInfo.pincode,
//   ]
//     .filter(Boolean)
//     .join(', ')

//   const customerAddress = [
//     invoice.customer_address_snapshot,
//     invoice.customer_city_snapshot,
//     invoice.customer_state_snapshot,
//     invoice.customer_pincode_snapshot,
//   ]
//     .filter(Boolean)
//     .join(', ')

//   return (
//     <div
//       id="invoice-print-area"
//       className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] print:shadow-none"
//     >
//       <div className="invoice-page">
//         <div className="flex flex-col gap-8 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
//           <div className="flex items-start gap-4">
//             {logoUrl ? (
//               <img
//                 src={logoUrl}
//                 alt={shopInfo.name}
//                 className="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-sm"
//               />
//             ) : (
//               <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-black text-white shadow-lg">
//                 {getInitial(shopInfo.name)}
//               </div>
//             )}

//             <div>
//               <h2 className="text-3xl font-black tracking-[-0.04em] text-indigo-700">
//                 {shopInfo.name}
//               </h2>

//               <div className="mt-4 space-y-1 text-sm font-semibold leading-6 text-slate-600">
//                 {shopAddress && <p>{shopAddress}</p>}

//                 {shopInfo.phone && (
//                   <p className="flex items-center gap-2">
//                     <Phone size={14} className="text-indigo-500" />
//                     {shopInfo.phone}
//                   </p>
//                 )}

//                 {shopInfo.email && (
//                   <p className="flex items-center gap-2">
//                     <Mail size={14} className="text-indigo-500" />
//                     {shopInfo.email}
//                   </p>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div className="text-left sm:text-right">
//             <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Total Amount Due
//             </p>

//             <h1 className="mt-2 text-[42px] font-black tracking-[-0.055em] text-indigo-700">
//               {money(invoice.final_amount)}
//             </h1>

//             <p className="mt-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Invoice Date
//             </p>

//             <p className="mt-1 text-lg font-black text-slate-950">
//               {formatDate(invoice.invoice_date)}
//             </p>
//           </div>
//         </div>

//         <div className="grid gap-8 border-b border-slate-200 py-8 sm:grid-cols-[1fr_280px]">
//           <div>
//             <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Billed To
//             </p>

//             <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
//               {invoice.customer_name_snapshot}
//             </h3>

//             <div className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-600">
//               <p className="flex items-center gap-2">
//                 <Phone size={15} className="text-indigo-500" />
//                 {invoice.customer_phone_snapshot}
//               </p>

//               {invoice.customer_email_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Mail size={15} className="text-indigo-500" />
//                   {invoice.customer_email_snapshot}
//                 </p>
//               )}

//               <p>{customerAddress || 'Address not added'}</p>
//             </div>
//           </div>

//           <div className="rounded-[26px] bg-slate-50 p-6">
//             <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Payment Details
//             </p>

//             <div className="space-y-4 text-sm">
//               <Row label="Invoice #" value={invoice.invoice_number} />
//               <Row label="Payment" value={invoice.payment_status} />
//               <Row label="Mode" value={invoice.payment_mode || 'Not selected'} />
//               <Row label="Status" value={invoice.invoice_status} />
//             </div>
//           </div>
//         </div>

//         <div className="py-8">
//           <div className="mb-5 grid grid-cols-[1.45fr_0.45fr_0.65fr_0.65fr_0.8fr] text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
//             <div>Description</div>
//             <div>Qty</div>
//             <div>MRP</div>
//             <div>Discount</div>
//             <div className="text-right">Total</div>
//           </div>

//           <div className="space-y-4">
//             {invoice.items.map((item) => (
//               <div
//                 key={item.id}
//                 className="invoice-row grid grid-cols-[1.45fr_0.45fr_0.65fr_0.65fr_0.8fr] items-center gap-4 rounded-[22px] border border-slate-100 p-4"
//               >
//                 <div>
//                   <p className="font-black text-slate-950">
//                     {item.product_name_snapshot}
//                   </p>
//                   <p className="mt-1 text-xs font-semibold text-slate-500">
//                     Code: {item.product_code}
//                   </p>
//                 </div>

//                 <p className="font-bold text-slate-700">
//                   {Number(item.quantity)}
//                 </p>

//                 <p className="font-bold text-slate-700">
//                   {money(item.mrp)}
//                 </p>

//                 <p className="font-bold text-slate-700">
//                   {Number(item.discount_percentage)}%
//                 </p>

//                 <p className="text-right font-black text-slate-950">
//                   {money(item.total_selling_price)}
//                 </p>
//               </div>
//             ))}
//           </div>
//         </div>

//         <div className="ml-auto max-w-[420px] border-t border-slate-200 pt-6">
//           <Row label="Subtotal" value={money(invoice.subtotal_amount)} />
//           <Row
//             label="Discount"
//             value={`-${money(invoice.total_discount_amount)}`}
//             danger
//           />
//           <Row label="Tax" value={money(invoice.total_tax_amount)} />
//           <Row label="Paid" value={money(invoice.paid_amount)} />
//           <Row label="Remaining" value={money(invoice.remaining_amount)} danger />

//           <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
//             <span className="text-xl font-black text-slate-950">
//               Grand Total
//             </span>

//             <span className="text-3xl font-black tracking-[-0.04em] text-indigo-700">
//               {money(invoice.final_amount)}
//             </span>
//           </div>
//         </div>

//         <div className="mt-12 text-center">
//           <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
//             <BadgeIndianRupee size={20} />
//           </div>

//           <p className="text-sm font-medium text-slate-500">
//             Thank you for your business. Please include the invoice number in your
//             payment reference.
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }

// function Row({
//   label,
//   value,
//   danger = false,
// }: {
//   label: string
//   value: string
//   danger?: boolean
// }) {
//   return (
//     <div className="mb-3 flex items-center justify-between gap-4">
//       <span className="text-sm font-semibold text-slate-500">{label}</span>
//       <span
//         className={`text-sm font-black ${
//           danger ? 'text-rose-600' : 'text-slate-950'
//         }`}
//       >
//         {value}
//       </span>
//     </div>
//   )
// }

























// import { BadgeIndianRupee, Mail, Phone } from 'lucide-react'

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
// }

// type InvoicePreviewProps = {
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
//   if (!value) return '—'

//   return new Date(value).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: 'long',
//     year: 'numeric',
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

// export default function InvoicePreview({
//   invoice,
//   shopInfo,
// }: InvoicePreviewProps) {
//   const logoUrl = resolveImageUrl(shopInfo.logoUrl)

//   const customerAddress = [
//     invoice.customer_address_snapshot,
//     invoice.customer_city_snapshot,
//     invoice.customer_state_snapshot,
//     invoice.customer_pincode_snapshot,
//   ]
//     .filter(Boolean)
//     .join(', ')

//   return (
//     <div
//       id="invoice-print-area"
//       className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] print:shadow-none"
//     >
//       <div className="invoice-page">
//         <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
//           <div className="flex items-start">
//             {logoUrl ? (
//               <img
//                 src={logoUrl}
//                 alt={shopInfo.name}
//                 className="h-20 w-auto max-w-[190px] object-contain"
//               />
//             ) : (
//               <div className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 text-2xl font-black text-white shadow-lg">
//                 {getInitial(shopInfo.name)}
//               </div>
//             )}
//           </div>

//           <div className="text-left sm:text-right">
//             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Total Amount Due
//             </p>

//             <h1 className="mt-1.5 text-[32px] font-black tracking-[-0.055em] text-indigo-700">
//               {money(invoice.final_amount)}
//             </h1>

//             <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Invoice Date
//             </p>

//             <p className="mt-1 text-[14px] font-black text-slate-950">
//               {formatDate(invoice.invoice_date)}
//             </p>
//           </div>
//         </div>

//         <div className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-[1fr_250px]">
//           <div>
//             <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Billed To
//             </p>

//             <h3 className="text-[20px] font-black tracking-[-0.03em] text-slate-950">
//               {invoice.customer_name_snapshot}
//             </h3>

//             <div className="mt-3 space-y-1.5 text-[12px] font-medium leading-5 text-slate-600">
//               <p className="flex items-center gap-1.5">
//                 <Phone size={13} className="text-indigo-500" />
//                 {invoice.customer_phone_snapshot}
//               </p>

//               {invoice.customer_email_snapshot && (
//                 <p className="flex items-center gap-1.5">
//                   <Mail size={13} className="text-indigo-500" />
//                   {invoice.customer_email_snapshot}
//                 </p>
//               )}

//               <p>{customerAddress || 'Address not added'}</p>
//             </div>
//           </div>

//           <div className="rounded-[22px] bg-slate-50 p-5">
//             <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
//               Payment Details
//             </p>

//             <div className="space-y-2.5 text-[12px]">
//               <Row label="Invoice #" value={invoice.invoice_number} />
//               <Row label="Payment" value={invoice.payment_status} />
//               <Row label="Mode" value={invoice.payment_mode || 'Not selected'} />
//               <Row label="Status" value={invoice.invoice_status} />
//             </div>
//           </div>
//         </div>

//         <div className="py-6">
//           <div className="mb-3 grid grid-cols-[1.55fr_0.35fr_0.55fr_0.55fr_0.7fr] text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
//             <div>Description</div>
//             <div>Qty</div>
//             <div>MRP</div>
//             <div>Disc.</div>
//             <div className="text-right">Total</div>
//           </div>

//           <div className="space-y-2.5">
//             {invoice.items.map((item) => (
//               <div
//                 key={item.id}
//                 className="invoice-row grid grid-cols-[1.55fr_0.35fr_0.55fr_0.55fr_0.7fr] items-center gap-3 rounded-[16px] border border-slate-100 px-3 py-2.5"
//               >
//                 <div>
//                   <p className="text-[12.5px] font-black leading-5 text-slate-950">
//                     {item.product_name_snapshot}
//                   </p>
//                   <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
//                     Code: {item.product_code}
//                   </p>
//                 </div>

//                 <p className="text-[12px] font-bold text-slate-700">
//                   {Number(item.quantity)}
//                 </p>

//                 <p className="text-[12px] font-bold text-slate-700">
//                   {money(item.mrp)}
//                 </p>

//                 <p className="text-[12px] font-bold text-slate-700">
//                   {Number(item.discount_percentage)}%
//                 </p>

//                 <p className="text-right text-[12px] font-black text-slate-950">
//                   {money(item.total_selling_price)}
//                 </p>
//               </div>
//             ))}
//           </div>
//         </div>

//         <div className="ml-auto max-w-[360px] border-t border-slate-200 pt-5">
//           <Row label="Subtotal" value={money(invoice.subtotal_amount)} />

//           <Row
//             label="Discount"
//             value={`-${money(invoice.total_discount_amount)}`}
//             danger
//           />

//           <Row label="Tax" value={money(invoice.total_tax_amount)} />
//           <Row label="Paid" value={money(invoice.paid_amount)} />
//           <Row label="Remaining" value={money(invoice.remaining_amount)} danger />

//           <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
//             <span className="text-[17px] font-black text-slate-950">
//               Grand Total
//             </span>

//             <span className="text-[26px] font-black tracking-[-0.04em] text-indigo-700">
//               {money(invoice.final_amount)}
//             </span>
//           </div>
//         </div>

//         <div className="mt-9 text-center">
//           <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
//             <BadgeIndianRupee size={17} />
//           </div>

//           <p className="text-[12px] font-medium text-slate-500">
//             Thank you for your business. Please include the invoice number in
//             your payment reference.
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }

// function Row({
//   label,
//   value,
//   danger = false,
// }: {
//   label: string
//   value: string
//   danger?: boolean
// }) {
//   return (
//     <div className="mb-2 flex items-center justify-between gap-4">
//       <span className="text-[12px] font-semibold text-slate-500">{label}</span>

//       <span
//         className={`text-[12px] font-black ${
//           danger ? 'text-rose-600' : 'text-slate-950'
//         }`}
//       >
//         {value}
//       </span>
//     </div>
//   )
// }





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

// type InvoicePreviewProps = {
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
//   if (!value) return '—'

//   return new Date(value).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: '2-digit',
//     year: 'numeric',
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

// export default function InvoicePreview({
//   invoice,
//   shopInfo,
// }: InvoicePreviewProps) {
//   const logoUrl = resolveImageUrl(shopInfo.logoUrl)

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
//       className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] print:shadow-none"
//     >
//       <div className="invoice-page">
//         {/* Top Brand Header */}
//         <div className="pb-5">
//           <div className="flex flex-col items-center justify-center text-center">
//             {logoUrl ? (
//               <img
//                 src={logoUrl}
//                 alt={shopInfo.name}
//                 className="h-24 w-auto max-w-[220px] object-contain"
//               />
//             ) : (
//               <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-3xl font-black text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)]">
//                 {getInitial(shopInfo.name)}
//               </div>
//             )}

//             <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-slate-950">
//               {shopInfo.name}
//             </h1>

//             {shopInfo.ownerName && (
//               <p className="mt-1 text-[13px] font-semibold text-slate-600">
//                 Proprietor: {shopInfo.ownerName}
//               </p>
//             )}

//             {shopAddress && (
//               <div className="mt-2 flex max-w-[560px] items-start justify-center gap-2 text-[12px] font-medium leading-6 text-slate-600">
//                 <MapPin size={14} className="mt-1 shrink-0 text-indigo-600" />
//                 <span>{shopAddress}</span>
//               </div>
//             )}

//             <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-medium text-slate-600">
//               {shopInfo.phone && (
//                 <span className="inline-flex items-center gap-1.5">
//                   <Phone size={13} className="text-indigo-600" />
//                   {shopInfo.phone}
//                 </span>
//               )}

//               {shopInfo.email && (
//                 <span className="inline-flex items-center gap-1.5">
//                   <Mail size={13} className="text-indigo-600" />
//                   {shopInfo.email}
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Invoice Title Band */}
//         <div className="mb-7 flex items-center gap-5">
//           <div className="h-[14px] flex-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//           <h2 className="text-[54px] font-black uppercase tracking-[-0.06em] text-slate-800">
//             Invoice
//           </h2>
//           <div className="h-[14px] w-[74px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//         </div>

//         {/* Customer + Meta */}
//         <div className="grid gap-8 pb-7 sm:grid-cols-[1.2fr_0.8fr]">
//           <div>
//             <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
//               Invoice To:
//             </p>

//             <h3 className="text-[28px] font-black tracking-[-0.04em] text-slate-900">
//               {invoice.customer_name_snapshot}
//             </h3>

//             <div className="mt-3 space-y-1.5 text-[14px] font-medium leading-6 text-slate-600">
//               {invoice.customer_phone_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Phone size={14} className="text-indigo-600" />
//                   {invoice.customer_phone_snapshot}
//                 </p>
//               )}

//               {invoice.customer_email_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Mail size={14} className="text-indigo-600" />
//                   {invoice.customer_email_snapshot}
//                 </p>
//               )}

//               <p>{customerAddress || 'Address not added'}</p>
//             </div>
//           </div>

//           <div className="sm:pl-8">
//             <div className="space-y-3 text-[15px]">
//               <MetaRow label="Invoice#" value={invoice.invoice_number} />
//               <MetaRow label="Date" value={formatDate(invoice.invoice_date)} />
//               <MetaRow label="Payment" value={invoice.payment_status || 'pending'} />
//               <MetaRow label="Mode" value={invoice.payment_mode || 'cash'} />
//               <MetaRow label="Status" value={invoice.invoice_status || 'saved'} />
//             </div>
//           </div>
//         </div>

//         {/* Items Table */}
//         <div className="overflow-hidden border border-slate-300">
//           <div className="grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] bg-slate-800 px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-white">
//             <div>Sl.</div>
//             <div>Item Description</div>
//             <div>Price</div>
//             <div>Qty.</div>
//             <div className="text-right">Total</div>
//           </div>

//           <div>
//             {invoice.items.map((item, index) => (
//               <div
//                 key={item.id}
//                 className={`invoice-row grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] items-center px-4 py-4 text-[14px] ${
//                   index % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100/70'
//                 }`}
//               >
//                 <div className="font-black text-slate-700">{index + 1}</div>

//                 <div>
//                   <p className="font-black tracking-[0.01em] text-slate-900">
//                     {item.product_name_snapshot}
//                   </p>
//                   <p className="mt-1 text-[11px] font-semibold text-slate-500">
//                     Code: {item.product_code}
//                     {Number(item.discount_percentage) > 0
//                       ? ` • Discount: ${Number(item.discount_percentage)}%`
//                       : ''}
//                   </p>
//                 </div>

//                 <div className="font-black text-slate-700">{money(item.mrp)}</div>

//                 <div className="font-black text-slate-700">
//                   {Number(item.quantity)}
//                 </div>

//                 <div className="text-right font-black text-slate-900">
//                   {money(item.total_selling_price)}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Lower Summary */}
//         <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_320px]">
//           <div>
//             <p className="text-[18px] font-black tracking-[0.01em] text-slate-800">
//               Thank you for your business
//             </p>

//             <div className="mt-7">
//               <h4 className="text-[18px] font-black text-slate-800">
//                 Terms & Conditions
//               </h4>
//               <p className="mt-2 max-w-[480px] text-[12px] leading-6 text-slate-600">
//                 Goods once sold will not be taken back unless otherwise agreed.
//                 Please verify all items at the time of billing. Payment related
//                 issues should be referenced with the invoice number.
//               </p>
//             </div>

//             <div className="mt-7">
//               <h4 className="text-[18px] font-black text-slate-800">
//                 Payment Info
//               </h4>
//               <div className="mt-2 space-y-1 text-[12px] leading-6 text-slate-600">
//                 <p>
//                   <span className="font-semibold text-slate-800">Mode:</span>{' '}
//                   {invoice.payment_mode || 'Cash'}
//                 </p>
//                 <p>
//                   <span className="font-semibold text-slate-800">Payment Status:</span>{' '}
//                   {invoice.payment_status || 'Pending'}
//                 </p>
//                 <p>
//                   <span className="font-semibold text-slate-800">Invoice Ref:</span>{' '}
//                   {invoice.invoice_number}
//                 </p>
//               </div>
//             </div>
//           </div>

//           <div>
//             <div className="space-y-2 text-[15px]">
//               <SummaryRow label="Sub Total:" value={money(invoice.subtotal_amount)} />
//               <SummaryRow label="Tax:" value={money(invoice.total_tax_amount)} />
//               <SummaryRow
//                 label="Discount:"
//                 value={`-${money(invoice.total_discount_amount)}`}
//               />
//               <SummaryRow label="Paid:" value={money(invoice.paid_amount)} />
//             </div>

//             <div className="mt-4 rounded-none bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-7 py-4 text-white shadow-[0_18px_38px_rgba(79,70,229,0.18)]">
//               <div className="flex items-center justify-between gap-4">
//                 <span className="text-[18px] font-black uppercase tracking-[0.06em]">
//                   Total:
//                 </span>
//                 <span className="text-[24px] font-black tracking-[-0.03em]">
//                   {money(invoice.final_amount)}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="mt-10 flex items-end justify-between gap-6 border-t-4 border-indigo-500 pt-7">
//           <div className="text-[13px] font-semibold tracking-[0.04em] text-slate-700">
//             <span>{shopInfo.phone || 'Phone'}</span>
//             <span className="mx-4 text-slate-400">|</span>
//             <span>{shopAddress || 'Address'}</span>
//             {shopInfo.email && (
//               <>
//                 <span className="mx-4 text-slate-400">|</span>
//                 <span>{shopInfo.email}</span>
//               </>
//             )}
//           </div>

//           <div className="min-w-[200px] text-center">
//             <div className="mx-auto mb-3 h-px w-[160px] bg-slate-400" />
//             <p className="text-[14px] font-black uppercase tracking-[0.08em] text-slate-700">
//               Authorised Sign
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// function MetaRow({
//   label,
//   value,
// }: {
//   label: string
//   value: string
// }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="font-black tracking-[0.02em] text-slate-800">{label}</span>
//       <span className="font-semibold text-slate-600">{value}</span>
//     </div>
//   )
// }

// function SummaryRow({
//   label,
//   value,
// }: {
//   label: string
//   value: string
// }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="font-black text-slate-800">{label}</span>
//       <span className="font-bold text-slate-700">{value}</span>
//     </div>
//   )
// }
























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

// type InvoicePreviewProps = {
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
//   if (!value) return '—'

//   return new Date(value).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: '2-digit',
//     year: 'numeric',
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

// export default function InvoicePreview({
//   invoice,
//   shopInfo,
// }: InvoicePreviewProps) {
//   const logoUrl = resolveImageUrl(shopInfo.logoUrl)

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
//       className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] print:shadow-none"
//     >
//       <div className="invoice-page">
//         {/* Top Brand Header */}
//         <div className="pb-5">
//           <div className="flex flex-col items-center justify-center text-center">
//             {logoUrl ? (
//               <img
//                 src={logoUrl}
//                 alt={shopInfo.name}
//                 className="h-24 w-auto max-w-[220px] object-contain"
//               />
//             ) : (
//               <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-3xl font-black text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)]">
//                 {getInitial(shopInfo.name)}
//               </div>
//             )}

//             <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-slate-950">
//               {shopInfo.name}
//             </h1>

//             {shopInfo.ownerName && (
//               <p className="mt-1 text-[13px] font-semibold text-slate-600">
//                 Proprietor: {shopInfo.ownerName}
//               </p>
//             )}

//             {shopAddress && (
//               <div className="mt-2 flex max-w-[560px] items-start justify-center gap-2 text-[12px] font-medium leading-6 text-slate-600">
//                 <MapPin size={14} className="mt-1 shrink-0 text-indigo-600" />
//                 <span>{shopAddress}</span>
//               </div>
//             )}

//             <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-medium text-slate-600">
//               {shopInfo.phone && (
//                 <span className="inline-flex items-center gap-1.5">
//                   <Phone size={13} className="text-indigo-600" />
//                   {shopInfo.phone}
//                 </span>
//               )}

//               {shopInfo.email && (
//                 <span className="inline-flex items-center gap-1.5">
//                   <Mail size={13} className="text-indigo-600" />
//                   {shopInfo.email}
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Invoice Title Band */}
//         <div className="mb-7 flex items-center gap-5">
//           <div className="h-[14px] flex-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//           <h2 className="text-[54px] font-black uppercase tracking-[-0.06em] text-slate-800">
//             Invoice
//           </h2>
//           <div className="h-[14px] w-[74px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700" />
//         </div>

//         {/* Customer + Meta */}
//         <div className="grid gap-8 pb-7 sm:grid-cols-[1.2fr_0.8fr]">
//           <div>
//             <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
//               Invoice To:
//             </p>

//             <h3 className="text-[28px] font-black tracking-[-0.04em] text-slate-900">
//               {invoice.customer_name_snapshot}
//             </h3>

//             <div className="mt-3 space-y-1.5 text-[14px] font-medium leading-6 text-slate-600">
//               {invoice.customer_phone_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Phone size={14} className="text-indigo-600" />
//                   {invoice.customer_phone_snapshot}
//                 </p>
//               )}

//               {invoice.customer_email_snapshot && (
//                 <p className="flex items-center gap-2">
//                   <Mail size={14} className="text-indigo-600" />
//                   {invoice.customer_email_snapshot}
//                 </p>
//               )}

//               <p>{customerAddress || 'Address not added'}</p>
//             </div>
//           </div>

//           <div className="sm:pl-8">
//             <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/90 p-5 shadow-[0_14px_34px_rgba(79,70,229,0.08)]">
//               <div className="mb-3">
//                 <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
//                   Invoice Details
//                 </p>
//               </div>

//               <div className="space-y-3 text-[15px]">
//                 <MetaRow label="Invoice#" value={invoice.invoice_number} />
//                 <MetaRow label="Date" value={formatDate(invoice.invoice_date)} />
//                 <MetaRow label="Payment" value={invoice.payment_status || 'pending'} />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Items Table */}
//         <div className="overflow-hidden rounded-[18px] border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
//           <div className="grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-4 py-3.5 text-[12px] font-black uppercase tracking-[0.12em] text-white">
//             <div>Sl.</div>
//             <div>Item Description</div>
//             <div>Price</div>
//             <div>Qty.</div>
//             <div className="text-right">Total</div>
//           </div>

//           <div>
//             {invoice.items.map((item, index) => (
//               <div
//                 key={item.id}
//                 className={`invoice-row grid grid-cols-[0.45fr_2fr_0.8fr_0.7fr_0.95fr] items-center px-4 py-4 text-[14px] ${
//                   index % 2 === 0 ? 'bg-slate-50' : 'bg-white'
//                 }`}
//               >
//                 <div className="font-black text-slate-700">{index + 1}</div>

//                 <div>
//                   <p className="font-black tracking-[0.01em] text-slate-900">
//                     {item.product_name_snapshot}
//                   </p>
//                   <p className="mt-1 text-[11px] font-semibold text-slate-500">
//                     Code: {item.product_code}
//                     {Number(item.discount_percentage) > 0
//                       ? ` • Discount: ${Number(item.discount_percentage)}%`
//                       : ''}
//                   </p>
//                 </div>

//                 <div className="font-black text-slate-700">{money(item.mrp)}</div>

//                 <div className="font-black text-slate-700">
//                   {Number(item.quantity)}
//                 </div>

//                 <div className="text-right font-black text-slate-900">
//                   {money(item.total_selling_price)}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Lower Summary */}
//         <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_340px]">
//           <div>
//             <p className="text-[18px] font-black tracking-[0.01em] text-slate-800">
//               Thank you for your business
//             </p>

//             <div className="mt-7">
//               <h4 className="text-[18px] font-black text-slate-800">
//                 Terms & Conditions
//               </h4>
//               <p className="mt-2 max-w-[480px] text-[12px] leading-6 text-slate-600">
//                 Goods once sold will not be taken back unless otherwise agreed.
//                 Please verify all items at the time of billing. Payment related
//                 issues should be referenced with the invoice number.
//               </p>
//             </div>
//           </div>

//           <div>
//             <div className="space-y-2 text-[15px]">
//               <SummaryRow label="Sub Total:" value={money(invoice.subtotal_amount)} />
//               <SummaryRow label="Tax:" value={money(invoice.total_tax_amount)} />
//               <SummaryRow
//                 label="Discount:"
//                 value={`-${money(invoice.total_discount_amount)}`}
//               />
//               <SummaryRow label="Paid:" value={money(invoice.paid_amount)} />
//             </div>

//             <div className="mt-5 overflow-hidden rounded-[20px] border border-indigo-200 bg-white shadow-[0_18px_36px_rgba(79,70,229,0.10)]">
//               <div className="bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-6 py-4 text-white">
//                 <div className="flex items-center justify-between gap-4">
//                   <span className="text-[15px] font-black uppercase tracking-[0.16em] text-white/90">
//                     Grand Total
//                   </span>
//                   <span className="text-[30px] font-black tracking-[-0.04em]">
//                     {money(invoice.final_amount)}
//                   </span>
//                 </div>
//               </div>

//               <div className="flex items-center justify-between px-6 py-3 text-[12px] font-semibold text-slate-500">
//                 <span>Remaining</span>
//                 <span className="font-black text-rose-600">
//                   {money(invoice.remaining_amount)}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="mt-10 flex items-end justify-between gap-6 border-t-4 border-indigo-500 pt-7">
//           <div className="text-[13px] font-semibold tracking-[0.04em] text-slate-700">
//             <span>{shopInfo.phone || 'Phone'}</span>
//             <span className="mx-4 text-slate-400">|</span>
//             <span>{shopAddress || 'Address'}</span>
//             {shopInfo.email && (
//               <>
//                 <span className="mx-4 text-slate-400">|</span>
//                 <span>{shopInfo.email}</span>
//               </>
//             )}
//           </div>

//           <div className="min-w-[200px] text-center">
//             <div className="mx-auto mb-3 h-px w-[160px] bg-slate-400" />
//             <p className="text-[14px] font-black uppercase tracking-[0.08em] text-slate-700">
//               Authorised Sign
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// function MetaRow({
//   label,
//   value,
// }: {
//   label: string
//   value: string
// }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="font-black tracking-[0.02em] text-slate-800">{label}</span>
//       <span className="text-right font-semibold text-slate-600">{value}</span>
//     </div>
//   )
// }

// function SummaryRow({
//   label,
//   value,
// }: {
//   label: string
//   value: string
// }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="font-black text-slate-800">{label}</span>
//       <span className="font-bold text-slate-700">{value}</span>
//     </div>
//   )
// }




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
    <div
      id="invoice-print-area"
      className="invoice-a4 mx-auto bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] print:shadow-none"
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
                      ? ` • Discount:${Number(item.discount_percentage)}%`
                      : ''}
                  </p>
                </div>

                <div className="font-black text-slate-700">{money(item.mrp)}</div>

                <div className="font-black text-slate-700">
                  {Number(item.quantity)}
                </div>

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

function MetaRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-black tracking-[0.02em] text-slate-800">{label}</span>
      <span className="max-w-[150px] text-right font-semibold break-words text-slate-600">
        {value}
      </span>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-black text-slate-800">{label}</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  )
}