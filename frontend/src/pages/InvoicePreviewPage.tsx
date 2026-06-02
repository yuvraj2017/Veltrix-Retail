// import { useEffect, useMemo, useState } from 'react'
// import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
// import { motion } from 'framer-motion'
// import {
//   ArrowLeft,
//   Download,
//   Loader2,
//   MessageCircle,
//   Pencil,
//   Printer,
//   Save,
//   Send,
//   Share2,
// } from 'lucide-react'

// import { AppShell } from '../components/layout/AppShell'
// import InvoicePreview from '../components/billing/InvoicePreview'
// import { billingApi } from '../features/billing/api'
// import type { Invoice } from '../features/billing/types'
// import { useAuth } from '../context/AuthContext'

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// const resolveImageUrl = (path?: string | null) => {
//   if (!path) return null
//   if (path.startsWith('http://') || path.startsWith('https://')) return path
//   return `${API_BASE_URL}${path}`
// }

// export default function InvoicePreviewPage() {
//   const navigate = useNavigate()
//   const { invoiceId } = useParams()
//   const [searchParams] = useSearchParams()
//   const { user, shop } = useAuth()

//   const id = Number(invoiceId)

//   const [invoice, setInvoice] = useState<Invoice | null>(null)
//   const [isLoading, setIsLoading] = useState(true)
//   const [isSharing, setIsSharing] = useState(false)
//   const [errorMessage, setErrorMessage] = useState('')

// //   const shopInfo = useMemo(() => {
// //     return {
// //       name:
// //         shop?.name ||
// //         user?.shop_name ||
// //         'Store',

// //       logoUrl:
// //         resolveImageUrl(shop?.logo_url) ||
// //         resolveImageUrl(user?.shop_logo_url) ||
// //         null,

// //       email:
// //         shop?.email ||
// //         user?.email ||
// //         null,

// //       phone:
// //         shop?.phone ||
// //         user?.phone ||
// //         null,

// //       address:
// //         shop?.address ||
// //         user?.shop_address ||
// //         null,

// //       city:
// //         shop?.city ||
// //         user?.shop_city ||
// //         null,

// //       state:
// //         shop?.state ||
// //         user?.shop_state ||
// //         null,

// //       pincode:
// //         shop?.pincode ||
// //         user?.shop_pincode ||
// //         null,
// //     }
// //   }, [shop, user])

//   const shopInfo = useMemo(() => {
//     return {
//         name:
//         shop?.name ||
//         user?.shop_name ||
//         'Store',

//         logoUrl:
//         shop?.logo_url ||
//         user?.shop_logo_url ||
//         null,

//         email:
//         user?.email ||
//         null,

//         phone:
//         null,

//         address:
//         null,

//         city:
//         null,

//         state:
//         null,

//         pincode:
//         null,
//     }
//     }, [shop, user])



//   const loadInvoice = async () => {
//     try {
//       setIsLoading(true)
//       setErrorMessage('')

