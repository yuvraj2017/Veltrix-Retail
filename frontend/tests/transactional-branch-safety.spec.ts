import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

const owner = {
  id: 31,
  email: 'transaction-owner@example.test',
  full_name: 'Transaction Owner',
  role: 'owner',
  status: 'active',
  shop_id: 1,
  shop_name: 'Alpha Branch',
  organization_id: 50,
  organization_name: 'Transaction Test Organization',
  active_shop_id: 1,
  membership_role: 'owner',
  permissions: ['sales.view', 'sales.create', 'sales.payment', 'sales.return', 'sales.refund', 'customers.view'],
}

const branches = [
  { id: 1, name: 'Alpha Branch', status: 'active', is_default_branch: true, is_preferred: true },
  { id: 2, name: 'Beta Branch With A Long Responsive Name', status: 'active', is_default_branch: false, is_preferred: false },
]

const productFor = (branchId: string | undefined) => ({
  id: branchId === '2' ? 202 : 101,
  name: branchId === '2' ? 'Beta Product' : 'Alpha Product',
  product_code: branchId === '2' ? 'BETA-1' : 'ALPHA-1',
  sku: branchId === '2' ? 'BETA-1' : 'ALPHA-1',
  barcode: null,
  category: 'General',
  unit: 'pcs',
  hsn_sac: '',
  mrp: '100.00',
  buying_price: '60.00',
  selling_price: '100.00',
  available_stock: '10',
  gst_rate: '0.00',
  is_active: true,
})

function shopDetails(id: number) {
  return {
    id,
    organization_id: 50,
    is_default_branch: id === 1,
    status: 'active',
    name: branches.find((branch) => branch.id === id)?.name,
    category: 'Retail',
    email: `branch-${id}@example.test`,
    phone: '9000000000',
    whatsapp_number: null,
    address: null,
    logo_url: null,
    gst_enabled: false,
    gstin: null,
    state: 'Gujarat',
    gst_state_code: '24',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }
}

async function seedOwner(page: Page) {
  await page.addInitScript((account) => {
    sessionStorage.setItem('access_token', 'transaction-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify(account))
  }, owner)
}

async function mockPos(
  context: BrowserContext,
  invoiceRequests: Array<{ branchId?: string; body: any }> = [],
  accessibleBranches = branches,
) {
  await context.route(/\/api\/v1\//, async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const branchId = request.headers()['x-branch-id']
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: accessibleBranches } })
    if (/^\/api\/v1\/shops\/[12]$/.test(path)) return route.fulfill({ json: shopDetails(Number(path.split('/').at(-1))) })
    if (path === '/api/v1/billing/products/search') return route.fulfill({ json: [productFor(branchId)] })
    if (path.startsWith('/api/v1/billing/products/')) {
      const product = productFor(branchId)
      if (path.endsWith(product.product_code)) return route.fulfill({ json: product })
      return route.fulfill({ status: 404, json: { detail: 'Product is not available in this branch' } })
    }
    if (path === '/api/v1/customers/search') return route.fulfill({ json: [] })
    if (path === '/api/v1/invoices' && request.method() === 'POST') {
      const body = request.postDataJSON()
      invoiceRequests.push({ branchId, body })
      return route.fulfill({ json: {
        id: invoiceRequests.length,
        shop_id: Number(branchId),
        invoice_number: `INV-${branchId}-${invoiceRequests.length}`,
        customer_id: null,
        customer_name_snapshot: body.customer.first_name,
        customer_phone_snapshot: body.customer.phone,
        invoice_date: body.invoice_date,
        subtotal_amount: '100.00', total_discount_amount: '0.00', total_tax_amount: '0.00',
        billed_amount: '100.00', extra_discount_amount: '0.00', final_amount: '100.00',
        paid_amount: body.paid_amount || 0, remaining_amount: '100.00', total_buy_cost: '60.00', total_profit: '40.00',
        payment_status: body.payment_status, payment_mode: body.payment_mode, invoice_status: 'saved',
        finalized_at: '2026-10-08T10:00:00Z', notes: body.notes, created_at: '2026-10-08T10:00:00Z',
        updated_at: '2026-10-08T10:00:00Z', items: [], payments: [], returns: [],
      } })
    }
    return route.fulfill({ json: {} })
  })
}

