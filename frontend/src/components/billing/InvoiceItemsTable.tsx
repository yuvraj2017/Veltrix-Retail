import { motion } from 'framer-motion'
import { PackageCheck, Trash2 } from 'lucide-react'

import type { LocalInvoiceItem } from '../../features/billing/types'
import ProductCodeSearch from './ProductCodeSearch'
import type { BillingProduct } from '../../features/billing/types'

type InvoiceItemsTableProps = {
  items: LocalInvoiceItem[]
  onItemsChange: (items: LocalInvoiceItem[]) => void
}

const money = (value: number) => {
  return value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const toNumber = (value: string | number) => Number(value || 0)

const buildLocalItem = (product: BillingProduct): LocalInvoiceItem => {
  const mrp = toNumber(product.mrp)
  const buyPrice = toNumber(product.buying_price)
  const quantity = 1
  const discountPercentage = 0
  const discountAmountPerUnit = 0
  const sellingPricePerUnit = mrp
  const totalSellingPrice = sellingPricePerUnit * quantity
  const totalBuyCost = buyPrice * quantity
  const profitPerUnit = sellingPricePerUnit - buyPrice
  const totalProfit = totalSellingPrice - totalBuyCost

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
    discount_percentage: discountPercentage,
    discount_amount_per_unit: discountAmountPerUnit,
    selling_price_per_unit: sellingPricePerUnit,
    total_discount_amount: discountAmountPerUnit * quantity,
    total_selling_price: totalSellingPrice,
    total_buy_cost: totalBuyCost,
    profit_per_unit: profitPerUnit,
    total_profit: totalProfit,
  }
}

const recalculateItem = (
  item: LocalInvoiceItem,
  updates: Partial<LocalInvoiceItem>
): LocalInvoiceItem => {
  const next = {
    ...item,
    ...updates,
  }

  const quantity = Math.max(Number(next.quantity || 0), 0)
  const discountPercentage = Math.min(
    Math.max(Number(next.discount_percentage || 0), 0),
    100
  )

  const discountAmountPerUnit = Number(
    ((next.mrp * discountPercentage) / 100).toFixed(2)
  )

  const sellingPricePerUnit = Number(
    Math.max(next.mrp - discountAmountPerUnit, 0).toFixed(2)
  )

  const totalDiscountAmount = Number(
    (discountAmountPerUnit * quantity).toFixed(2)
  )
  const totalSellingPrice = Number((sellingPricePerUnit * quantity).toFixed(2))
  const totalBuyCost = Number((next.buy_price * quantity).toFixed(2))
  const profitPerUnit = Number((sellingPricePerUnit - next.buy_price).toFixed(2))
  const totalProfit = Number((totalSellingPrice - totalBuyCost).toFixed(2))

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

export default function InvoiceItemsTable({
  items,
  onItemsChange,
}: InvoiceItemsTableProps) {
  const addProduct = (product: BillingProduct) => {
    const existing = items.find((item) => item.product_id === product.id)

    if (existing) {
      const updated = items.map((item) => {
        if (item.product_id !== product.id) return item

        const nextQuantity = Math.min(
          item.quantity + 1,
          item.available_stock
        )

        return recalculateItem(item, {
          quantity: nextQuantity,
        })
      })

      onItemsChange(updated)
      return
    }

    onItemsChange([...items, buildLocalItem(product)])
  }

  const updateItem = (
    productId: number,
    updates: Partial<LocalInvoiceItem>
  ) => {
    onItemsChange(
      items.map((item) => {
        if (item.product_id !== productId) return item

        return recalculateItem(item, updates)
      })
    )
  }

  const removeItem = (productId: number) => {
    onItemsChange(items.filter((item) => item.product_id !== productId))
  }

  return (
    <section className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-8">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <PackageCheck size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950">
              Line Items
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Add products, quantity, and discount details.
            </p>
          </div>
        </div>

        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
          {items.length} Items Added
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-6 hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_0.4fr] px-4 text-[12px] font-black uppercase tracking-[0.18em] text-slate-500 lg:grid">
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
            className="grid grid-cols-1 items-center gap-4 rounded-[26px] bg-slate-50/90 p-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_0.4fr]"
          >
            <div>
              <p className="font-black text-slate-950">
                {item.product_name}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Code: {item.product_code} • Stock: {item.available_stock}
              </p>
            </div>

            <p className="font-black text-slate-800">{money(item.mrp)}</p>

            <input
              type="number"
              min={1}
              max={item.available_stock}
              value={item.quantity}
              onChange={(event) => {
                const value = Number(event.target.value || 0)

                updateItem(item.product_id, {
                  quantity: Math.min(value, item.available_stock),
                })
              }}
              className="h-12 rounded-2xl border border-indigo-100 bg-white px-3 font-bold outline-none focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
            />

            <input
              type="number"
              min={0}
              max={100}
              value={item.discount_percentage}
              onChange={(event) =>
                updateItem(item.product_id, {
                  discount_percentage: Number(event.target.value || 0),
                })
              }
              className="h-12 rounded-2xl border border-indigo-100 bg-white px-3 font-bold outline-none focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
            />

            <div>
              <p className="font-black text-indigo-700">
                {money(item.selling_price_per_unit)}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Discount {money(item.discount_amount_per_unit)}
              </p>
            </div>

            <div>
              <p className="font-black text-slate-950">
                {money(item.total_selling_price)}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Profit {money(item.total_profit)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.product_id)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
            >
              <Trash2 size={17} />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-6">
        <ProductCodeSearch onAddProduct={addProduct} />
      </div>
    </section>
  )
}