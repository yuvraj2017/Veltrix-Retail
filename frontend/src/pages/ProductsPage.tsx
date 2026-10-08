import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ProductStats } from '../components/products/ProductStats'
import { ProductTable } from '../components/products/ProductTable'
import { EditProductModal } from '../components/products/EditProductModal'
import {
  deleteProduct,
  getProductCategories,
  getProducts,
  getProductStats,
  updateProduct,
} from '../features/products/api'
import type { Product, ProductStats as ProductStatsType } from '../features/products/types'
import type { ProductFormValues } from '../features/products/schemas'
import { useBranch } from '../context/BranchContext'
import { branchQueryKey, branchQueryPrefix } from '../lib/branch-query-keys'

const PAGE_SIZE = 50

const emptyStats: ProductStatsType = {
  total_items: 0,
  out_of_stock: 0,
  low_stock_count: 0,
  inventory_value: '0',
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const { selectedBranchId } = useBranch()

  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Debounce drives the query key, so typing does not spawn a cache entry per
  // intermediate keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Any change to filters or sort order invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, category, stockStatus, sortBy])

  // Categories come from their own endpoint now. Deriving them in the browser
  // required downloading the whole product table a second time on every mount.
  const categoriesQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'products', 'categories'),
    queryFn: getProductCategories,
  })

  const statsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'products', 'stats'),
    queryFn: getProductStats,
  })

  // Sorting and paging are applied by the server. With paginated results,
  // sorting only the current page in the browser would order the wrong rows.
  const productsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'products', 'list', debouncedSearch, category, stockStatus, sortBy, page),
    queryFn: () =>
      getProducts({
        search: debouncedSearch || undefined,
        category: category || undefined,
        stock_status: stockStatus || undefined,
        sort_by: sortBy,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const products: Product[] = productsQuery.data?.items ?? []
  const total = productsQuery.data?.total ?? 0
  const allCategories: string[] = categoriesQuery.data ?? []
  const stats: ProductStatsType = statsQuery.data ?? emptyStats

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Mutations invalidate the whole 'products' key: list, stats, and categories
  // can all change when a product is edited or removed.
  const refreshProducts = async () => {
    await queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'products') })
  }

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(`Deactivate ${product.name}? Historical inventory records will be preserved.`)
    if (!ok) return

    try {
      await deleteProduct(product.id)
      await refreshProducts()
    } catch (error) {
      console.error('Failed to deactivate product', error)
    }
  }

  const handleEditSubmit = async (values: ProductFormValues, newImages: File[]) => {
    if (!selectedProduct) return

    setEditLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('sku', values.sku)
      formData.append('category', values.category)
      formData.append('description', values.description || '')
      formData.append('buying_price', String(values.buying_price))
      formData.append('mrp', String(values.mrp))
      formData.append('selling_price', String(values.selling_price))
      formData.append('hsn_sac', values.hsn_sac || '')
      formData.append('gst_rate', String(values.gst_rate || 0))
      formData.append('low_stock_threshold', String(values.low_stock_threshold))
      formData.append('unit', values.unit)
      formData.append('barcode', values.barcode || '')
      formData.append('is_active', String(values.is_active))
      formData.append('main_image_url', values.main_image_url || '')

      newImages.forEach((file) => {
        formData.append('images', file)
      })

      await updateProduct(selectedProduct.id, formData)

      setSelectedProduct(null)
      await refreshProducts()
    } catch (error) {
      console.error('Failed to update product', error)
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <>
      {/* Responsive container: full width on mobile, capped on large screens */}
      <div className="mx-auto w-full max-w-[1600px] px-4 mt-2 sm:px-6 lg:px-8">

        {/* Page header: stacks on mobile, fits side-by-side on sm+ */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 sm:text-4xl dark:text-slate-100 lg:text-5xl">
            Product Inventory
          </h1>
          <p className="mt-1 text-base text-slate-500 sm:mt-2 sm:text-lg lg:text-2xl">
            Manage your retail stock levels and catalog details.
          </p>
        </div>

        {/* Stats cards — the grid inside ProductStats should use responsive columns.
            Wrap in a div that constrains overflow on very small screens. */}
        <div className="overflow-x-auto pb-1 sm:overflow-visible">
          <ProductStats stats={stats} />
        </div>

        {/* Product table — allow horizontal scroll on narrow screens */}
        <div className="mt-6 sm:mt-8">
          <div className="overflow-x-auto rounded-xl">
            <ProductTable
              products={products}
              allCategories={allCategories}
              search={search}
              onSearchChange={setSearch}
              category={category}
              onCategoryChange={setCategory}
              stockStatus={stockStatus}
              onStockStatusChange={setStockStatus}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onEdit={setSelectedProduct}
              onDelete={handleDelete}
              onAdd={() => navigate('/products/new')}
            />
          </div>

          {/* Pagination. Only rendered when the result set exceeds one page, so
              shops with a small catalog see no extra chrome. */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-800 sm:flex-row">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {total}
                </span>{' '}
                products
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Previous
                </button>

                <span className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <EditProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSubmit={handleEditSubmit}
          onStockChanged={refreshProducts}
          loading={editLoading}
        />
      </div>
    </>
  )
}
