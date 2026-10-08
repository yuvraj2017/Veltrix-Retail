import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../features/staff/constants'
import { useBranch } from '../context/BranchContext'
import { branchQueryKey, branchQueryPrefix } from '../lib/branch-query-keys'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react'

import { getProducts } from '../features/products/api'
import type { Product } from '../features/products/types'
import {
  cancelPurchaseOrder,
  createGoodsReceipt,
  createPurchaseOrder,
  createPurchaseReturn,
  getGoodsReceipts,
  getPurchaseOrder,
  getPurchaseOrders,
  getPurchaseReturnEligibility,
  getPurchaseReturns,
  updatePurchaseOrder,
} from '../features/purchases/api'
import type { PurchaseOrder, PurchaseOrderPayload } from '../features/purchases/types'
import { vendorsApi } from '../features/vendors/api'


type DraftItem = {
  product_id: number
  product_name: string
  product_sku: string
  ordered_quantity: string
  unit_cost: string
}

const today = new Date().toISOString().slice(0, 10)
const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-950'

function money(value: string | number) {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

function requestId() {
  return crypto.randomUUID()
}

export default function PurchaseOrdersPage() {
  const { selectedBranchId } = useBranch()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManagePurchasing = hasPermission(PERMISSIONS.purchasingManage)
  const canReceivePurchasing = hasPermission(PERMISSIONS.purchasingReceive)
  const canReturnPurchasing = hasPermission(PERMISSIONS.purchasingReturn)
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedPurchaseOrderId = Number(searchParams.get('selected')) || null
  const [selectedId, setSelectedId] = useState<number | null>(linkedPurchaseOrderId)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [orderDate, setOrderDate] = useState(today)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [taxAmount, setTaxAmount] = useState('0')
  const [draftStatus, setDraftStatus] = useState<'draft' | 'ordered'>('ordered')
  const [productSearch, setProductSearch] = useState('')
  const [productToAdd, setProductToAdd] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [receiptQuantities, setReceiptQuantities] = useState<Record<number, string>>({})
  const [receiptCosts, setReceiptCosts] = useState<Record<number, string>>({})
  const [receiptDate, setReceiptDate] = useState(today)
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptRequestId, setReceiptRequestId] = useState<string | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({})
  const [returnDate, setReturnDate] = useState(today)
  const [returnReason, setReturnReason] = useState<'damaged' | 'defective' | 'wrong_item' | 'excess_quantity' | 'quality_issue' | 'other'>('damaged')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnRequestId, setReturnRequestId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [returning, setReturning] = useState(false)
  const [message, setMessage] = useState('')

  const ordersQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'purchase-orders'),
    queryFn: () => getPurchaseOrders(),
  })
  const vendorsQuery = useQuery({ queryKey: branchQueryKey(selectedBranchId, 'vendors', 'list'), queryFn: vendorsApi.getVendors })
  const productsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'products', 'purchase-picker', productSearch),
    queryFn: () => getProducts({
      search: productSearch.trim() || undefined,
      page: 1,
      page_size: 100,
      sort_by: 'name_asc',
    }),
  })
  const detailQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'purchase-orders', selectedId),
    queryFn: () => getPurchaseOrder(selectedId as number),
    enabled: selectedId !== null,
  })
  const receiptsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'purchase-orders', selectedId, 'receipts'),
    queryFn: () => getGoodsReceipts(selectedId as number),
    enabled: selectedId !== null,
  })
  const returnEligibilityQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'purchase-orders', selectedId, 'return-eligibility'),
    queryFn: () => getPurchaseReturnEligibility(selectedId as number),
    enabled: selectedId !== null,
  })
  const returnsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'purchase-orders', selectedId, 'returns'),
    queryFn: () => getPurchaseReturns(selectedId as number),
    enabled: selectedId !== null,
  })

  const orders = ordersQuery.data?.items ?? []
  const vendors = (vendorsQuery.data ?? []).filter((vendor) => vendor.is_active)
  const products = (productsQuery.data?.items ?? []).filter((product) => product.is_active)
  const selected = detailQuery.data ?? null

  useEffect(() => {
    if (linkedPurchaseOrderId) {
      setSelectedId(linkedPurchaseOrderId)
      return
    }
    if (selectedId === null && orders.length) setSelectedId(orders[0].id)
  }, [orders, selectedId, linkedPurchaseOrderId])

  const selectPurchaseOrder = (id: number) => {
    setSelectedId(id)
    setSearchParams({ selected: String(id) }, { replace: true })
  }

  const productById = useMemo(
    () => new Map<number, Product>(products.map((product) => [product.id, product])),
    [products],
  )
  const subtotal = draftItems.reduce(
    (sum, item) => sum + Number(item.ordered_quantity || 0) * Number(item.unit_cost || 0),
    0,
  )

  const resetOrderForm = () => {
    setEditingId(null)
    setVendorId('')
    setOrderDate(today)
    setExpectedDate('')
    setNotes('')
    setTaxAmount('0')
    setDraftStatus('ordered')
    setProductToAdd('')
    setDraftItems([])
    setMessage('')
  }

  const loadDraft = (po: PurchaseOrder) => {
    setEditingId(po.id)
    setVendorId(String(po.vendor_id))
    setOrderDate(po.order_date)
    setExpectedDate(po.expected_date || '')
    setNotes(po.notes || '')
    setTaxAmount(String(po.tax_amount))
    setDraftStatus('draft')
    setDraftItems(
      po.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        ordered_quantity: String(item.ordered_quantity),
        unit_cost: String(item.unit_cost),
      })),
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addProduct = () => {
    const id = Number(productToAdd)
    const product = productById.get(id)
    if (!product || draftItems.some((item) => item.product_id === id)) return
    setDraftItems((items) => [
      ...items,
      {
        product_id: id,
        product_name: product.name,
        product_sku: product.sku,
        ordered_quantity: '1',
        unit_cost: String(product.buying_price || 0),
      },
    ])
    setProductToAdd('')
    setProductSearch('')
  }

  const saveOrder = async () => {
    if (!vendorId || draftItems.length === 0) {
      setMessage('Select a vendor and add at least one product.')
      return
    }
    if (draftItems.some((item) => Number(item.ordered_quantity) <= 0 || Number(item.unit_cost) < 0)) {
      setMessage('Quantities must be positive and unit costs cannot be negative.')
      return
    }
    const payload: PurchaseOrderPayload = {
      vendor_id: Number(vendorId),
      order_date: orderDate,
      expected_date: expectedDate || null,
      status: draftStatus,
      notes: notes.trim() || null,
      tax_amount: Number(taxAmount || 0),
      items: draftItems.map((item) => ({
        product_id: item.product_id,
        ordered_quantity: Number(item.ordered_quantity),
        unit_cost: Number(item.unit_cost),
      })),
    }
    setSaving(true)
    setMessage('')
    try {
      const result = editingId
        ? await updatePurchaseOrder(editingId, payload)
        : await createPurchaseOrder(payload)
      await queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'purchase-orders') })
      selectPurchaseOrder(result.id)
      resetOrderForm()
      setMessage(`${result.purchase_order_number} saved.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save purchase order.')
    } finally {
      setSaving(false)
    }
  }

  const postReceipt = async () => {
    if (!selected) return
    const items = selected.items
      .map((item) => ({
        purchase_order_item_id: item.id,
        received_quantity: Number(receiptQuantities[item.id] || 0),
        unit_cost: receiptCosts[item.id] ? Number(receiptCosts[item.id]) : null,
      }))
      .filter((item) => item.received_quantity > 0)
    if (!items.length) {
      setMessage('Enter at least one received quantity.')
      return
    }
    const invalid = items.some((entry) => {
      const poItem = selected.items.find((item) => item.id === entry.purchase_order_item_id)
      return !Number.isInteger(entry.received_quantity) || entry.received_quantity > Number(poItem?.ordered_quantity || 0) - Number(poItem?.received_quantity || 0)
    })
    if (invalid) {
      setMessage('Received quantities must be whole units within the remaining order quantity.')
      return
    }
    if (!window.confirm('Post this goods receipt and increase sellable stock?')) return

    const key = receiptRequestId || requestId()
    setReceiptRequestId(key)
    setReceiving(true)
    setMessage('')
    try {
      const receipt = await createGoodsReceipt(selected.id, {
        client_request_id: key,
        received_date: receiptDate,
        notes: receiptNotes.trim() || null,
        items,
      })
      setReceiptRequestId(null)
      setReceiptQuantities({})
      setReceiptCosts({})
      setReceiptNotes('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'purchase-orders') }),
        queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'products') }),
      ])
      setMessage(`${receipt.receipt_number} posted. Inventory is updated.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post goods receipt.')
    } finally {
      setReceiving(false)
    }
  }

  const cancelSelected = async () => {
    if (!selected || !window.confirm(`Cancel ${selected.purchase_order_number}?`)) return
    try {
      await cancelPurchaseOrder(selected.id)
      await queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'purchase-orders') })
      setMessage('Purchase order cancelled. Inventory was not changed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to cancel purchase order.')
    }
  }

  const postPurchaseReturn = async () => {
    if (!selected) return
    const eligibility = returnEligibilityQuery.data ?? []
    const items = eligibility
      .map((item) => ({
        goods_receipt_item_id: item.goods_receipt_item_id,
        returned_quantity: Number(returnQuantities[item.goods_receipt_item_id] || 0),
      }))
      .filter((item) => item.returned_quantity > 0)
    if (!items.length) {
      setMessage('Enter at least one quantity to return.')
      return
    }
    const invalid = items.some((entry) => {
      const available = eligibility.find(
        (item) => item.goods_receipt_item_id === entry.goods_receipt_item_id,
      )
      return !Number.isInteger(entry.returned_quantity)
        || entry.returned_quantity > Number(available?.remaining_returnable_quantity || 0)
        || entry.returned_quantity > Number(available?.current_stock_quantity || 0)
    })
    if (invalid) {
      setMessage('Return quantities must be whole units within both received and sellable stock limits.')
      return
    }
    if (returnReason === 'other' && !returnNotes.trim()) {
      setMessage('Notes are required when the return reason is Other.')
      return
    }
    if (!window.confirm('Post this purchase return and remove the selected units from sellable stock?')) return

    const key = returnRequestId || requestId()
    setReturnRequestId(key)
    setReturning(true)
    setMessage('')
    try {
      const result = await createPurchaseReturn(selected.id, {
        client_request_id: key,
        return_date: returnDate,
        reason: returnReason,
        notes: returnNotes.trim() || null,
        items,
      })
      setReturnRequestId(null)
      setReturnQuantities({})
      setReturnNotes('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'purchase-orders') }),
        queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'products') }),
      ])
      setMessage(`${result.return_number} posted. Vendor credit ${money(result.total_amount)} is unapplied.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post purchase return.')
    } finally {
      setReturning(false)
    }
  }

  const updateReceiptInput = (setter: typeof setReceiptQuantities, itemId: number, value: string) => {
    setter((current) => ({ ...current, [itemId]: value }))
    setReceiptRequestId(null)
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-2 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Inventory purchasing</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-slate-100">Purchase Orders</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Order from vendors, receive partially, and keep stock history exact.</p>
        </div>
        {editingId && (
          <button type="button" onClick={resetOrderForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600 dark:text-slate-200">
            Stop Editing
          </button>
        )}
      </header>

      {message && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">{message}</p>}

      {canManagePurchasing && <section className="border-y border-slate-200 py-6 dark:border-slate-700">
        <div className="mb-5 flex items-center gap-2">
          <ShoppingCart size={20} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{editingId ? 'Edit Draft Order' : 'New Purchase Order'}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} className={inputClass}>
            <option value="">Select vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>)}
          </select>
          <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} className={inputClass} />
          <input type="date" value={expectedDate} min={orderDate} onChange={(event) => setExpectedDate(event.target.value)} className={inputClass} />
          <input type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} placeholder="Basic tax amount" className={inputClass} />
          <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as 'draft' | 'ordered')} className={inputClass}>
            <option value="draft">Save as draft</option>
            <option value="ordered">Place order</option>
          </select>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={productSearch}
            onChange={(event) => {
              setProductSearch(event.target.value)
              setProductToAdd('')
            }}
            placeholder="Search name, SKU, or barcode"
            className={inputClass}
          />
          <select value={productToAdd} onChange={(event) => setProductToAdd(event.target.value)} className={inputClass}>
            <option value="">Search/select product</option>
            {products.filter((product) => !draftItems.some((item) => item.product_id === product.id)).map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
            ))}
          </select>
          <button type="button" onClick={addProduct} disabled={!productToAdd} title="Add product" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-40">
            <Plus size={19} />
          </button>
        </div>

        {draftItems.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700"><tr><th className="py-3">Product</th><th>Quantity</th><th>Unit cost</th><th>Line total</th><th /></tr></thead>
              <tbody>
                {draftItems.map((item) => {
                  return (
                    <tr key={item.product_id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 font-semibold dark:text-slate-100">{item.product_name} <span className="text-xs text-slate-400">{item.product_sku}</span></td>
                      <td><input type="number" min="1" step="1" value={item.ordered_quantity} onChange={(event) => setDraftItems((items) => items.map((row) => row.product_id === item.product_id ? { ...row, ordered_quantity: event.target.value } : row))} className={`${inputClass} w-28`} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setDraftItems((items) => items.map((row) => row.product_id === item.product_id ? { ...row, unit_cost: event.target.value } : row))} className={`${inputClass} w-32`} /></td>
                      <td className="font-semibold dark:text-slate-200">{money(Number(item.ordered_quantity) * Number(item.unit_cost))}</td>
                      <td><button type="button" title="Remove product" onClick={() => setDraftItems((items) => items.filter((row) => row.product_id !== item.product_id))} className="p-2 text-rose-600"><Trash2 size={17} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Order notes" className={`${inputClass} h-auto py-3`} />
          <div className="flex items-center gap-4">
            <div className="text-right"><p className="text-xs uppercase text-slate-500">Total</p><p className="text-xl font-bold dark:text-slate-100">{money(subtotal + Number(taxAmount || 0))}</p></div>
            <button type="button" onClick={saveOrder} disabled={saving} className="flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><Save size={17} />{saving ? 'Saving...' : 'Save Order'}</button>
          </div>
        </div>
      </section>}

      <div className="grid gap-7 xl:grid-cols-[360px_1fr]">
        <section>
          <div className="mb-3 flex items-center gap-2"><ClipboardList size={19} className="text-indigo-600" /><h2 className="text-lg font-bold dark:text-slate-100">Orders</h2></div>
          <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {ordersQuery.isPending ? <p className="py-5 text-sm text-slate-500">Loading purchase orders...</p> : orders.length === 0 ? <p className="py-5 text-sm text-slate-500">No purchase orders yet.</p> : orders.map((po) => (
              <button key={po.id} type="button" onClick={() => selectPurchaseOrder(po.id)} className={`w-full px-3 py-4 text-left transition ${selectedId === po.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <div className="flex justify-between gap-2"><span className="font-bold text-slate-900 dark:text-slate-100">{po.purchase_order_number}</span><span className="text-xs font-semibold uppercase text-indigo-600">{po.status.replace('_', ' ')}</span></div>
                <div className="mt-2 flex justify-between text-sm text-slate-500"><span>{po.order_date}</span><span>{money(po.total_amount)}</span></div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          {!selected ? <p className="py-10 text-center text-slate-500">Select a purchase order.</p> : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
                <div><p className="text-sm font-semibold uppercase text-indigo-600">{selected.status.replace('_', ' ')}</p><h2 className="mt-1 text-2xl font-bold dark:text-slate-100">{selected.purchase_order_number}</h2><p className="mt-1 text-sm text-slate-500">Order {selected.order_date} · Expected {selected.expected_date || 'Not set'}</p></div>
                <div className="flex gap-2">
                  {canManagePurchasing && selected.status === 'draft' && <button type="button" onClick={() => loadDraft(selected)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600 dark:text-slate-200">Edit Draft</button>}
                  {canManagePurchasing && ['draft', 'ordered'].includes(selected.status) && <button type="button" onClick={cancelSelected} className="flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300"><XCircle size={16} />Cancel</button>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700"><tr><th className="py-3">Product</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Unit cost</th></tr></thead>
                  <tbody>{selected.items.map((item) => <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-3 font-semibold dark:text-slate-100">{item.product_name} <span className="text-xs text-slate-400">{item.product_sku}</span></td><td>{item.ordered_quantity}</td><td>{item.received_quantity}</td><td className="font-bold text-indigo-600">{item.ordered_quantity - item.received_quantity}</td><td>{money(item.unit_cost)}</td></tr>)}</tbody>
                </table>
              </div>

              {canReceivePurchasing && ['ordered', 'partially_received'].includes(selected.status) && (
                <div className="border-y border-emerald-200 py-5 dark:border-emerald-900">
                  <div className="mb-4 flex items-center gap-2"><PackageCheck size={20} className="text-emerald-600" /><h3 className="text-lg font-bold dark:text-slate-100">Receive Goods</h3></div>
                  <div className="space-y-3">{selected.items.filter((item) => item.received_quantity < item.ordered_quantity).map((item) => (
                    <div key={item.id} className="grid gap-3 md:grid-cols-[1fr_150px_170px] md:items-center">
                      <p className="text-sm font-semibold dark:text-slate-200">{item.product_name} <span className="text-slate-400">({item.ordered_quantity - item.received_quantity} remaining)</span></p>
                      <input aria-label={`Receive ${item.product_name}`} type="number" min="0" max={item.ordered_quantity - item.received_quantity} step="1" value={receiptQuantities[item.id] || ''} onChange={(event) => updateReceiptInput(setReceiptQuantities, item.id, event.target.value)} placeholder="Quantity" className={inputClass} />
                      <input aria-label={`Cost ${item.product_name}`} type="number" min="0" step="0.01" value={receiptCosts[item.id] ?? String(item.unit_cost)} onChange={(event) => updateReceiptInput(setReceiptCosts, item.id, event.target.value)} placeholder="Actual unit cost" className={inputClass} />
                    </div>
                  ))}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                    <input type="date" value={receiptDate} onChange={(event) => { setReceiptDate(event.target.value); setReceiptRequestId(null) }} className={inputClass} />
                    <input value={receiptNotes} onChange={(event) => { setReceiptNotes(event.target.value); setReceiptRequestId(null) }} placeholder="Receipt notes" className={inputClass} />
                    <button type="button" disabled={receiving} onClick={postReceipt} className="flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17} />{receiving ? 'Posting...' : 'Post Receipt'}</button>
                  </div>
                </div>
              )}

              {canReturnPurchasing && (returnEligibilityQuery.data ?? []).some((item) => item.remaining_returnable_quantity > 0) && (
                <div className="border-y border-amber-200 py-5 dark:border-amber-900">
                  <div className="mb-4 flex items-center gap-2">
                    <RotateCcw size={20} className="text-amber-700" />
                    <h3 className="text-lg font-bold dark:text-slate-100">Return Goods to Vendor</h3>
                  </div>
                  <div className="space-y-3">
                    {(returnEligibilityQuery.data ?? []).filter((item) => item.remaining_returnable_quantity > 0).map((item) => {
                      const limit = Math.min(item.remaining_returnable_quantity, item.current_stock_quantity)
                      return (
                        <div key={item.goods_receipt_item_id} className="grid gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(110px,auto))] md:items-center">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold dark:text-slate-200">{item.product_name} <span className="text-slate-400">{item.product_sku}</span></p>
                            <p className="text-xs text-slate-500">{item.receipt_number} / {money(item.unit_cost)} each</p>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">Received {item.received_quantity}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">Returned {item.already_returned_quantity}</p>
                          <label className="text-xs font-semibold text-slate-500">Return quantity
                            <input
                              aria-label={`Return ${item.product_name}`}
                              type="number"
                              min="0"
                              max={limit}
                              step="1"
                              value={returnQuantities[item.goods_receipt_item_id] || ''}
                              onChange={(event) => {
                                setReturnQuantities((current) => ({ ...current, [item.goods_receipt_item_id]: event.target.value }))
                                setReturnRequestId(null)
                              }}
                              placeholder={`Max ${limit}`}
                              className={`${inputClass} mt-1`}
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[170px_190px_minmax(0,1fr)_auto]">
                    <input type="date" value={returnDate} onChange={(event) => { setReturnDate(event.target.value); setReturnRequestId(null) }} className={inputClass} />
                    <select value={returnReason} onChange={(event) => { setReturnReason(event.target.value as typeof returnReason); setReturnRequestId(null) }} className={inputClass}>
                      <option value="damaged">Damaged</option>
                      <option value="defective">Defective</option>
                      <option value="wrong_item">Wrong item</option>
                      <option value="excess_quantity">Excess quantity</option>
                      <option value="quality_issue">Quality issue</option>
                      <option value="other">Other</option>
                    </select>
                    <input value={returnNotes} onChange={(event) => { setReturnNotes(event.target.value); setReturnRequestId(null) }} placeholder={returnReason === 'other' ? 'Reason notes (required)' : 'Return notes'} className={inputClass} />
                    <button type="button" disabled={returning} onClick={postPurchaseReturn} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 text-sm font-semibold text-white disabled:opacity-50"><RotateCcw size={17} />{returning ? 'Posting...' : 'Post Return'}</button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-3 text-lg font-bold dark:text-slate-100">Receipt History</h3>
                <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                  {(receiptsQuery.data ?? []).length === 0 ? <p className="py-4 text-sm text-slate-500">No goods received yet.</p> : (receiptsQuery.data ?? []).map((receipt) => (
                    <div key={receipt.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-semibold dark:text-slate-100">{receipt.receipt_number}</p><p className="text-sm text-slate-500">{receipt.received_date} · {receipt.items.length} line(s)</p></div><p className="text-sm font-semibold text-emerald-700">{receipt.items.reduce((sum, item) => sum + item.received_quantity, 0)} units</p></div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-bold dark:text-slate-100">Purchase Return History</h3>
                <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                  {(returnsQuery.data ?? []).length === 0 ? <p className="py-4 text-sm text-slate-500">No goods returned to this vendor.</p> : (returnsQuery.data ?? []).map((purchaseReturn) => (
                    <div key={purchaseReturn.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0"><p className="break-words font-semibold dark:text-slate-100">{purchaseReturn.return_number}</p><p className="text-sm text-slate-500">{purchaseReturn.return_date} / {purchaseReturn.reason.replaceAll('_', ' ')} / {purchaseReturn.items.reduce((sum, item) => sum + item.returned_quantity, 0)} units</p></div>
                      <div className="sm:text-right"><p className="font-semibold text-amber-700">{money(purchaseReturn.total_amount)}</p><p className="text-xs uppercase text-slate-500">Credit {purchaseReturn.credit?.status || 'unavailable'}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
