import { expect, test, type BrowserContext } from '@playwright/test'

const paged = (items: unknown[]) => ({ items, total: items.length, page: 1, page_size: 25 })

test.setTimeout(120_000)

async function mockInventory(context: BrowserContext) {
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: [
      { id: 1, name: 'Inventory Test Shop', status: 'active', is_default_branch: true, is_preferred: true },
    ] } })
    if (path === '/api/v1/shops/1') return route.fulfill({ json: {
      id: 1, organization_id: 1, is_default_branch: true, status: 'active', name: 'Inventory Test Shop',
      category: 'Retail', email: 'owner@example.test', phone: '9000000000', gst_enabled: false,
      created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    } })
    if (path === '/api/v1/inventory/summary') return route.fulfill({ json: {
      active_products: 12, total_sellable_units: 84, low_stock_products: 2,
      out_of_stock_products: 1, current_inventory_value: '24500.00',
      reconciliation_mismatches: 0, open_purchase_orders: 2,
      partially_received_purchase_orders: 1, unapplied_vendor_credit: '500.00',
      valuation_basis: 'Current sellable quantity x current product buying price',
    } })
    if (path === '/api/v1/inventory/activity') return route.fulfill({ json: {
      date_from: '2026-09-04', date_to: '2026-10-03', opening_balance_units: 20,
      units_sold: 8, customer_return_units_restocked: 1, purchase_units_received: 12,
      purchase_units_returned: 2, adjustment_in_units: 1, adjustment_out_units: 1,
      draft_reserved_units: 2, draft_released_units: 2, net_movement: 21,
      current_sellable_units: 84,
    } })
    if (path === '/api/v1/inventory/products') return route.fulfill({ json: paged([{
      product_id: 10, name: 'Long Product Name For Responsive Inventory Verification',
      sku: 'LONG-SKU-0000001', barcode: '8900000000001', category: 'General', is_active: true,
      stock_quantity: 2, low_stock_threshold: 5, stock_status: 'low_stock', threshold_gap: 3,
      buying_price: '100.00', inventory_value: '200.00', incoming_quantity: 4,
    }]) })
    if (path === '/api/v1/inventory/movements') return route.fulfill({ json: paged([{
      id: 1, product_id: 10, product_name: 'Long Product Name For Responsive Inventory Verification',
      product_sku: 'LONG-SKU-0000001', movement_type: 'purchase_receipt', quantity_before: 0,
      quantity_delta: 10, quantity_after: 10, direction: 'in', reason: null, notes: null,
      reference_type: 'goods_receipt', reference_label: 'GR-20261003-001 / PO-20261003-001',
      reference_url: '/purchase-orders?selected=1', actor_name: 'Test Owner', occurred_at: '2026-10-03T09:30:00Z',
    }]) })
    if (path === '/api/v1/inventory/reconciliation/report') return route.fulfill({ json: paged([{
      product_id: 10, sku: 'LONG-SKU-0000001', product_name: 'Long Product Name For Responsive Inventory Verification',
      current_balance: 2, ledger_balance: 2, difference: 0, matches: true,
    }]) })
    if (path === '/api/v1/inventory/purchasing') return route.fulfill({ json: paged([{
      purchase_order_id: 1, purchase_order_number: 'PO-20261003-001', vendor_id: 2,
      vendor_name: 'Long Vendor Name For Responsive Verification', order_date: '2026-10-01',
      expected_date: '2026-10-05', status: 'partially_received', ordered_quantity: 10,
      received_quantity: 4, remaining_quantity: 6, ordered_value: '1000.00',
      purchase_return_quantity: 0, purchase_return_value: '0.00', overdue_expected_receipt: false,
    }]) })
    if (path === '/api/v1/inventory/vendor-insights') return route.fulfill({ json: paged([{
      vendor_id: 2, vendor_name: 'Long Vendor Name For Responsive Verification', purchase_order_count: 3,
      ordered_value: '3000.00', received_value: '1800.00', purchase_return_value: '100.00',
      outstanding_vendor_bills: '700.00', unapplied_vendor_credit: '100.00',
    }]) })
    return route.fulfill({ json: [] })
  })
}

test.beforeEach(async ({ context }) => {
  await mockInventory(context)
})

test('inventory workspace remains usable across supported viewport widths', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    sessionStorage.setItem('access_token', 'inventory-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify({
      id: 1, email: 'owner@example.test', full_name: 'Test Owner', role: 'owner',
      status: 'active', shop_id: 1, shop_name: 'Inventory Test Shop',
      organization_id: 1, active_shop_id: 1,
      membership_role: 'owner', permissions: ['inventory.view', 'purchasing.view'],
    }))
  })
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/inventory')
    await expect(page.getByRole('heading', { name: 'Inventory Operations' })).toBeVisible()
    await expect(page.getByText('Current-cost value')).toBeVisible()

    for (const tab of ['Low Stock', 'Movements', 'Reconciliation', 'Purchasing']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  }
})

test('purchase-order reference opens the linked order even when it is not in the first list page', async ({ context, page }) => {
  const linkedOrder = {
    id: 88, shop_id: 1, vendor_id: 2, purchase_order_number: 'PO-LINKED-88',
    order_date: '2026-10-01', expected_date: null, status: 'received', notes: null,
    subtotal: '100.00', tax_amount: '0.00', total_amount: '100.00', created_by: 1,
    created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', items: [],
  }
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/purchase-orders') return route.fulfill({ json: paged([{
      ...linkedOrder, id: 1, purchase_order_number: 'PO-FIRST-PAGE-1',
    }]) })
    if (path === '/api/v1/purchase-orders/88') return route.fulfill({ json: linkedOrder })
    if (path.startsWith('/api/v1/purchase-orders/88/')) return route.fulfill({ json: [] })
    if (path === '/api/v1/products') return route.fulfill({ json: paged([]) })
    if (path === '/api/v1/vendors') return route.fulfill({ json: [] })
    return route.fallback()
  })

  await page.goto('/')
  await page.evaluate(() => {
    sessionStorage.setItem('access_token', 'inventory-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify({
      id: 1, email: 'owner@example.test', full_name: 'Test Owner', role: 'owner',
      status: 'active', shop_id: 1, shop_name: 'Inventory Test Shop',
      organization_id: 1, active_shop_id: 1,
      membership_role: 'owner', permissions: ['purchasing.view'],
    }))
  })
  await page.goto('/purchase-orders?selected=88')

  await expect(page.getByRole('heading', { name: 'PO-LINKED-88' })).toBeVisible()
})
