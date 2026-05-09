import { ArrowUpRight, Check, ChevronDown, MoreVertical, PencilLine, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Product } from '../../features/products/types'

type FilterOption = {
  label: string
  value: string
}

function getStockStatus(product: Product) {
  if (product.stock_quantity === 0) {
    return {
      label: 'Out of Stock',
      badge: 'bg-red-100 text-red-600',
      percent: 0,
      bar: 'bg-red-500',
    }
  }

  if (product.stock_quantity <= product.low_stock_threshold) {
    const percent = Math.min(
      100,
      Math.round((product.stock_quantity / Math.max(product.low_stock_threshold, 1)) * 100)
    )
    return {
      label: 'Low Stock',
      badge: 'bg-orange-100 text-orange-600',
      percent,
      bar: 'bg-orange-500',
    }
  }

  return {
    label: 'In Stock',
    badge: 'bg-emerald-100 text-emerald-600',
    percent: 100,
    bar: 'bg-emerald-500',
  }
}

function getCategoryTileStyles(category: string) {
  const key = category.toLowerCase()

  if (key.includes('apparel')) {
    return 'from-violet-100 to-fuchsia-100 text-violet-700 ring-violet-200'
  }
  if (key.includes('electronics')) {
    return 'from-sky-100 to-blue-100 text-blue-700 ring-blue-200'
  }
  if (key.includes('footwear')) {
    return 'from-emerald-100 to-green-100 text-emerald-700 ring-emerald-200'
  }
  if (key.includes('accessories')) {
    return 'from-amber-100 to-orange-100 text-orange-700 ring-orange-200'
  }
  if (key.includes('home')) {
    return 'from-rose-100 to-pink-100 text-rose-700 ring-rose-200'
  }

  return 'from-slate-100 to-slate-200 text-slate-700 ring-slate-200'
}

function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
  widthClass = 'min-w-[190px]',
}: {
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  placeholder: string
  widthClass?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find((item) => item.value === value)

  return (
    <div ref={wrapperRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-medium transition-all duration-200 ${
          open
            ? 'border-indigo-300 bg-white shadow-lg shadow-indigo-100'
            : 'border-slate-200 bg-[#f3f5f9] hover:border-slate-300 hover:bg-white'
        }`}
      >
        <span className="truncate text-slate-700">
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
          <div>
            {options.map((option) => {
              const isSelected = option.value === value

              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={16} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  stockStatus: string
  onStockStatusChange: (value: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onAdd: () => void
}) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  const categoryOptions: FilterOption[] = [
    { label: 'All Categories', value: '' },
    ...allCategories.map((item) => ({
      label: item,
      value: item,
    })),
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

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-white/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/70 to-transparent" />
      <div className="pointer-events-none absolute -top-24 right-10 h-40 w-40 rounded-full bg-indigo-100/30 blur-3xl" />

      <div className="flex items-center justify-between px-8 pt-8">
        <div />
          <button
            onClick={onAdd}
            className="group relative overflow-hidden rounded-[22px] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3.5 text-white shadow-[0_14px_32px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.35)] active:translate-y-0"
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%)]" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

            <span className="relative flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
                <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
              </span>

              <span className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">
                  Inventory
                </span>
                <span className="text-base font-semibold">
                  Add Product
                </span>
              </span>

              <ArrowUpRight
                size={18}
                className="ml-1 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </span>
          </button>



        {/* <button
          onClick={onAdd}
          className="group relative overflow-hidden rounded-[22px] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3.5 text-white shadow-[0_14px_32px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.35)] active:translate-y-0"
        >
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%)]" />
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

          <span className="relative flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
              +
            </span>

            <span className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">
                Inventory
              </span>
              <span className="text-base font-semibold">Add Product</span>
            </span>
          </span>
        </button> */}
      </div>

      <div className="flex flex-wrap items-center gap-4 px-8 py-8">
        <div className="relative w-full max-w-md">
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

        <FilterDropdown
          value={category}
          onChange={onCategoryChange}
          options={categoryOptions}
          placeholder="All Categories"
          widthClass="min-w-[200px]"
        />

        <FilterDropdown
          value={stockStatus}
          onChange={onStockStatusChange}
          options={stockOptions}
          placeholder="Stock Status"
          widthClass="min-w-[180px]"
        />

        <FilterDropdown
          value={sortBy}
          onChange={onSortChange}
          options={sortOptions}
          placeholder="Sort By"
          widthClass="min-w-[190px]"
        />
      </div>

      <div className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] px-8 py-5 text-xs font-semibold tracking-[0.18em] text-slate-500">
        <span>PRODUCT DETAILS</span>
        <span>SKU</span>
        <span>CATEGORY</span>
        <span>PRICING</span>
        <span>STOCK LEVEL</span>
        <span>STATUS</span>
        <span />
      </div>

      <div className="pb-6">
        {products.map((product) => {
          const stock = getStockStatus(product)
          const tileStyles = getCategoryTileStyles(product.category)

          return (
            <div
              key={product.id}
              className="grid grid-cols-[2.1fr_1fr_1.1fr_1fr_1.1fr_1fr_60px] items-center px-8 py-6 hover:bg-[#f8f9fd]"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold ring-1 ${tileStyles}`}
                >
                  {product.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <p className="text-xl font-semibold text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.description || product.unit}</p>
                </div>
              </div>

              <div className="text-sm text-slate-600">{product.sku}</div>

              <div>
                <span className="rounded-xl bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700">
                  {product.category}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xl font-semibold text-slate-900">MRP ${product.mrp}</p>
                <p className="text-sm font-medium text-slate-500">
                  Buying ${product.buying_price}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700">{product.stock_quantity} Units</span>
                  <span className="text-sm font-semibold text-slate-600">{stock.percent}%</span>
                </div>
                <div className="mt-2 h-2 w-20 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${stock.bar}`}
                    style={{ width: `${stock.percent}%` }}
                  />
                </div>
              </div>

              <div>
                <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${stock.badge}`}>
                  {stock.label}
                </span>
              </div>

              <div className="relative flex items-center justify-end">
                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === product.id ? null : product.id)
                  }
                  className={`rounded-2xl border p-2.5 transition-all duration-200 ${
                    openMenuId === product.id
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <MoreVertical size={18} />
                </button>

                {openMenuId === product.id && (
                  <div className="absolute right-0 top-14 z-30 w-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                    <div className="mb-2 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Actions
                    </div>

                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onEdit(product)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        <PencilLine size={15} />
                      </span>
                      <span>Edit Product</span>
                    </button>

                    <div className="my-2 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onDelete(product)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500">
                        <Trash2 size={15} />
                      </span>
                      <span>Delete Product</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {products.length === 0 && (
          <div className="px-8 py-16 text-center text-slate-500">No products found.</div>
        )}
      </div>
    </div>
  )
}