async function addCurrentBranchProduct(page: Page, code: string) {
  await page.getByTestId('product-search-input').fill(code)
  await page.getByTestId('product-search-input').press('Enter')
}

async function chooseBranch(page: Page, name: RegExp) {
  await page.locator('[data-testid="branch-selector-trigger"]:visible').click()
  await page.getByRole('option', { name }).click()
}

test('POS drafts remain independent by branch and support Stay and Save Draft switching', async ({ context, page }) => {
  await mockPos(context)
  await seedOwner(page)
  await page.goto('/billing/new')

  await page.getByPlaceholder('Customer first name').fill('Alpha Customer')
  await addCurrentBranchProduct(page, 'ALPHA-1')
  await expect(page.getByText('Alpha Product')).toBeVisible()

  await chooseBranch(page, /Beta Branch/)
  await expect(page.getByRole('dialog', { name: /Switch to Beta Branch/ })).toBeVisible()
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.locator('[data-testid="branch-selector-trigger"]:visible')).toContainText('Alpha Branch')
  await expect(page.getByText('Alpha Product')).toBeVisible()

  await chooseBranch(page, /Beta Branch/)
  await page.getByRole('button', { name: 'Save draft and switch' }).click()
  await expect(page.locator('[data-testid="branch-selector-trigger"]:visible')).toContainText('Beta Branch')
  await expect(page.getByText('Alpha Product')).toHaveCount(0)
  await expect(page.getByPlaceholder('Customer first name')).toHaveValue('')

  await page.getByPlaceholder('Customer first name').fill('Beta Customer')
  await addCurrentBranchProduct(page, 'BETA-1')
  await expect(page.getByText('Beta Product')).toBeVisible()
  await chooseBranch(page, /Alpha Branch/)
  await page.getByRole('button', { name: 'Save draft and switch' }).click()

  await expect(page.getByText('Alpha Product')).toBeVisible()
  await expect(page.getByPlaceholder('Customer first name')).toHaveValue('Alpha Customer')
  await expect(page.getByText('Beta Product')).toHaveCount(0)
})

test('Discard clears current branch draft before switching', async ({ context, page }) => {
  await mockPos(context)
  await seedOwner(page)
  await page.goto('/billing/new')
  await page.getByPlaceholder('Customer first name').fill('Discard Me')
  await addCurrentBranchProduct(page, 'ALPHA-1')

  await chooseBranch(page, /Beta Branch/)
  await page.getByRole('button', { name: 'Discard and switch' }).click()
  await chooseBranch(page, /Alpha Branch/)
  await expect(page.getByPlaceholder('Customer first name')).toHaveValue('')
  await expect(page.getByText('Alpha Product')).toHaveCount(0)
})

test('ambiguous legacy draft is quarantined and never assigned to the active branch', async ({ context, page }) => {
  await mockPos(context)
  await seedOwner(page)
  await page.addInitScript(() => {
    localStorage.setItem('billing_invoice_draft', JSON.stringify({
      customer: { first_name: 'Unknown owner', phone: '9999999999' },
      items: [],
      total_payable_amount: 0,
    }))
  })
  await page.goto('/billing/new')

  await expect(page.getByText(/older browser draft was not restored/i)).toBeVisible()
  await expect(page.getByPlaceholder('Customer first name')).toHaveValue('')
  const keys = await page.evaluate(() => ({
    legacy: localStorage.getItem('billing_invoice_draft'),
    quarantine: localStorage.getItem('billing_invoice_draft:quarantine:v1'),
  }))
  expect(keys.legacy).toBeNull()
  expect(keys.quarantine).not.toBeNull()
})

