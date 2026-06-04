import {
  ArrowUpRight,
  Check,
  ChevronDown,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '../../features/products/types'

type FilterOption = { label: string; value: string }

function getStockStatus(product: Product) {
  if (product.stock_quantity === 0)
    return { label: 'Out of Stock', badge: 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400', percent: 0, bar: 'bg-red-500' }
  if (product.stock_quantity <= product.low_stock_threshold) {
    const percent = Math.min(
      100,
      Math.round((product.stock_quantity / Math.max(product.low_stock_threshold, 1)) * 100)
    )
    return { label: 'Low Stock', badge: 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400', percent, bar: 'bg-orange-500' }
  }
  return { label: 'In Stock', badge: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400', percent: 100, bar: 'bg-emerald-500' }
}

function getCategoryTileStyles(category: string) {
  const key = category.toLowerCase()
  if (key.includes('apparel')) return 'from-violet-100 to-fuchsia-100 dark:from-violet-900 dark:to-fuchsia-900 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800'
  if (key.includes('electronics')) return 'from-sky-100 to-blue-100 dark:from-sky-900 dark:to-blue-900 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-800'
  if (key.includes('footwear')) return 'from-emerald-100 to-green-100 dark:from-emerald-900 dark:to-green-900 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800'
  if (key.includes('accessories')) return 'from-amber-100 to-orange-100 dark:from-amber-900 dark:to-orange-900 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800'
  if (key.includes('home')) return 'from-rose-100 to-pink-100 dark:from-rose-900 dark:to-pink-900 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800'
  return 'from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-600'
}

// ── Portal-based action menu ──────────────────────────────────────────────────
function ActionMenu({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false })
  const buttonRef = useRef<HTMLButtonElement>(null)

  const MENU_W = 192
  const MENU_H = 150

  function openMenu() {
    if (!buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < MENU_H + 8
    const top = openUp ? r.top - MENU_H - 6 : r.bottom + 6
    let left = r.right - MENU_W
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8))
    setPos({ top, left, openUp })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="flex items-center justify-end">
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`rounded-2xl border p-2.5 transition-all duration-200 ${
          open
            ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <MoreVertical size={18} />
      </button>

      {open &&
        createPortal(
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onMouseDown={() => setOpen(false)}
            />
            <div
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W, zIndex: 9999 }}
              className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.15)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-1 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Actions
              </div>
              <button
                onClick={() => { setOpen(false); onEdit(product) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-400"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
                  <PencilLine size={15} />
                </span>
                Edit Product
              </button>
              <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
              <button
                onClick={() => { setOpen(false); onDelete(product) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-500 dark:text-red-400">
                  <Trash2 size={15} />
                </span>
                Delete Product
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  )
}

// ── Filter Dropdown ───────────────────────────────────────────────────────────
function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: FilterOption[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-medium transition-all duration-200 ${
          open
            ? 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-[#f3f5f9] dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700'
        }`}
      >
        <span className="truncate text-slate-700 dark:text-slate-300">{selected?.label || placeholder}</span>
        <ChevronDown
          size={18}
          className={`ml-2 shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl shadow-slate-200/70 dark:shadow-black/40">
          {options.map((opt) => {
            const sel = opt.value === value
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                  sel
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-400'
                }`}
              >
                <span>{opt.label}</span>
                {sel && <Check size={16} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function MobileProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  const stock = getStockStatus(product)
  const tile = getCategoryTileStyles(product.category)

  return (
    <div className="mb-3 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-5 shadow-sm hover:bg-[#f8f9fd] dark:hover:bg-slate-800 transition-colors">
      {/* Row 1 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold ring-1 ${tile}`}>
            {product.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-slate-900 dark:text-slate-100">{product.name}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{product.description || product.unit}</p>
          </div>
        </div>
        <div className="shrink-0">
          <ActionMenu product={product} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">{product.sku}</span>
        <span className="rounded-xl bg-indigo-100 dark:bg-indigo-950 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
          {product.category}
        </span>
        <span className={`ml-auto inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${stock.badge}`}>
          {stock.label}
        </span>
      </div>

      {/* Row 3 */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">MRP ₹{Number(product.mrp).toLocaleString('en-IN')}</p>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Buying ₹{Number(product.buying_price).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">{product.stock_quantity} Units</span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{stock.percent}%</span>
          </div>
          <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={`h-2 rounded-full ${stock.bar}`} style={{ width: `${stock.percent}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProductTable({
  products,
  allCategories,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  stockStatus,
  onStockStatusChange,
  sortBy,
  onSortChange,
  onEdit,
  onDelete,
  onAdd,
}: {
  products: Product[]
  allCategories: string[]
  search: string
  onSearchChange: (v: string) => void
  category: string
  onCategoryChange: (v: string) => void
  stockStatus: string
  onStockStatusChange: (v: string) => void
  sortBy: string
  onSortChange: (v: string) => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onAdd: () => void
}) {
  const categoryOptions: FilterOption[] = [
    { label: 'All Categories', value: '' },
    ...allCategories.map((c) => ({ label: c, value: c })),
  ]
  const stockOptions: FilterOption[] = [
    { label: 'Stock Status', value: '' },
    { label: 'In Stock', value: 'in_stock' },
    { label: 'Low Stock', value: 'low_stock' },
    { label: 'Out of Stock', value: 'out_of_stock' },
  ]
  const sortOptions: FilterOption[] = [
    { label: 'Newest First', value: 'date_desc' },
  
    { label: 'Name A to Z', value: 'name_asc' },
    { label: 'Name Z to A', value: 'name_desc' },
   
  ]

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc': return a.id - b.id
      case 'date_desc': return b.id - a.id
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'name_desc': return b.name.localeCompare(a.name)
      case 'stock_asc': return a.stock_quantity - b.stock_quantity
      case 'stock_desc': return b.stock_quantity - a.stock_quantity
      default: return b.id - a.id
    }
  })

  return (
    <div className="relative rounded-[32px] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/70 dark:ring-slate-700/30">
      {/* Decorative top line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[32px] bg-gradient-to-r from-transparent via-indigo-200/70 dark:via-indigo-700/50 to-transparent" />
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-24 right-10 h-40 w-40 rounded-full bg-indigo-100/30 dark:bg-indigo-900/20 blur-3xl" />

      {/* Add Product button */}
      <div className="flex items-center justify-end px-4 sm:px-8 pt-6 sm:pt-8">
        <button
          onClick={onAdd}
          className="group relative overflow-hidden rounded-[22px] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3 sm:px-5 sm:py-3.5 text-white shadow-[0_14px_32px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.35)] active:translate-y-0"
        >
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%)]" />
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2 sm:gap-3">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
              <Plus size={17} className="transition-transform duration-300 group-hover:rotate-90" />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="hidden sm:block text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">
                Inventory
              </span>
              <span className="text-sm sm:text-base font-semibold">Add Product</span>
            </span>
            <ArrowUpRight size={17} className="ml-1 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col gap-3 px-4 sm:px-8 py-5 sm:py-8">
        <div className="relative w-full">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or SKU..."
            className="h-12 w-full rounded-2xl border border-transparent dark:border-slate-700 bg-[#f3f5f9] dark:bg-slate-800 pl-12 pr-4 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-indigo-200 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:shadow-lg focus:shadow-indigo-100 dark:focus:shadow-indigo-900/20"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <FilterDropdown value={category} onChange={onCategoryChange} options={categoryOptions} placeholder="All Categories" />
          <FilterDropdown value={stockStatus} onChange={onStockStatusChange} options={stockOptions} placeholder="Stock Status" />
          <FilterDropdown value={sortBy} onChange={onSortChange} options={sortOptions} placeholder="Sort By" />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="block sm:hidden px-4 sm:px-8 pb-6">
        {sortedProducts.length === 0 ? (
          <p className="py-16 text-center text-slate-500 dark:text-slate-400">No products found.</p>
        ) : (
          sortedProducts.map((p) => (
            <MobileProductCard key={p.id} product={p} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] border-t border-slate-100 dark:border-slate-800 px-8 py-5 text-xs font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <span>PRODUCT DETAILS</span>
            <span>SKU</span>
            <span>CATEGORY</span>
            <span>PRICING</span>
            <span>STOCK LEVEL</span>
            <span>STATUS</span>
            <span />
          </div>

          {/* Rows */}
          <div className="pb-6">
            {sortedProducts.length === 0 ? (
              <div className="px-8 py-16 text-center text-slate-500 dark:text-slate-400">No products found.</div>
            ) : (
              sortedProducts.map((product) => {
                const stock = getStockStatus(product)
                const tile = getCategoryTileStyles(product.category)

                return (
                  <div
                    key={product.id}
                    className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] items-center border-t border-slate-50 dark:border-slate-800 px-8 py-6 hover:bg-[#f8f9fd] dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {/* Product details */}
                    <div className="flex min-w-0 items-center gap-4 pr-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold ring-1 ${tile}`}>
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">{product.name}</p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{product.description || product.unit}</p>
                      </div>
                    </div>

                    {/* SKU */}
                    <div className="text-sm text-slate-600 dark:text-slate-400">{product.sku}</div>

                    {/* Category */}
                    <div>
                      <span className="rounded-xl bg-indigo-100 dark:bg-indigo-950 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                        {product.category}
                      </span>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-1">
                      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        MRP ₹{Number(product.mrp).toLocaleString('en-IN')}
                      </p>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Buying ₹{Number(product.buying_price).toLocaleString('en-IN')}
                      </p>
                    </div>

                    {/* Stock level */}
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{product.stock_quantity} Units</span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{stock.percent}%</span>
                      </div>
                      <div className="mt-2 h-2 w-20 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className={`h-2 rounded-full ${stock.bar}`} style={{ width: `${stock.percent}%` }} />
                      </div>
                    </div>

                    {/* Status badge */}
                    <div>
                      <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${stock.badge}`}>
                        {stock.label}
                      </span>
                    </div>

                    <ActionMenu product={product} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}