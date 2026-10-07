import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const owner = {
  access_token: 'test-owner-token',
  token_type: 'bearer',
  user_id: 2,
  email: 'owner@example.test',
  full_name: 'Test Shop Owner',
  role: 'owner',
  status: 'active',
  shop_id: 2,
  shop_name: 'Owner Test Shop',
  organization_id: 2,
  active_shop_id: 2,
  membership_role: 'owner',
  permissions: ['sales.view', 'sales.create', 'customers.view'],
}

const product = {
  id: 101,
  name: 'POS Test Product',
  product_code: 'SKU1',
  sku: 'SKU1',
  barcode: '890000000001',
  category: 'General',
  unit: 'pcs',
  hsn_sac: '',
  mrp: '1000.00',
  buying_price: '600.00',
  selling_price: '1000.00',
  available_stock: '10',
  gst_rate: '0.00',
  is_active: true,
}

function invoiceResponse(id: number, body: any) {
  return {
    id,
    shop_id: owner.shop_id,
    invoice_number: `INV-20261002-${String(id).padStart(3, '0')}`,
    customer_id: null,
    customer_name_snapshot: body.customer?.first_name || 'Walk-in',
    customer_phone_snapshot: body.customer?.phone || '',
    invoice_date: body.invoice_date || '2026-10-02',
    subtotal_amount: '1000.00',
    total_discount_amount: '0.00',
    total_tax_amount: '0.00',
    billed_amount: '1000.00',
    extra_discount_amount: '0.00',
    final_amount: '1000.00',
    paid_amount: body.paid_amount || 0,
    remaining_amount: Math.max(1000 - Number(body.paid_amount || 0), 0),
    total_buy_cost: '600.00',
    total_profit: '400.00',
    payment_status: body.payment_status || 'pending',
    payment_mode: body.payment_mode || null,
    invoice_status: 'saved',
    finalized_at: '2026-10-02T10:00:00',
    notes: body.notes || null,
    created_at: '2026-10-02T10:00:00',
    updated_at: '2026-10-02T10:00:00',
    items: [],
    payments: [],
    returns: [],
  }
}

async function mockBillingApi(context: BrowserContext, requests: any[]) {
  await context.route(/\/api\/v1\//, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/auth/me') return route.fulfill({ json: owner })
    if (path === '/api/v1/shops/2') {
      return route.fulfill({
        json: {
          id: owner.shop_id,
          name: owner.shop_name,
          email: owner.email,
          gst_enabled: false,
          state: 'Gujarat',
          gst_state_code: '24',
        },
      })
    }
    if (path === '/api/v1/billing/products/SKU1') return route.fulfill({ json: product })
    if (path === '/api/v1/billing/products/search') return route.fulfill({ json: [product] })
    if (path === '/api/v1/customers/search') return route.fulfill({ json: [] })
    if (path === '/api/v1/invoices' && request.method() === 'POST') {
      const body = request.postDataJSON()
      requests.push(body)
      return route.fulfill({ json: invoiceResponse(requests.length, body) })
    }
    return route.fulfill({ json: {} })
  })
}

async function seedOwnerSession(page: Page) {
  await page.addInitScript((account) => {
    sessionStorage.setItem('access_token', account.access_token)
    sessionStorage.setItem('auth_user', JSON.stringify(account))
  }, owner)
}

test('POS split payment, cash change, save protection, and new-sale reset', async ({ page, context }) => {
  const invoiceRequests: any[] = []
  await mockBillingApi(context, invoiceRequests)
  await seedOwnerSession(page)

  await page.goto('/billing/new')
  await page.getByPlaceholder('Customer first name').fill('Walk-in')
  await page.getByTestId('product-search-input').fill('SKU1')
  await page.getByTestId('product-search-input').press('Enter')
  await expect(page.getByText('POS Test Product')).toBeVisible()

  await page.getByTestId('payment-preset-split').click()
  await page.getByTestId('cash-tendered-input').fill('600')
  await expect(page.getByTestId('change-due-value')).toContainText('100')

  await page.getByTestId('save-invoice-button').click()
  await expect(page.locator('p').getByText('Sale completed', { exact: true })).toBeVisible()
  await page.getByTestId('save-invoice-button').click({ force: true })
  expect(invoiceRequests).toHaveLength(1)
  expect(invoiceRequests[0].payment_mode).toBe('mixed')
  expect(invoiceRequests[0].payments).toHaveLength(2)

  const firstRequestKey = invoiceRequests[0].client_request_id
  await page.getByTestId('new-sale-button').click()
  await expect(page.locator('p').getByText('Sale completed', { exact: true })).toHaveCount(0)
  await expect(page.getByText('POS Test Product')).toHaveCount(0)

  await page.getByPlaceholder('Customer first name').fill('Walk-in')
  await page.getByTestId('product-search-input').fill('SKU1')
  await page.getByTestId('product-search-input').press('Enter')
  await page.getByTestId('payment-preset-full').click()
  await page.getByTestId('save-invoice-button').click()
  await expect(page.locator('p').getByText('Sale completed', { exact: true })).toBeVisible()

  expect(invoiceRequests).toHaveLength(2)
  expect(invoiceRequests[1].client_request_id).not.toBe(firstRequestKey)
  expect(invoiceRequests[1].payment_status).toBe('paid')
})