test('a legacy draft migrates only when user, organization, and branch ownership are explicit', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    localStorage.clear()
    const legacy = {
      user_id: 31,
      organization_id: 50,
      branch_id: 2,
      customer: { id: null, first_name: 'Proven', phone: '9000000000' },
      items: [],
      total_payable_amount: 0,
      invoice_date: '2026-10-08',
      client_request_id: 'legacy-request',
    }
    localStorage.setItem('billing_invoice_draft', JSON.stringify(legacy))
    const drafts = await import('/src/lib/pos-drafts.ts')
    const migration = drafts.migrateLegacyPosDraft({ userId: 31, organizationId: 50 }, [1, 2])
    return {
      migration,
      migrated: drafts.loadPosDraft(31, 50, 2),
      legacy: localStorage.getItem('billing_invoice_draft'),
      quarantined: drafts.hasQuarantinedLegacyPosDraft(),
    }
  })
  expect(result.migration).toEqual({ migratedBranchId: 2, quarantined: false })
  expect(result.migrated?.data.customer.first_name).toBe('Proven')
  expect(result.legacy).toBeNull()
  expect(result.quarantined).toBe(false)
})

test('draft identity is isolated across account changes and logout tab state', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    const drafts = await import('/src/lib/pos-drafts.ts')
    const data = {
      customer: { id: null, first_name: 'Owner 31', phone: '' },
      items: [], totalPayable: 0, isPayableManuallyEdited: false, notes: '',
      invoiceDate: '2026-10-08', editInvoiceId: null, clientRequestId: 'account-draft',
    }
    drafts.savePosDraft({ userId: 31, organizationId: 50, branchId: 1 }, data, null)
    drafts.clearPosDraftTabState()
    return {
      original: drafts.loadPosDraft(31, 50, 1)?.data.customer.first_name,
      anotherAccount: drafts.loadPosDraft(32, 50, 1),
      anotherOrganization: drafts.loadPosDraft(31, 51, 1),
    }
  })
  expect(result.original).toBe('Owner 31')
  expect(result.anotherAccount).toBeNull()
  expect(result.anotherOrganization).toBeNull()
})

test('a revoked persisted branch draft is not restored into an accessible fallback branch', async ({ context, page }) => {
  await mockPos(context, [], [branches[0]])
  await seedOwner(page)
  await page.addInitScript(({ account }) => {
    sessionStorage.setItem(`active_branch:${account.id}:${account.organization_id}`, '2')
    localStorage.setItem(`billing_invoice_draft:v1:${account.id}:${account.organization_id}:2`, JSON.stringify({
      schemaVersion: 1,
      userId: account.id,
      organizationId: account.organization_id,
      branchId: 2,
      revision: 1,
      writerTabId: 'revoked-tab',
      updatedAt: new Date().toISOString(),
      data: {
        customer: { id: null, first_name: 'Revoked Beta Draft', phone: '' },
        items: [], totalPayable: 0, isPayableManuallyEdited: false, notes: '',
        invoiceDate: '2026-10-08', editInvoiceId: null, clientRequestId: 'revoked-request',
      },
    }))
  }, { account: owner })
  await page.goto('/billing/new')
  await expect(page.locator('[data-testid="current-branch"]:visible')).toContainText('Alpha Branch')
  await expect(page.getByPlaceholder('Customer first name')).toHaveValue('')
})

