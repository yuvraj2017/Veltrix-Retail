import type { LowStockProduct } from '../../features/dashboard/types'

export function LowStockList({ products }: { products: LowStockProduct[] }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-slate-900">Low Stock Products</h3>
        <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-slate-500">
          IMMEDIATE ACTION REQUIRED
        </p>
      </div>

      <div className="space-y-5">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-4 rounded-2xl p-2 hover:bg-[#f8f9fd]">
            <img src={product.image} alt={product.name} className="h-16 w-16 rounded-2xl object-cover" />

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-sm text-slate-500">SKU: {product.sku}</p>
            </div>

            <div className="text-right">
              <p className="font-semibold text-red-600">{product.left} Left</p>
              <button className="mt-2 text-sm font-semibold text-indigo-600">RESTOCK</button>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-6 w-full rounded-2xl bg-red-100 px-4 py-4 text-sm font-semibold text-red-700">
        Bulk Order All Low Stock
      </button>
    </div>
  )
}