//       const data = await billingApi.getInvoice(id)
//       setInvoice(data)
//     } catch (error) {
//       setErrorMessage(
//         error instanceof Error ? error.message : 'Unable to load invoice'
//       )
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const setInvoiceDocumentTitle = () => {
//     if (!invoice) return

//     document.title = invoice.invoice_number
//   }

//   const handlePrint = () => {
//     setInvoiceDocumentTitle()

//     setTimeout(() => {
//       window.print()
//     }, 100)
//   }

//   const handleShare = async () => {
//     try {
//       setIsSharing(true)

//       const data = await billingApi.shareInvoice(id)

//       if (data.whatsapp_url) {
//         window.open(data.whatsapp_url, '_blank')
//       }
//     } catch (error) {
//       console.error('Failed to share invoice', error)
//     } finally {
//       setIsSharing(false)
//     }
//   }

//   const handleDownload = () => {
//     setInvoiceDocumentTitle()

//     setTimeout(() => {
//       window.print()
//     }, 100)
//   }

//   useEffect(() => {
//     if (!Number.isNaN(id)) {
//       loadInvoice()
//     }
//   }, [id])

//   useEffect(() => {
//     if (!invoice) return

//     const previousTitle = document.title
//     document.title = invoice.invoice_number

//     return () => {
//       document.title = previousTitle
//     }
//   }, [invoice])

//   useEffect(() => {
//     if (invoice && searchParams.get('print') === 'true') {
//       setTimeout(() => window.print(), 500)
//     }
//   }, [invoice, searchParams])

//   if (isLoading) {
//     return (
//       <AppShell>
//         <div className="mx-auto max-w-[1200px]">
//           <div className="flex min-h-[520px] items-center justify-center rounded-[34px] bg-white/80">
//             <Loader2 size={34} className="animate-spin text-indigo-600" />
//           </div>
//         </div>
//       </AppShell>
//     )
//   }

//   if (!invoice || errorMessage) {
//     return (
//       <AppShell>
//         <div className="mx-auto max-w-[760px] rounded-[34px] bg-white/80 p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)]">
//           <h1 className="text-2xl font-black text-slate-950">
//             Invoice not found
//           </h1>

//           <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>

//           <button
//             type="button"
//             onClick={() => navigate('/billing')}
//             className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
//           >
//             Back to Billing
//           </button>
//         </div>
//       </AppShell>
//     )
//   }

//   return (
//     <AppShell>
//       <style>
//         {`
//           .invoice-a4 {
//             width: 210mm;
//             min-height: 297mm;
//             border-radius: 28px;
//           }

//           .invoice-page {
//             padding: 18mm;
//           }

//           .invoice-row {
//             break-inside: avoid;
//             page-break-inside: avoid;
//           }

//           @page {
//             size: A4;
//             margin: 0;
//           }

//           @media print {
//             html,
//             body {
//               width: 210mm;
//               min-height: 297mm;
//               margin: 0 !important;
//               padding: 0 !important;
//               background: #ffffff !important;
//               overflow: visible !important;
//             }

//             body * {
//               visibility: hidden !important;
//             }

//             #invoice-print-area,
//             #invoice-print-area * {
//               visibility: visible !important;
//             }

//             #invoice-print-area {
//               position: absolute !important;
//               left: 0 !important;
//               top: 0 !important;
//               width: 210mm !important;
//               min-height: 297mm !important;
//               margin: 0 !important;
//               padding: 0 !important;
//               border-radius: 0 !important;
//               box-shadow: none !important;
//               background: #ffffff !important;
//             }

//             .invoice-page {
//               padding: 14mm !important;
//             }

//             .invoice-row {
//               break-inside: avoid !important;
//               page-break-inside: avoid !important;
//             }

//             a[href]:after {
//               content: "" !important;
//             }
//           }
//         `}
//       </style>

//       <div className="mx-auto max-w-[1400px]">
//         <motion.div
//           initial={{ opacity: 0, y: 18 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.45, ease: 'easeOut' }}
//           className="print:hidden"
//         >
//           <button
//             type="button"
//             onClick={() => navigate('/billing')}
//             className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
//           >
//             <ArrowLeft size={17} />
//             Back to Billing
//           </button>

//           <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
//             <div>
//               <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
//                 <Send size={14} />
//                 Invoice Preview
//               </div>

//               <h1 className="text-[36px] font-black tracking-[-0.04em] text-slate-950 md:text-[48px]">
//                 Invoice #{invoice.invoice_number}
//               </h1>

//               <p className="mt-3 max-w-2xl text-[17px] leading-8 text-slate-600">
//                 Review, print, download, or share this invoice with the
//                 customer.
//               </p>
//             </div>

//             <div className="flex flex-wrap gap-3">
//               <ActionButton
//                 icon={Pencil}
//                 label="Edit"
//                 onClick={() => navigate('/billing/new')}
//               />
//               <ActionButton icon={Save} label="Refresh" onClick={loadInvoice} />
//               <ActionButton icon={Printer} label="Print" onClick={handlePrint} />
//               <ActionButton
//                 icon={Download}
//                 label="Save PDF"
//                 onClick={handleDownload}
//               />

//               <button
//                 type="button"
//                 onClick={handleShare}
//                 disabled={isSharing}
//                 className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)] transition hover:-translate-y-[1px] disabled:opacity-70"
//               >
//                 {isSharing ? (
//                   <Loader2 size={17} className="animate-spin" />
//                 ) : (
//                   <MessageCircle size={17} />
//                 )}
//                 WhatsApp
//               </button>
//             </div>
//           </div>
//         </motion.div>

//         <div className="grid gap-8 xl:grid-cols-[1fr_330px] print:block">
//           <div>
//             <InvoicePreview invoice={invoice} shopInfo={shopInfo} />
//           </div>

//           <aside className="space-y-6 print:hidden">
//             <div className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
//               <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
//                 Invoice Actions
//               </p>

//               <button
//                 type="button"
//                 onClick={handleShare}
//                 className="mb-4 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)]"
//               >
//                 <Share2 size={18} />
//                 Send to Customer
//               </button>

//               <div className="grid grid-cols-2 gap-3">
//                 <button
//                   type="button"
//                   onClick={() => navigate('/billing/new')}
//                   className="h-14 rounded-[20px] bg-slate-100 text-sm font-black text-slate-800"
//                 >
//                   Edit
//                 </button>

//                 <button
//                   type="button"
//                   onClick={loadInvoice}
//                   className="h-14 rounded-[20px] bg-slate-100 text-sm font-black text-slate-800"
//                 >
//                   Refresh
//                 </button>
//               </div>

//               <div className="my-6 h-px bg-slate-200" />

//               <div className="space-y-3">
//                 <SideAction icon={Printer} label="Print Invoice" onClick={handlePrint} />
//                 <SideAction icon={Download} label="Save as PDF" onClick={handleDownload} />
//                 <SideAction icon={Share2} label="Share Link" onClick={handleShare} />
//               </div>
//             </div>

//             <div className="rounded-[30px] bg-indigo-50/80 p-6 shadow-[0_18px_44px_rgba(99,102,241,0.08)]">
//               <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">
//                 PDF Export Tip
//               </h3>

//               <p className="mt-2 text-sm leading-6 text-slate-500">
//                 Click Save as PDF, choose “Save to PDF” in the print dialog, and
//                 the default document name will use this invoice number.
//               </p>
//             </div>
//           </aside>
//         </div>
//       </div>
//     </AppShell>
//   )
// }

// function ActionButton({
//   icon: Icon,
//   label,
//   onClick,
// }: {
//   icon: typeof Share2
//   label: string
//   onClick: () => void
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] border border-indigo-100 bg-white/80 px-5 text-sm font-black text-slate-700 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
//     >
//       <Icon size={17} />
//       {label}
//     </button>
//   )
// }