test('branch-scoped storage rejects silent multi-tab draft overwrites', async ({ page, context }) => {
  await page.goto('/')
  const draftData = {
    customer: { id: null, first_name: 'Draft', last_name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gst_number: '' },
    items: [],
    totalPayable: 0,
    isPayableManuallyEdited: false,
    notes: '',
    invoiceDate: '2026-10-08',
    editInvoiceId: null,
    clientRequestId: 'draft-request',
  }
  const first = await page.evaluate(async (data) => {
    localStorage.clear()
    sessionStorage.clear()
    const drafts = await import('/src/lib/pos-drafts.ts')
    return drafts.savePosDraft({ userId: 31, organizationId: 50, branchId: 1 }, data, null)
  }, draftData)

  const secondPage = await context.newPage()
  await secondPage.goto('/')
  const secondLoaded = await secondPage.evaluate(async () => {
    const drafts = await import('/src/lib/pos-drafts.ts')
    return drafts.loadPosDraft(31, 50, 1)
  })
  expect(secondLoaded?.revision).toBe(first.revision)

  await page.evaluate(async ({ data, revision }) => {
    const drafts = await import('/src/lib/pos-drafts.ts')
    drafts.savePosDraft({ userId: 31, organizationId: 50, branchId: 1 }, { ...data, notes: 'first tab' }, revision)
  }, { data: draftData, revision: first.revision })

  const conflict = await secondPage.evaluate(async ({ data, revision }) => {
    const drafts = await import('/src/lib/pos-drafts.ts')
    try {
      drafts.savePosDraft({ userId: 31, organizationId: 50, branchId: 1 }, { ...data, notes: 'second tab' }, revision)
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, { data: draftData, revision: first.revision })
  expect(conflict).toContain('another tab')
})

test('dirty-guard registry supports multiple guards and cleanup', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { BranchDirtyGuardRegistry } = await import('/src/lib/branch-guards.ts')
    const registry = new BranchDirtyGuardRegistry()
    const removeFirst = registry.register('first', () => ({ dirty: true, label: 'First', discard: () => undefined }))
    registry.register('second', () => ({ dirty: true, label: 'Second', discard: () => undefined }))
    registry.register('clean', () => ({ dirty: false, label: 'Clean', discard: () => undefined }))
    const before = registry.getDirtyGuards().map((guard) => guard.label)
    removeFirst()
    const after = registry.getDirtyGuards().map((guard) => guard.label)
    return { before, after }
  })
  expect(result.before).toEqual(['First', 'Second'])
  expect(result.after).toEqual(['Second'])
})

test('invoice submission keeps the selected branch header and branch-local request key', async ({ context, page }) => {
  const invoiceRequests: Array<{ branchId?: string; body: any }> = []
  await mockPos(context, invoiceRequests)
  await seedOwner(page)
  await page.goto('/billing/new')
  await chooseBranch(page, /Beta Branch/)
  await page.getByPlaceholder('Customer first name').fill('Beta Sale')
  await addCurrentBranchProduct(page, 'BETA-1')
  await page.getByTestId('save-invoice-button').click()
  await expect(page.getByText('Sale completed', { exact: true })).toBeVisible()

  expect(invoiceRequests).toHaveLength(1)
  expect(invoiceRequests[0].branchId).toBe('2')
  expect(invoiceRequests[0].body.client_request_id).toBeTruthy()
})

test('critical mutation lock releases after a failed request', async ({ context, page }) => {
  let releaseFailure!: () => void
  let requestStarted = false
  const failureRelease = new Promise<void>((resolve) => { releaseFailure = resolve })
  await mockPos(context)
  await context.route('**/api/v1/mutation-failure', async (route) => {
    requestStarted = true
    await failureRelease
    await route.fulfill({ status: 500, json: { detail: 'Expected test failure' } })
  })
  await seedOwner(page)
  await page.goto('/billing/new')

  await page.evaluate(() => {
    void import('/src/lib/api.ts').then(({ api }) => api.post('/api/v1/mutation-failure', { test: true }).catch(() => undefined))
  })
  await expect.poll(() => requestStarted).toBe(true)
  const trigger = page.locator('[data-testid="branch-selector-trigger"]:visible')
  await expect(trigger).toBeDisabled()
  releaseFailure()
  await expect(trigger).toBeEnabled()
})

test('POS switch confirmation stays viewport-safe at supported widths', async ({ context, page }) => {
  await mockPos(context)
  await seedOwner(page)
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 820 })
    await page.goto('/billing/new')
    await page.getByPlaceholder('Customer first name').fill(`Unsaved ${width}`)
    await chooseBranch(page, /Beta Branch/)
    const dialog = page.getByRole('dialog', { name: /Switch to Beta Branch/ })
    await expect(dialog).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1)
    await page.getByRole('button', { name: 'Stay', exact: true }).click()
  }
})
