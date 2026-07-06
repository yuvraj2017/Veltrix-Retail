import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, PackageCheck, Trash2, X } from 'lucide-react'

import type { LocalInvoiceItem } from '../../features/billing/types'
import ProductCodeSearch from './ProductCodeSearch'
import type { BillingProduct } from '../../features/billing/types'

type InvoiceItemsTableProps = {
  items: LocalInvoiceItem[]
  onItemsChange: (items: LocalInvoiceItem[]) => void
}

type RecalculationMode = 'discount' | 'unit-price' | 'total' | 'preserve-unit-price'

const money = (value: number) => {
  return value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const toNumber = (value: string | number) => Number(value || 0)
const roundMoney = (value: number) => Number(value.toFixed(2))
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getInputValue = (value: number) => {
  return value === 0 ? '' : value
}

const buildLocalItem = (product: BillingProduct): LocalInvoiceItem => {
  const mrp = toNumber(product.mrp)
  const buyPrice = toNumber(product.buying_price)
  const quantity = 1
  const sellingPricePerUnit = mrp
  const totalSellingPrice = sellingPricePerUnit * quantity
  const totalBuyCost = buyPrice * quantity

  return {
    product_id: product.id,
    product_code: product.product_code,
    product_name: product.name,
    category: product.category,
    unit: product.unit,
    mrp,
    buy_price: buyPrice,
    available_stock: toNumber(product.available_stock),
    quantity,
    discount_percentage: 0,
    discount_amount_per_unit: 0,
    selling_price_per_unit: sellingPricePerUnit,
    total_discount_amount: 0,
    total_selling_price: totalSellingPrice,
    total_buy_cost: totalBuyCost,
    profit_per_unit: sellingPricePerUnit - buyPrice,
    total_profit: totalSellingPrice - totalBuyCost,
  }
}

const recalculateItem = (
  item: LocalInvoiceItem,
  updates: Partial<LocalInvoiceItem>,
  mode: RecalculationMode = 'preserve-unit-price'
): LocalInvoiceItem => {
  const next = { ...item, ...updates }

  const quantity = Math.max(Number(next.quantity || 0), 0)
  const mrp = Math.max(Number(next.mrp || 0), 0)
  const buyPrice = Math.max(Number(next.buy_price || 0), 0)

  let discountPercentage = clamp(Number(next.discount_percentage || 0), 0, 100)
  let sellingPricePerUnit = roundMoney(clamp(Number(next.selling_price_per_unit || 0), 0, mrp))

  if (mode === 'discount') {
    const discountAmount = roundMoney((mrp * discountPercentage) / 100)
    sellingPricePerUnit = roundMoney(Math.max(mrp - discountAmount, 0))
  } else if (mode === 'total') {
    const requestedTotal = Math.max(Number(next.total_selling_price || 0), 0)
    const derivedUnitPrice = quantity > 0 ? requestedTotal / quantity : 0
    sellingPricePerUnit = roundMoney(clamp(derivedUnitPrice, 0, mrp))
  } else {
    sellingPricePerUnit = roundMoney(clamp(Number(next.selling_price_per_unit || 0), 0, mrp))
  }

  const discountAmountPerUnit = roundMoney(Math.max(mrp - sellingPricePerUnit, 0))
  discountPercentage = mrp > 0 ? roundMoney((discountAmountPerUnit / mrp) * 100) : 0

  const totalDiscountAmount = roundMoney(discountAmountPerUnit * quantity)
  const totalSellingPrice = roundMoney(sellingPricePerUnit * quantity)
  const totalBuyCost = roundMoney(buyPrice * quantity)
  const profitPerUnit = roundMoney(sellingPricePerUnit - buyPrice)
  const totalProfit = roundMoney(totalSellingPrice - totalBuyCost)

  return {
    ...next,
    quantity,
    discount_percentage: discountPercentage,
    discount_amount_per_unit: discountAmountPerUnit,
    selling_price_per_unit: sellingPricePerUnit,
    total_discount_amount: totalDiscountAmount,
    total_selling_price: totalSellingPrice,
    total_buy_cost: totalBuyCost,
    profit_per_unit: profitPerUnit,
    total_profit: totalProfit,
  }
}

export default function InvoiceItemsTable({ items, onItemsChange }: InvoiceItemsTableProps) {
  const [stockAlert, setStockAlert] = useState<{
    productName: string
    availableStock: number
    requestedQuantity?: number
  } | null>(null)

  const showStockAlert = (
    productName: string,
    availableStock: number,
    requestedQuantity?: number
  ) => {
    setStockAlert({
      productName,
      availableStock,
      requestedQuantity,
    })
  }

  const addProduct = (product: BillingProduct) => {
    const availableStock = toNumber(product.available_stock)

    if (availableStock <= 0) {
      showStockAlert(product.name, availableStock, 1)
      return
    }

    const existing = items.find((item) => item.product_id === product.id)

    if (existing) {
      if (existing.quantity >= existing.available_stock) {
        showStockAlert(existing.product_name, existing.available_stock, existing.quantity + 1)
        return
      }

      onItemsChange(
        items.map((item) => {
          if (item.product_id !== product.id) return item

          return recalculateItem(
            item,
            {
              quantity: Math.min(item.quantity + 1, item.available_stock),
            },
            'preserve-unit-price'
          )
        })
      )
      return
    }

    onItemsChange([...items, buildLocalItem(product)])
  }

  const updateItem = (
    productId: number,
    updates: Partial<LocalInvoiceItem>,
    mode: RecalculationMode = 'preserve-unit-price'
  ) => {
    onItemsChange(
      items.map((item) => {
        if (item.product_id !== productId) return item
        return recalculateItem(item, updates, mode)
      })
    )
  }

  const removeItem = (productId: number) => {
    onItemsChange(items.filter((item) => item.product_id !== productId))
  }

  return (
    <section className="rounded-[34px] bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-8">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <PackageCheck size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">
              Line Items
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Add products, then adjust discount, unit price, or total as needed.
            </p>
          </div>
        </div>

        <div className="rounded-full bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-black text-slate-600 dark:text-slate-300">
          {items.length} Items Added
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-6 hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_0.4fr] px-4 text-[12px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 lg:grid">
          <div>Product Details</div>
          <div>MRP</div>
          <div>Qty</div>
          <div>Discount %</div>
          <div>Unit Price</div>
          <div>Total</div>
          <div />
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={item.product_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="grid grid-cols-1 items-center gap-4 rounded-[26px] bg-slate-50/90 dark:bg-slate-700/50 p-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_0.4fr]"
          >
            <div>
              <p className="font-black text-slate-950 dark:text-white">{item.product_name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Code: {item.product_code} • Stock: {item.available_stock}
              </p>
            </div>

            <p className="font-black text-slate-800 dark:text-slate-200">
              {money(item.mrp)}
            </p>

            <input
              type="number"
              min={0}
              max={item.available_stock}
              value={getInputValue(item.quantity)}
              placeholder="0"
              onFocus={(event) => {
                if (event.target.value === '0') event.target.select()
              }}
              onChange={(event) => {
                const value = event.target.value
                const parsedValue = value === '' ? 0 : Number(value)

                if (parsedValue > item.available_stock) {
                  showStockAlert(item.product_name, item.available_stock, parsedValue)
                }

                updateItem(
                  item.product_id,
                  {
                    quantity: value === '' ? 0 : Math.min(parsedValue, item.available_stock),
                  },
                  'preserve-unit-price'
                )
              }}
              className="h-12 rounded-2xl border border-indigo-100 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 font-bold text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
            />

            <input
              type="number"
              min={0}
              max={100}
              value={getInputValue(item.discount_percentage)}
              placeholder="0"
              onFocus={(event) => {
                if (event.target.value === '0') event.target.select()
              }}
              onChange={(event) => {
                const value = event.target.value

                updateItem(
                  item.product_id,
                  {
                    discount_percentage:
                      value === '' ? 0 : Number(value),
                  },
                  'discount'
                )
              }}
              className="h-12 rounded-2xl border border-indigo-100 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 font-bold text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
            />

            <div>
              <input
                type="number"
                min={0}
                max={item.mrp}
                step="0.01"
                value={getInputValue(item.selling_price_per_unit)}
                placeholder="0"
                onFocus={(event) => {
                  if (event.target.value === '0') event.target.select()
                }}
                onChange={(event) => {
                  const value = event.target.value

                  updateItem(
                    item.product_id,
                    {
                      selling_price_per_unit:
                        value === '' ? 0 : Number(value),
                    },
                    'unit-price'
                  )
                }}
                className="h-12 w-full rounded-2xl border border-indigo-100 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 font-bold text-indigo-700 dark:text-indigo-400 outline-none transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
              />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Discount {money(item.discount_amount_per_unit)}
              </p>
            </div>

            <div>
              <input
                type="number"
                min={0}
                max={item.mrp * item.quantity}
                step="0.01"
                value={getInputValue(item.total_selling_price)}
                placeholder="0"
                onFocus={(event) => {
                  if (event.target.value === '0') event.target.select()
                }}
                onChange={(event) => {
                  const value = event.target.value

                  updateItem(
                    item.product_id,
                    {
                      total_selling_price:
                        value === '' ? 0 : Number(value),
                    },
                    'total'
                  )
                }}
                className="h-12 w-full rounded-2xl border border-indigo-100 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 font-bold text-slate-950 dark:text-white outline-none transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
              />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Profit {money(item.total_profit)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.product_id)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <Trash2 size={17} />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-6">
        <ProductCodeSearch onAddProduct={addProduct} />
      </div>

      {stockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[30px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)] dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Stock limit reached
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    `{stockAlert.productName}` only has {stockAlert.availableStock} item
                    {stockAlert.availableStock === 1 ? '' : 's'} available in stock.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStockAlert(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {typeof stockAlert.requestedQuantity === 'number' && (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Requested quantity: {stockAlert.requestedQuantity}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setStockAlert(null)}
                className="inline-flex h-12 items-center justify-center rounded-[18px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.24)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
