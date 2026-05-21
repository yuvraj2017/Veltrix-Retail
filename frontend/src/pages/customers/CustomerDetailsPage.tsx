import { useEffect, useState } from 'react'
import { ArrowLeft, Package, ReceiptText, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { getCustomerDetail } from '../../features/customerAnalytics/api'
import type { CustomerDetail } from '../../features/customerAnalytics/types'

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDate = (value?: string | null) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function CustomerDetailsPage() {
  const { customerId } = useParams()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadCustomer() {
      if (!customerId) return

      try {
        setIsLoading(true)
        const response = await getCustomerDetail(Number(customerId))
        setCustomer(response)
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomer()
  }, [customerId])

  return (
    <AppShell>
      {isLoading ? (
        <div className="rounded-[2rem] bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
          Loading customer details...
        </div>
      ) : !customer ? (
        <div className="rounded-[2rem] bg-white p-10 text-center text-sm font-bold text-red-500 shadow-sm">
          Customer not found.
        </div>
      ) : (
        <div className="space-y-8">
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:text-indigo-700"
          >
            <ArrowLeft size={18} />
            Back to Customers
          </Link>

          <div className="rounded-[2rem] bg-white p-7 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-500">
                  Customer Profile
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                  {customer.customer_name}
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {customer.phone || '-'} · {customer.email || '-'}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {[customer.address, customer.city, customer.state, customer.pincode]
                    .filter(Boolean)
                    .join(', ') || 'No address available'}
                </p>
              </div>

              <span className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                {customer.status}
              </span>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-[1.7rem] bg-white p-6 shadow-sm">
              <ReceiptText className="text-indigo-700" />
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Total Bills
              </p>
              <p className="mt-3 text-3xl font-black text-slate-950">
                {customer.total_bills}
              </p>
            </div>

            <div className="rounded-[1.7rem] bg-white p-6 shadow-sm">
              <WalletCards className="text-indigo-700" />
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Total Spent
              </p>
              <p className="mt-3 text-3xl font-black text-slate-950">
                {formatCurrency(customer.total_spent)}
              </p>
            </div>

            <div className="rounded-[1.7rem] bg-white p-6 shadow-sm">
              <Package className="text-indigo-700" />
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Total Profit
              </p>
              <p className="mt-3 text-3xl font-black text-slate-950">
                {formatCurrency(customer.total_profit)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[1.8rem] bg-white shadow-sm">
              <div className="px-6 py-5">
                <h2 className="text-lg font-black text-slate-950">
                  Invoice History
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-[#f8f9fd]">
                    <tr>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Invoice
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customer.invoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-12 text-center text-sm font-bold text-slate-500"
                        >
                          No invoice history found.
                        </td>
                      </tr>
                    ) : (
                      customer.invoices.map((invoice) => (
                        <tr key={invoice.invoice_number} className="hover:bg-[#f8f9fd]">
                          <td className="px-6 py-4 text-sm font-bold text-slate-950">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600">
                            {formatDate(invoice.invoice_date)}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-slate-950">
                            {formatCurrency(invoice.total_amount)}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-indigo-700">
                            {invoice.payment_status || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.8rem] bg-white shadow-sm">
              <div className="px-6 py-5">
                <h2 className="text-lg font-black text-slate-950">
                  Products Purchased
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-[#f8f9fd]">
                    <tr>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Qty
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Sales
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Profit
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customer.products.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-12 text-center text-sm font-bold text-slate-500"
                        >
                          No purchased products found.
                        </td>
                      </tr>
                    ) : (
                      customer.products.map((product) => (
                        <tr
                          key={`${product.product_id}-${product.product_name}`}
                          className="hover:bg-[#f8f9fd]"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-950">
                              {product.product_name}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {product.category || '-'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-950">
                            {product.total_quantity}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-slate-950">
                            {formatCurrency(product.total_sales)}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-emerald-600">
                            {formatCurrency(product.total_profit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}