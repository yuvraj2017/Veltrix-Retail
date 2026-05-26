import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProductStats } from '../components/products/ProductStats'
import { ProductTable } from '../components/products/ProductTable'
import { EditProductModal } from '../components/products/EditProductModal'
import { AppShell } from '../components/layout/AppShell'
import {
  deleteProduct,
  getProducts,
  getProductStats,
  updateProduct,
} from '../features/products/api'
import type { Product, ProductStats as ProductStatsType } from '../features/products/types'
import type { ProductFormValues } from '../features/products/schemas'

export default function ProductsPage() {
  const navigate = useNavigate()

  const [stats, setStats] = useState<ProductStatsType>({
    total_items: 0,
    out_of_stock: 0,
    low_stock_count: 0,
    inventory_value: '0',
  })

  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const allCategories = useMemo(
    () => Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean))),
    [allProducts]
  )

  const sortedProducts = useMemo(() => {
    const items = [...products]

    items.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'name_asc':
          return a.name.localeCompare(b.name)
        case 'name_desc':
          return b.name.localeCompare(a.name)
        case 'stock_asc':
          return a.stock_quantity - b.stock_quantity
        case 'stock_desc':
          return b.stock_quantity - a.stock_quantity
        default:
          return 0
      }
    })

    return items
  }, [products, sortBy])

  const loadAllProducts = async () => {
    try {
      const data = await getProducts()
      setAllProducts(data.items)
    } catch (error) {
      console.error('Failed to load all products', error)
    }
  }

  const loadProducts = async () => {
    try {
      const data = await getProducts({
        search: search || undefined,
        category: category || undefined,
        stock_status: stockStatus || undefined,
      })
      setProducts(data.items)
    } catch (error) {
      console.error('Failed to load products', error)
    }
  }

  const loadStats = async () => {
    try {
      const data = await getProductStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load product stats', error)
    }
  }

  useEffect(() => {
    loadStats()
    loadAllProducts()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      loadProducts()
    }, 250)
    return () => clearTimeout(t)
  }, [search, category, stockStatus])

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(`Delete ${product.name}?`)
    if (!ok) return

    try {
      await deleteProduct(product.id)
      await loadProducts()
      await loadAllProducts()
      await loadStats()
    } catch (error) {
      console.error('Failed to delete product', error)
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
      formData.append('stock_quantity', String(values.stock_quantity))
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
      await loadProducts()
      await loadAllProducts()
      await loadStats()
    } catch (error) {
      console.error('Failed to update product', error)
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <AppShell>
      {/* Responsive container: full width on mobile, capped on large screens */}
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">

        {/* Page header: stacks on mobile, fits side-by-side on sm+ */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 sm:text-4xl lg:text-5xl">
            Product Inventory
          </h1>
          <p className="mt-1 text-base text-slate-600 sm:mt-2 sm:text-lg lg:text-2xl">
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
              products={sortedProducts}
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
        </div>

        <EditProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSubmit={handleEditSubmit}
          loading={editLoading}
        />
      </div>
    </AppShell>
  )
}