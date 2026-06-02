import { useState } from 'react'
import type { LowStockProduct } from '../../features/dashboard/types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/v1\/?$/, '') ||
  'http://127.0.0.1:8000'

function getProductImageUrl(image?: string | null) {
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  if (image.startsWith('/')) return `${API_BASE_URL}${image}`
  return `${API_BASE_URL}/${image}`
}

function ProductImage({ image, name }: { image?: string | null; name: string }) {
  const [hasError, setHasError] = useState(false)
  const imageUrl = getProductImageUrl(image)

  if (!imageUrl || hasError) {
    return (
      <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#eef1f6] text-[9px] sm:text-[10px] font-bold text-slate-500">
        No Image
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      onError={() => setHasError(true)}
      className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-xl sm:rounded-2xl bg-[#eef1f6] object-cover"
    />
  )
}

export function LowStockList({ products }: { products: LowStockProduct[] }) {
  return (
    <div className="w-full rounded-[1.5rem] sm:rounded-[2rem] bg-white/90 p-4 sm:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-red-500">
          Immediate Action Required
        </p>
        <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-950">
          Low Stock Products
        </h3>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {products.length === 0 ? (
          <div className="flex min-h-[160px] sm:min-h-[180px] flex-col items-center justify-center rounded-[1.25rem] sm:rounded-[1.5rem] bg-[#f8f9fd] px-4 sm:px-5 text-center">
            <div className="mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <span className="text-lg sm:text-xl">✓</span>
            </div>
            <p className="text-sm font-bold text-slate-700">No low stock products right now.</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Products needing restock will appear here.
            </p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="group flex items-center gap-3 sm:gap-4 rounded-[1.2rem] sm:rounded-[1.4rem] bg-[#f8f9fd]/60 p-2.5 sm:p-3 transition hover:bg-indigo-50/70"
            >
              <ProductImage image={product.image} name={product.name} />

              {/* Name + SKU — grows to fill available space */}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs sm:text-sm font-bold text-slate-950 leading-snug">
                  {product.name}
                </p>
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-slate-500 truncate">
                  SKU: {product.sku || '-'}
                </p>
              </div>

              {/* Stock count + action — always right-aligned, never wraps */}
              <div className="shrink-0 text-right flex flex-col items-end gap-1.5 sm:gap-2">
                <p className="text-xs sm:text-sm font-extrabold text-red-600 whitespace-nowrap">
                  {product.left} Left
                </p>
                <button className="rounded-full bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 shadow-sm transition group-hover:bg-indigo-600 group-hover:text-white whitespace-nowrap">
                  Restock
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {products.length > 0 && (
        <button className="mt-4 sm:mt-6 w-full rounded-xl sm:rounded-2xl bg-red-50 px-4 py-3 sm:py-4 text-xs sm:text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.98]">
          Bulk Order All Low Stock
        </button>
      )}
    </div>
  )
}