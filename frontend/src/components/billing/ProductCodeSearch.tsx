import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Barcode, PackageSearch, Plus, Search, X } from 'lucide-react'

import { billingApi } from '../../features/billing/api'
import type { BillingProduct } from '../../features/billing/types'

type ProductCodeSearchProps = {
  onAddProduct: (product: BillingProduct) => void
}

const money = (value: string | number) => {
  const amount = Number(value || 0)

  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

export default function ProductCodeSearch({ onAddProduct }: ProductCodeSearchProps) {
  const [code, setCode] = useState('')
  const [results, setResults] = useState<BillingProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const addProduct = (product: BillingProduct) => {
    onAddProduct(product)
    setCode('')
    setResults([])
    setErrorMessage('')
  }

  const directAddByCode = async () => {
    const cleaned = code.trim()

    if (!cleaned) return

    try {
      setIsSearching(true)
      setErrorMessage('')

      const product = await billingApi.getBillingProductByCode(cleaned)
      addProduct(product)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Product not found'
      )
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const cleaned = code.trim()

    if (cleaned.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        setErrorMessage('')

        const data = await billingApi.searchBillingProducts(cleaned)
        setResults(data)
      } catch (error) {
        console.error('Failed to search billing products', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [code])

  return (
    <div className="rounded-[28px] border border-dashed border-indigo-200 bg-indigo-50/30 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
          <Barcode size={22} />
        </div>

        <div>
          <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">
            Add Product Line
          </h3>
          <p className="text-sm font-medium text-slate-500">
            Enter SKU, barcode, product code, or product name.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_150px]">
        <div className="relative">
          <Search
            size={19}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                directAddByCode()
              }
            }}
            placeholder="Enter product code / SKU / barcode..."
            className="h-14 w-full rounded-[20px] border border-indigo-100 bg-white px-5 pl-14 text-[15px] font-medium text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
          />

          {code && (
            <button
              type="button"
              onClick={() => {
                setCode('')
                setResults([])
              }}
              className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={directAddByCode}
          disabled={isSearching}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.26)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus size={18} />
          Add Line
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 text-sm font-black text-red-600">{errorMessage}</p>
      )}

      {isSearching && (
        <p className="mt-3 text-sm font-semibold text-indigo-600">
          Searching products...
        </p>
      )}

      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 grid gap-3"
        >
          {results.slice(0, 5).map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className="flex items-center gap-4 rounded-[22px] bg-white p-4 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
            >
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <PackageSearch size={23} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950">
                  {product.name}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Code: {product.product_code} • Stock:{' '}
                  {Number(product.available_stock || 0)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-black text-slate-950">
                  {money(product.mrp)}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  MRP
                </p>
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}