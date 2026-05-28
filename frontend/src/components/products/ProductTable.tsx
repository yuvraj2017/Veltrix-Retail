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
import type { Product } from '../../features/products/types'

type FilterOption = { label: string; value: string }

function getStockStatus(product: Product) {
  if (product.stock_quantity === 0)
    return { label: 'Out of Stock', badge: 'bg-red-100 text-red-600', percent: 0, bar: 'bg-red-500' }
  if (product.stock_quantity <= product.low_stock_threshold) {
    const percent = Math.min(
      100,
      Math.round((product.stock_quantity / Math.max(product.low_stock_threshold, 1)) * 100)
    )
    return { label: 'Low Stock', badge: 'bg-orange-100 text-orange-600', percent, bar: 'bg-orange-500' }
  }
  return { label: 'In Stock', badge: 'bg-emerald-100 text-emerald-600', percent: 100, bar: 'bg-emerald-500' }
}

function getCategoryTileStyles(category: string) {
  const key = category.toLowerCase()
  if (key.includes('apparel'))     return 'from-violet-100 to-fuchsia-100 text-violet-700 ring-violet-200'
  if (key.includes('electronics')) return 'from-sky-100 to-blue-100 text-blue-700 ring-blue-200'
  if (key.includes('footwear'))    return 'from-emerald-100 to-green-100 text-emerald-700 ring-emerald-200'
  if (key.includes('accessories')) return 'from-amber-100 to-orange-100 text-orange-700 ring-orange-200'
  if (key.includes('home'))        return 'from-rose-100 to-pink-100 text-rose-700 ring-rose-200'
  return 'from-slate-100 to-slate-200 text-slate-700 ring-slate-200'
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
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
            ? 'border-indigo-300 bg-white shadow-lg shadow-indigo-100'
            : 'border-slate-200 bg-[#f3f5f9] hover:border-slate-300 hover:bg-white'
        }`}
      >
        <span className="truncate text-slate-700">{selected?.label || placeholder}</span>
        <ChevronDown
          size={18}
          className={`ml-2 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
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
                    : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
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

