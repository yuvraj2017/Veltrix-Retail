import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ClipboardCheck,
  Download,
  ExternalLink,
  History,
  IndianRupee,
  PackageOpen,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react'

import { inventoryApi } from '../features/inventory/api'
import type { InventoryProduct } from '../features/inventory/types'

type Tab = 'overview' | 'low-stock' | 'movements' | 'reconciliation' | 'purchasing'

const PAGE_SIZE = 25
const inputClass =
  'h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-950'
const tabs: Array<{ key: Tab; label: string; icon: typeof Boxes }> = [
  { key: 'overview', label: 'Overview', icon: Boxes },
  { key: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
  { key: 'movements', label: 'Movements', icon: History },
  { key: 'reconciliation', label: 'Reconciliation', icon: ClipboardCheck },
  { key: 'purchasing', label: 'Purchasing', icon: ShoppingCart },
]

const movementTypes = [
  'opening_balance',
  'sale',
  'sale_return',
  'draft_reserve',
  'draft_release',
  'adjustment_in',
  'adjustment_out',
  'purchase_receipt',
  'purchase_return',
]

function localDate(offsetDays = 0) {
  const value = new Date()
  value.setDate(value.getDate() + offsetDays)
  return value.toLocaleDateString('en-CA')
}

function money(value: string | number) {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

function title(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusClass(value: string) {
  if (['normal', 'received', 'matched'].includes(value)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  if (['out_of_stock', 'cancelled', 'mismatch', 'overdue'].includes(value)) return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
}

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}>{title(value)}</span>
}

function Empty({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
      <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {pages} · {total} records</span>
      <div className="flex gap-2">
        <button className="h-10 rounded-md border border-slate-300 px-4 text-sm disabled:opacity-40 dark:border-slate-600" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <button className="h-10 rounded-md border border-slate-300 px-4 text-sm disabled:opacity-40 dark:border-slate-600" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  )
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail?: string; icon: typeof Boxes }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <Icon size={18} aria-hidden="true" />
      </div>
      <p className="mt-3 break-words text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  )
}

function ProductDetail({ productId, onClose, onViewHistory }: { productId: number; onClose: () => void; onViewHistory: (sku: string) => void }) {
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['inventory', 'product-detail', productId],
    queryFn: () => inventoryApi.productDetail(productId),
  })
  const detail = query.data
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Product inventory detail">
      <div className="h-full w-full overflow-y-auto bg-white p-4 shadow-xl sm:max-w-xl sm:p-6 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Inventory detail</p>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-slate-100">{detail?.product.name ?? 'Loading product...'}</h2>
          </div>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} title="Close"><X size={20} /></button>
        </div>
        {query.isLoading && <Empty message="Loading inventory detail..." />}
        {query.isError && <Empty message="Unable to load this product's inventory detail." />}
        {detail && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Sellable" value={detail.product.stock_quantity} icon={Boxes} />
              <Metric label="Incoming" value={detail.product.incoming_quantity} icon={PackageOpen} />
              <Metric label="Inventory value" value={money(detail.product.inventory_value)} icon={IndianRupee} />
              <Metric label="Ledger" value={detail.reconciliation.matches ? 'Matched' : `Difference ${detail.reconciliation.difference}`} icon={ClipboardCheck} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate('/products')} className="h-10 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Adjust / Count Stock</button>
              <button onClick={() => onViewHistory(detail.product.sku)} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600">Stock History</button>
              <button onClick={() => navigate('/purchase-orders')} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600">Purchase Order</button>
            </div>
            <section>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent movements</h3>
              <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {detail.recent_movements.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0"><p className="font-medium">{title(item.movement_type)}</p><p className="truncate text-xs text-slate-500">{item.reference_label}</p></div>
                    <span className={`font-bold ${item.quantity_delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}</span>
                  </div>
                ))}
                {!detail.recent_movements.length && <Empty message="No stock movement history." />}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent purchasing</h3>
              <div className="mt-2 space-y-2 text-sm">
                {detail.recent_receipts.map((item) => <div key={item.receipt_number} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><b>{item.receipt_number}</b> · {item.purchase_order_number}<br /><span className="text-slate-500">Received {item.quantity} at {money(item.unit_cost)}</span></div>)}
                {detail.recent_purchase_returns.map((item) => <div key={item.return_number} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><b>{item.return_number}</b> · {item.purchase_order_number}<br /><span className="text-slate-500">Returned {item.quantity} · {money(item.value)}</span></div>)}
                {!detail.recent_receipts.length && !detail.recent_purchase_returns.length && <Empty message="No recent receipts or purchase returns." />}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [movementType, setMovementType] = useState('')
  const [direction, setDirection] = useState('')
  const [poStatus, setPoStatus] = useState('')
  const [mismatchesOnly, setMismatchesOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState(localDate(-29))
  const [dateTo, setDateTo] = useState(localDate())
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => setPage(1), [tab, debouncedSearch, movementType, direction, poStatus, mismatchesOnly, dateFrom, dateTo])

  const commonParams = useMemo(() => ({ search: debouncedSearch || undefined, page, page_size: PAGE_SIZE }), [debouncedSearch, page])
  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: inventoryApi.summary })
  const activity = useQuery({ queryKey: ['inventory', 'activity', dateFrom, dateTo], queryFn: () => inventoryApi.activity(dateFrom, dateTo), enabled: tab === 'overview' })
  const products = useQuery({
    queryKey: ['inventory', 'low-stock', commonParams],
    queryFn: () => inventoryApi.products({ ...commonParams, stock_status: 'actionable' }),
    enabled: tab === 'low-stock',
  })
  const movements = useQuery({
    queryKey: ['inventory', 'movements', commonParams, movementType, direction, dateFrom, dateTo],
    queryFn: () => inventoryApi.movements({ ...commonParams, movement_type: movementType || undefined, direction: direction || undefined, date_from: dateFrom, date_to: dateTo }),
    enabled: tab === 'movements',
  })
  const reconciliation = useQuery({
    queryKey: ['inventory', 'reconciliation', commonParams, mismatchesOnly],
    queryFn: () => inventoryApi.reconciliation({ ...commonParams, mismatches_only: mismatchesOnly }),
    enabled: tab === 'reconciliation',
  })
  const purchasing = useQuery({
    queryKey: ['inventory', 'purchasing', commonParams, poStatus, dateFrom, dateTo],
    queryFn: () => inventoryApi.purchasing({ ...commonParams, status: poStatus || undefined, date_from: dateFrom, date_to: dateTo }),
    enabled: tab === 'purchasing',
  })
  const vendorInsights = useQuery({
    queryKey: ['inventory', 'vendor-insights', debouncedSearch],
    queryFn: () => inventoryApi.vendorInsights({ search: debouncedSearch || undefined, page: 1, page_size: 10 }),
    enabled: tab === 'purchasing',
  })

  const changeTab = (next: Tab) => {
    setTab(next)
    setSearch('')
    setPage(1)
    setMessage('')
  }
  const exportReport = async (report: string, params: Record<string, unknown>) => {
    setExporting(true)
    setMessage('')
    try { await inventoryApi.exportCsv(report, params) }
    catch { setMessage('Unable to export this report. Please retry.') }
    finally { setExporting(false) }
  }

  const s = summary.data
  const a = activity.data
  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">Inventory Operations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Current stock, movement integrity, replenishment and purchasing visibility.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/products" className="flex h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"><Boxes size={17} /> Products</Link>
          <Link to="/purchase-orders" className="flex h-11 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"><ShoppingCart size={17} /> Purchasing</Link>
        </div>
      </header>

      <nav className="mt-6 flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 pb-px dark:border-slate-700" aria-label="Inventory sections">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => changeTab(key)} className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}><Icon size={17} />{label}</button>
        ))}
      </nav>
      {message && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{message}</div>}

      {tab === 'overview' && (
        <div className="mt-5 space-y-6">
          {summary.isError && <Empty message="Unable to load inventory summary." />}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
            <Metric label="Active products" value={s?.active_products ?? '—'} icon={Boxes} />
            <Metric label="Sellable units" value={s?.total_sellable_units ?? '—'} icon={PackageOpen} />
            <Metric label="Low / out" value={s ? `${s.low_stock_products} / ${s.out_of_stock_products}` : '—'} icon={AlertTriangle} />
            <Metric label="Current-cost value" value={s ? money(s.current_inventory_value) : '—'} detail="Not accounting-grade valuation" icon={IndianRupee} />
            <Metric label="Ledger mismatches" value={s?.reconciliation_mismatches ?? '—'} icon={ClipboardCheck} />
            <Metric label="Open POs" value={s?.open_purchase_orders ?? '—'} icon={ShoppingCart} />
            <Metric label="Partial receipts" value={s?.partially_received_purchase_orders ?? '—'} icon={PackageOpen} />
            <Metric label="Vendor credit" value={s ? money(s.unapplied_vendor_credit) : '—'} detail="Unapplied financial credit" icon={IndianRupee} />
          </section>
          <section className="border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-bold">Movement activity</h2><p className="text-sm text-slate-500">Movement ledger totals; draft reservation activity is shown separately.</p></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-500">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-1 w-full`} /></label><label className="text-xs font-semibold text-slate-500">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-1 w-full`} /></label></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Units sold" value={a?.units_sold ?? '—'} icon={ArrowDown} />
              <Metric label="Customer restocked" value={a?.customer_return_units_restocked ?? '—'} icon={ArrowUp} />
              <Metric label="Purchase received" value={a?.purchase_units_received ?? '—'} icon={ArrowUp} />
              <Metric label="Purchase returned" value={a?.purchase_units_returned ?? '—'} icon={ArrowDown} />
              <Metric label="Adjustments in / out" value={a ? `${a.adjustment_in_units} / ${a.adjustment_out_units}` : '—'} icon={History} />
              <Metric label="Draft reserve / release" value={a ? `${a.draft_reserved_units} / ${a.draft_released_units}` : '—'} detail="Not counted as sales" icon={History} />
            </div>
          </section>
        </div>
      )}

      {tab !== 'overview' && (
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="relative block w-full lg:max-w-md"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'purchasing' ? 'Search PO or vendor' : 'Search product, SKU or barcode'} className={`${inputClass} w-full pl-10`} /></label>
          <div className="flex flex-wrap items-end gap-2">
            {tab === 'movements' && <><select value={movementType} onChange={(e) => setMovementType(e.target.value)} className={inputClass}><option value="">All movements</option>{movementTypes.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputClass}><option value="">Any direction</option><option value="in">Stock in</option><option value="out">Stock out</option></select></>}
            {tab === 'reconciliation' && <label className="flex h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-600"><input type="checkbox" checked={mismatchesOnly} onChange={(e) => setMismatchesOnly(e.target.checked)} /> Mismatches only</label>}
            {tab === 'purchasing' && <select value={poStatus} onChange={(e) => setPoStatus(e.target.value)} className={inputClass}><option value="">All PO statuses</option>{['draft', 'ordered', 'partially_received', 'received', 'cancelled'].map((item) => <option key={item} value={item}>{title(item)}</option>)}</select>}
            {(tab === 'movements' || tab === 'purchasing') && <><input aria-label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} /><input aria-label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} /></>}
            <button disabled={exporting} onClick={() => exportReport(tab === 'low-stock' ? 'low-stock' : tab === 'purchasing' ? 'purchase-orders' : tab, { search: debouncedSearch || undefined, movement_type: movementType || undefined, direction: direction || undefined, po_status: poStatus || undefined, date_from: dateFrom, date_to: dateTo, mismatches_only: mismatchesOnly })} className="flex h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-600"><Download size={17} /> CSV</button>
          </div>
        </div>
      )}

      {tab === 'low-stock' && <LowStock data={products.data?.items ?? []} loading={products.isLoading} error={products.isError} onSelect={setSelectedProductId} page={page} total={products.data?.total ?? 0} onPage={setPage} />}
      {tab === 'movements' && <Movements data={movements.data?.items ?? []} loading={movements.isLoading} error={movements.isError} page={page} total={movements.data?.total ?? 0} onPage={setPage} />}
      {tab === 'reconciliation' && <Reconciliation data={reconciliation.data?.items ?? []} loading={reconciliation.isLoading} error={reconciliation.isError} page={page} total={reconciliation.data?.total ?? 0} onPage={setPage} />}
      {tab === 'purchasing' && <Purchasing data={purchasing.data?.items ?? []} vendors={vendorInsights.data?.items ?? []} loading={purchasing.isLoading} error={purchasing.isError} page={page} total={purchasing.data?.total ?? 0} onPage={setPage} />}
      {selectedProductId !== null && <ProductDetail productId={selectedProductId} onClose={() => setSelectedProductId(null)} onViewHistory={(sku) => { setSelectedProductId(null); setTab('movements'); setSearch(sku) }} />}
    </div>
  )
}

function LowStock({ data, loading, error, onSelect, page, total, onPage }: { data: InventoryProduct[]; loading: boolean; error: boolean; onSelect: (id: number) => void; page: number; total: number; onPage: (page: number) => void }) {
  return <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">{loading ? <Empty message="Loading low-stock products..." /> : error ? <Empty message="Unable to load low-stock inventory." /> : !data.length ? <Empty message="No active products currently need replenishment." /> : <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Product', 'Current', 'Threshold', 'Gap', 'Incoming', 'Buying price', 'Value', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((item) => <tr key={item.product_id}><td className="px-4 py-3"><b>{item.name}</b><br /><span className="text-xs text-slate-500">{item.sku}{item.barcode ? ` · ${item.barcode}` : ''}</span></td><td className="px-4 py-3"><Status value={item.stock_status} /><p className="mt-1 font-bold">{item.stock_quantity}</p></td><td className="px-4 py-3">{item.low_stock_threshold}</td><td className="px-4 py-3">{item.threshold_gap}</td><td className="px-4 py-3 font-semibold text-indigo-600">{item.incoming_quantity}</td><td className="px-4 py-3">{money(item.buying_price)}</td><td className="px-4 py-3">{money(item.inventory_value)}</td><td className="px-4 py-3"><button onClick={() => onSelect(item.product_id)} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold dark:border-slate-600">Details</button></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-200 md:hidden dark:divide-slate-700">{data.map((item) => <button key={item.product_id} onClick={() => onSelect(item.product_id)} className="w-full p-4 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate">{item.name}</b><span className="text-xs text-slate-500">{item.sku}</span></div><Status value={item.stock_status} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span>Current<br /><b className="text-base">{item.stock_quantity}</b></span><span>Gap<br /><b className="text-base">{item.threshold_gap}</b></span><span>Incoming<br /><b className="text-base text-indigo-600">{item.incoming_quantity}</b></span></div></button>)}</div><Pagination page={page} total={total} onChange={onPage} /></>}</section>
}

function Movements({ data, loading, error, page, total, onPage }: { data: Awaited<ReturnType<typeof inventoryApi.movements>>['items']; loading: boolean; error: boolean; page: number; total: number; onPage: (page: number) => void }) {
  return <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">{loading ? <Empty message="Loading stock movements..." /> : error ? <Empty message="Unable to load stock movements." /> : !data.length ? <Empty message="No movements match these filters." /> : <><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Date', 'Product', 'Movement', 'Before', 'Change', 'After', 'Reference', 'Actor'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-4 py-3">{new Date(item.occurred_at).toLocaleString()}</td><td className="px-4 py-3"><b>{item.product_name}</b><br /><span className="text-xs text-slate-500">{item.product_sku}</span></td><td className="px-4 py-3"><Status value={item.movement_type} />{item.reason && <p className="mt-1 text-xs text-slate-500">{title(item.reason)}</p>}</td><td className="px-4 py-3">{item.quantity_before}</td><td className={`px-4 py-3 font-bold ${item.quantity_delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}</td><td className="px-4 py-3">{item.quantity_after}</td><td className="px-4 py-3">{item.reference_url ? <Link to={item.reference_url} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">{item.reference_label}<ExternalLink size={13} /></Link> : item.reference_label}</td><td className="px-4 py-3">{item.actor_name || 'System'}</td></tr>)}</tbody></table></div><Pagination page={page} total={total} onChange={onPage} /></>}</section>
}

function Reconciliation({ data, loading, error, page, total, onPage }: { data: Awaited<ReturnType<typeof inventoryApi.reconciliation>>['items']; loading: boolean; error: boolean; page: number; total: number; onPage: (page: number) => void }) {
  return <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="border-b border-slate-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-slate-700 dark:bg-amber-950 dark:text-amber-200">A mismatch is an integrity issue. This report never repairs or inserts balancing movements automatically.</div>{loading ? <Empty message="Checking ledger balances..." /> : error ? <Empty message="Unable to load reconciliation." /> : !data.length ? <Empty message="No products match these filters." /> : <><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Product', 'Current sellable', 'Ledger balance', 'Difference', 'Status'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((item) => <tr key={item.product_id}><td className="px-4 py-3"><b>{item.product_name}</b><br /><span className="text-xs text-slate-500">{item.sku}</span></td><td className="px-4 py-3">{item.current_balance}</td><td className="px-4 py-3">{item.ledger_balance}</td><td className={`px-4 py-3 font-bold ${item.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.difference}</td><td className="px-4 py-3"><Status value={item.matches ? 'matched' : 'mismatch'} /></td></tr>)}</tbody></table></div><Pagination page={page} total={total} onChange={onPage} /></>}</section>
}

function Purchasing({ data, vendors, loading, error, page, total, onPage }: { data: Awaited<ReturnType<typeof inventoryApi.purchasing>>['items']; vendors: Awaited<ReturnType<typeof inventoryApi.vendorInsights>>['items']; loading: boolean; error: boolean; page: number; total: number; onPage: (page: number) => void }) {
  return <div className="mt-4 space-y-6"><section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">{loading ? <Empty message="Loading purchase operations..." /> : error ? <Empty message="Unable to load purchase operations." /> : !data.length ? <Empty message="No purchase orders match these filters." /> : <><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['PO / Vendor', 'Status', 'Dates', 'Ordered', 'Received', 'Remaining', 'Returned', 'Ordered value'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((item) => <tr key={item.purchase_order_id}><td className="px-4 py-3"><Link to="/purchase-orders" className="font-bold text-indigo-600 hover:underline">{item.purchase_order_number}</Link><br /><span className="text-xs text-slate-500">{item.vendor_name}</span></td><td className="px-4 py-3"><Status value={item.overdue_expected_receipt ? 'overdue' : item.status} /></td><td className="px-4 py-3">{item.order_date}<br /><span className="text-xs text-slate-500">Expected {item.expected_date || 'not set'}</span></td><td className="px-4 py-3">{item.ordered_quantity}</td><td className="px-4 py-3">{item.received_quantity}</td><td className="px-4 py-3 font-bold">{item.remaining_quantity}</td><td className="px-4 py-3">{item.purchase_return_quantity}<br /><span className="text-xs text-slate-500">{money(item.purchase_return_value)}</span></td><td className="px-4 py-3">{money(item.ordered_value)}</td></tr>)}</tbody></table></div><Pagination page={page} total={total} onChange={onPage} /></>}</section><section><div className="mb-3"><h2 className="text-lg font-bold">Vendor purchasing insights</h2><p className="text-sm text-slate-500">Physical purchasing and financial payable metrics remain separately labelled.</p></div><div className="grid gap-3 lg:grid-cols-2">{vendors.map((vendor) => <div key={vendor.vendor_id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><b className="truncate">{vendor.vendor_name}</b><span className="text-xs text-slate-500">{vendor.purchase_order_count} POs</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><span>Ordered<br /><b>{money(vendor.ordered_value)}</b></span><span>Received<br /><b>{money(vendor.received_value)}</b></span><span>Returned<br /><b>{money(vendor.purchase_return_value)}</b></span><span>Bill outstanding<br /><b>{money(vendor.outstanding_vendor_bills)}</b></span><span>Vendor credit<br /><b>{money(vendor.unapplied_vendor_credit)}</b></span></div></div>)}</div></section></div>
}