// function SideAction({
//   icon: Icon,
//   label,
//   onClick,
// }: {
//   icon: typeof Share2
//   label: string
//   onClick: () => void
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-sm font-black text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
//     >
//       <Icon size={17} />
//       {label}
//     </button>
//   )
// }


import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Loader2,
  MessageCircle,
  Pencil,
  Printer,
  Save,
  Send,
  Share2,
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import InvoicePreview from '../components/billing/InvoicePreview'
import { billingApi } from '../features/billing/api'
import type { Invoice } from '../features/billing/types'
import { useAuth } from '../context/AuthContext'

export default function InvoicePreviewPage() {
  const navigate = useNavigate()
  const { invoiceId } = useParams()
  const [searchParams] = useSearchParams()
  const { user, shop } = useAuth()

  const id = Number(invoiceId)

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSharing, setIsSharing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const shopInfo = useMemo(() => {
    return {
      name: shop?.name || user?.shop_name || 'Store',
      logoUrl: shop?.logo_url || user?.shop_logo_url || null,
      email: shop?.email || user?.email || null,
      phone: shop?.phone || shop?.whatsapp_number || null,
      address: shop?.address || null,
      city: shop?.city || null,
      state: shop?.state || null,
      pincode: shop?.pincode || null,
      ownerName: user?.full_name || null,
    }
  }, [shop, user])

  const loadInvoice = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')

      const data = await billingApi.getInvoice(id)
      setInvoice(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load invoice'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const setInvoiceDocumentTitle = () => {
    if (!invoice) return
    document.title = invoice.invoice_number
  }

  const handlePrint = () => {
    setInvoiceDocumentTitle()

    setTimeout(() => {
      window.print()
    }, 100)
  }

  const handleShare = async () => {
    try {
      setIsSharing(true)

      const data = await billingApi.shareInvoice(id)

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank')
      }
    } catch (error) {
      console.error('Failed to share invoice', error)
    } finally {
      setIsSharing(false)
    }
  }

  const handleDownload = () => {
    setInvoiceDocumentTitle()

    setTimeout(() => {
      window.print()
    }, 100)
  }

  useEffect(() => {
    if (!Number.isNaN(id)) {
      loadInvoice()
    }
  }, [id])

  useEffect(() => {
    if (!invoice) return

    const previousTitle = document.title
    document.title = invoice.invoice_number

    return () => {
      document.title = previousTitle
    }
  }, [invoice])

  useEffect(() => {
    if (invoice && searchParams.get('print') === 'true') {
      setTimeout(() => window.print(), 500)
    }
  }, [invoice, searchParams])

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1200px]">
          <div className="flex min-h-[520px] items-center justify-center rounded-[34px] bg-white/80">
            <Loader2 size={34} className="animate-spin text-indigo-600" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!invoice || errorMessage) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[760px] rounded-[34px] bg-white/80 p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)]">
          <h1 className="text-2xl font-black text-slate-950">
            Invoice not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>

          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Back to Billing
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <style>
        {`
          .invoice-a4 {
            width: 210mm;
            min-height: 297mm;
            border-radius: 28px;
          }

          .invoice-page {
            padding: 18mm;
          }

          .invoice-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 0;
          }

          @media print {
            html,
            body {
              width: 210mm;
              min-height: 297mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }

            body * {
              visibility: hidden !important;
            }

            #invoice-print-area,
            #invoice-print-area * {
              visibility: visible !important;
            }

            #invoice-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }

            .invoice-page {
              padding: 14mm !important;
            }

            .invoice-row {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            a[href]:after {
              content: "" !important;
            }
          }
        `}
      </style>

      <div className="mx-auto max-w-[1400px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="print:hidden"
        >
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
          >
            <ArrowLeft size={17} />
            Back to Billing
          </button>

          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
                <Send size={14} />
                Invoice Preview
              </div>

              <h1 className="text-[36px] font-black tracking-[-0.04em] text-slate-950 md:text-[48px]">
                Invoice #{invoice.invoice_number}
              </h1>

              <p className="mt-3 max-w-2xl text-[17px] leading-8 text-slate-600">
                Review, print, download, or share this invoice with the
                customer.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                icon={Pencil}
                label="Edit"
                // onClick={() => navigate('/billing/new')}
                onClick={() => navigate(`/billing/new?edit=${invoice.id}`)}
              />
              <ActionButton icon={Save} label="Refresh" onClick={loadInvoice} />
              <ActionButton icon={Printer} label="Print" onClick={handlePrint} />
              <ActionButton
                icon={Download}
                label="Save PDF"
                onClick={handleDownload}
              />

              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)] transition hover:-translate-y-[1px] disabled:opacity-70"
              >
                {isSharing ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <MessageCircle size={17} />
                )}
                WhatsApp
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-8 xl:grid-cols-[1fr_330px] print:block">
          <div>
            <InvoicePreview invoice={invoice} shopInfo={shopInfo} />
          </div>

          <aside className="space-y-6 print:hidden">
            <div className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
                Invoice Actions
              </p>

              <button
                type="button"
                onClick={handleShare}
                className="mb-4 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)]"
              >
                <Share2 size={18} />
                Send to Customer
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/billing/new')}
                  className="h-14 rounded-[20px] bg-slate-100 text-sm font-black text-slate-800"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={loadInvoice}
                  className="h-14 rounded-[20px] bg-slate-100 text-sm font-black text-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="my-6 h-px bg-slate-200" />

              <div className="space-y-3">
                <SideAction icon={Printer} label="Print Invoice" onClick={handlePrint} />
                <SideAction icon={Download} label="Save as PDF" onClick={handleDownload} />
                <SideAction icon={Share2} label="Share Link" onClick={handleShare} />
              </div>
            </div>

            <div className="rounded-[30px] bg-indigo-50/80 p-6 shadow-[0_18px_44px_rgba(99,102,241,0.08)]">
              <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">
                PDF Export Tip
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Click Save as PDF, choose Save to PDF in the print dialog, and
                the default document name will use this invoice number.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Share2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] border border-indigo-100 bg-white/80 px-5 text-sm font-black text-slate-700 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
    >
      <Icon size={17} />
      {label}
    </button>
  )
}

function SideAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Share2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-sm font-black text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Icon size={17} />
      {label}
    </button>
  )
}