// ── Mobile / Tablet card (shown below lg) ─────────────────────────────────────
function MobileProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const stock = getStockStatus(product)
  const tile = getCategoryTileStyles(product.category)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="mb-3 rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm hover:bg-[#f8f9fd] transition-colors">
      {/* Row 1 — avatar + name + menu button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold ring-1 ${tile}`}
          >
            {product.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-slate-900">{product.name}</p>
            <p className="truncate text-sm text-slate-500">{product.description || product.unit}</p>
          </div>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className={`rounded-2xl border p-2.5 transition-all duration-200 ${
              menuOpen
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-48 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <div className="mb-1 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Actions
              </div>
              <button
                onClick={() => { setMenuOpen(false); onEdit(product) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <PencilLine size={15} />
                </span>
                Edit Product
              </button>
              <div className="my-1.5 border-t border-slate-100" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(product) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500">
                  <Trash2 size={15} />
                </span>
                Delete Product
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — SKU + category + status badge */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">{product.sku}</span>
        <span className="rounded-xl bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700">
          {product.category}
        </span>
        <span className={`ml-auto inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${stock.badge}`}>
          {stock.label}
        </span>
      </div>

      {/* Row 3 — pricing + stock bar */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xl font-semibold text-slate-900">MRP ${product.mrp}</p>
          <p className="text-sm font-medium text-slate-500">Buying ${product.buying_price}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">{product.stock_quantity} Units</span>
            <span className="text-sm font-semibold text-slate-600">{stock.percent}%</span>
          </div>
          <div className="h-2 w-24 rounded-full bg-slate-200">
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
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    { label: 'Oldest First', value: 'date_asc' },
    { label: 'Name A to Z', value: 'name_asc' },
    { label: 'Name Z to A', value: 'name_desc' },
    { label: 'Stock High to Low', value: 'stock_desc' },
    { label: 'Stock Low to High', value: 'stock_asc' },
  ]

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':   return a.id - b.id
      case 'date_desc':  return b.id - a.id
      case 'name_asc':   return a.name.localeCompare(b.name)
      case 'name_desc':  return b.name.localeCompare(a.name)
      case 'stock_asc':  return a.stock_quantity - b.stock_quantity
      case 'stock_desc': return b.stock_quantity - a.stock_quantity
      default:           return b.id - a.id
    }
  })

  return (
    // ✅ FIX 1: Removed overflow-hidden so the dropdown is never clipped
    <div
      ref={wrapperRef}
      className="relative rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-white/70"
    >
      {/* Decorative top line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[32px] bg-gradient-to-r from-transparent via-indigo-200/70 to-transparent" />
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-24 right-10 h-40 w-40 rounded-full bg-indigo-100/30 blur-3xl" />

      {/* ── Top bar: Add Product button ── */}
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
            <ArrowUpRight
              size={17}
              className="ml-1 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </span>
        </button>
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-col gap-3 px-4 sm:px-8 py-5 sm:py-8">
        <div className="relative w-full">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or SKU..."
            className="h-12 w-full rounded-2xl border border-transparent bg-[#f3f5f9] pl-12 pr-4 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-200 focus:bg-white focus:shadow-lg focus:shadow-indigo-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterDropdown value={category} onChange={onCategoryChange} options={categoryOptions} placeholder="All Categories" />
          <FilterDropdown value={stockStatus} onChange={onStockStatusChange} options={stockOptions} placeholder="Stock Status" />
          <FilterDropdown value={sortBy} onChange={onSortChange} options={sortOptions} placeholder="Sort By" />
        </div>
      </div>

      {/* ══ CARDS — mobile & tablet (< lg) ════════════════════════════════════ */}
      <div className="block lg:hidden px-4 sm:px-8 pb-6">
        {sortedProducts.length === 0 ? (
          <p className="py-16 text-center text-slate-500">No products found.</p>
        ) : (
          sortedProducts.map((p) => (
            <MobileProductCard key={p.id} product={p} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>

      {/* ══ TABLE — desktop (≥ lg) ════════════════════════════════════════════ */}
    <div className="hidden lg:block overflow-x-auto">
  <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] border-t border-slate-100 px-8 py-5 text-xs font-semibold tracking-[0.18em] text-slate-500">
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
            <div className="px-8 py-16 text-center text-slate-500">No products found.</div>
          ) : (
            sortedProducts.map((product, index) => {
              const stock = getStockStatus(product)
              const tile = getCategoryTileStyles(product.category)
              const isOpen = openMenuId === product.id
              // ✅ FIX 2: flip menu upward for last 2 rows so it never overflows bottom
              const isNearBottom = index >= sortedProducts.length - 2

              return (
                <div
                  key={product.id}
                  className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] items-center border-t border-slate-50 px-8 py-6 hover:bg-[#f8f9fd] transition-colors"
                >
                  {/* Product details */}
                  <div className="flex min-w-0 items-center gap-4 pr-3">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold ring-1 ${tile}`}
                    >
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-semibold text-slate-900">{product.name}</p>
                      <p className="truncate text-sm text-slate-500">{product.description || product.unit}</p>
                    </div>
                  </div>

                  {/* SKU */}
                  <div className="text-sm text-slate-600">{product.sku}</div>

                  {/* Category */}
                  <div>
                    <span className="rounded-xl bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700">
                      {product.category}
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className="space-y-1">
                    <p className="text-xl font-semibold text-slate-900">MRP ${product.mrp}</p>
                    <p className="text-sm font-medium text-slate-500">Buying ${product.buying_price}</p>
                  </div>

                  {/* Stock level */}
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-700">{product.stock_quantity} Units</span>
                      <span className="text-sm font-semibold text-slate-600">{stock.percent}%</span>
                    </div>
                    <div className="mt-2 h-2 w-20 rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full ${stock.bar}`} style={{ width: `${stock.percent}%` }} />
                    </div>
                  </div>

                  {/* Status badge */}
                  <div>
                    <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${stock.badge}`}>
                      {stock.label}
                    </span>
                  </div>

                  {/* Action menu */}
                  <div className="relative flex items-center justify-end">
                    <button
                      onClick={() => setOpenMenuId(isOpen ? null : product.id)}
                      className={`rounded-2xl border p-2.5 transition-all duration-200 ${
                        isOpen
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm'
                          : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {isOpen && (
                      // ✅ FIX 3: top-full mt-2 normally, bottom-full mb-2 when near bottom
                      <div
                        className={`absolute right-0 z-50 w-48 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm ${
                          isNearBottom ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                      >
                        <div className="mb-1 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Actions
                        </div>
                        <button
                          onClick={() => { setOpenMenuId(null); onEdit(product) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                            <PencilLine size={15} />
                          </span>
                          Edit Product
                        </button>
                        <div className="my-1.5 border-t border-slate-100" />
                        <button
                          onClick={() => { setOpenMenuId(null); onDelete(product) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500">
                            <Trash2 size={15} />
                          </span>
                          Delete Product
                        </button>
                      </div>
                    )}
                  </div>
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