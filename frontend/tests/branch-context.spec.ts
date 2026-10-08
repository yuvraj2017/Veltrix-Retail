import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const owner = {
  id: 7,
  email: 'multi-owner@example.test',
  full_name: 'Multi Branch Owner',
  role: 'owner',
  status: 'active',
  shop_id: 1,
  shop_name: 'Alpha Branch',
  organization_id: 10,
  organization_name: 'Branch Test Organization',
  active_shop_id: 1,
  membership_role: 'owner',
  permissions: ['dashboard.view', 'products.view', 'inventory.view', 'reports.view'],
}

const branches = [
  { id: 1, name: 'Alpha Branch', status: 'active', is_default_branch: true, is_preferred: true },
  { id: 2, name: 'Beta Branch With An Exceptionally Long Name For Responsive Verification', status: 'active', is_default_branch: false, is_preferred: false },
]

const dashboard = (branchId: string | undefined) => ({
  greeting_name: branchId === '2' ? 'Beta data' : 'Alpha data',
  performance_label: `Branch ${branchId || 'fallback'} dashboard`,
  stats: [],
  sales_trends: [],
  revenue_profit: [],
  recent_bills: [],
  low_stock_products: [],
})

const shopDetails = (id: number) => ({
  id,
  organization_id: 10,
  is_default_branch: id === 1,
  status: 'active',
  name: id === 1 ? branches[0].name : branches[1].name,
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
})

async function seedTenant(page: Page, storedBranchId?: number) {
  await page.addInitScript(({ account, stored }) => {
    sessionStorage.setItem('access_token', 'branch-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify(account))
    if (stored) sessionStorage.setItem(`active_branch:${account.id}:${account.organization_id}`, String(stored))
  }, { account: owner, stored: storedBranchId })
}

async function fulfillCommon(route: Route) {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/v1/profile/me') {
    await route.fulfill({ json: { ...owner, language: 'English (US)', is_active: true } })
    return true
  }
  if (/^\/api\/v1\/shops\/[12]$/.test(path)) {
    await route.fulfill({ json: shopDetails(Number(path.split('/').at(-1))) })
    return true
  }
  return false
}

test('selection is session-scoped, headers switch centrally, and late data stays isolated', async ({ context, page }) => {
  let releaseAlpha!: () => void
  let alphaStarted = false
  const alphaRelease = new Promise<void>((resolve) => { releaseAlpha = resolve })
  const dashboardHeaders: Array<string | undefined> = []

  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const branchId = route.request().headers()['x-branch-id']
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: branches } })
    if (path === '/api/v1/dashboard/overview') {
      dashboardHeaders.push(branchId)
      if (branchId === '1') {
        alphaStarted = true
        await alphaRelease
      }
      return route.fulfill({ json: dashboard(branchId) })
    }
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await seedTenant(page)
  await page.goto('/dashboard')
  await expect.poll(() => alphaStarted).toBe(true)

  await page.locator('[data-testid="branch-selector-trigger"]:visible').click()
  await page.getByRole('option', { name: /Beta Branch/ }).click()
  await expect(page.getByText(/Welcome back, Beta data/)).toBeVisible()
  releaseAlpha()
  await expect(page.getByText(/Welcome back, Alpha data/)).toHaveCount(0)
  expect(dashboardHeaders).toContain('1')
  expect(dashboardHeaders).toContain('2')
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('active_branch:7:10'))).toBe('2')

  const cacheKeys = await page.evaluate(async () => {
    const { queryClient } = await import('/src/lib/queryClient.ts')
    return queryClient.getQueryCache().getAll().map((query) => query.queryKey)
  })
  expect(cacheKeys).toContainEqual(['branch', 1, 'dashboard', 'overview'])
  expect(cacheKeys).toContainEqual(['branch', 2, 'dashboard', 'overview'])
})

test('stale persisted branch is discarded and logout clears branch state', async ({ context, page }) => {
  const branchHeaders: Array<string | undefined> = []
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const branchId = route.request().headers()['x-branch-id']
    if (path === '/api/v1/branches') {
      branchHeaders.push(branchId)
      if (branchId === '99') return route.fulfill({ status: 403, json: { detail: 'Tenant membership is inactive or unavailable' } })
      return route.fulfill({ json: { items: branches } })
    }
    if (path === '/api/v1/dashboard/overview') return route.fulfill({ json: dashboard(branchId) })
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await page.goto('/')
  await page.evaluate(({ account, stored }) => {
    sessionStorage.setItem('access_token', 'branch-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify(account))
    sessionStorage.setItem(`active_branch:${account.id}:${account.organization_id}`, String(stored))
  }, { account: owner, stored: 99 })
  await page.goto('/dashboard')
  await expect(page.locator('[data-testid="branch-selector-trigger"]:visible')).toContainText('Alpha Branch')
  expect(new Set(branchHeaders)).toEqual(new Set(['99', undefined]))
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('active_branch:7:10'))).toBe('1')

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(() => sessionStorage.getItem('active_branch:7:10'))).toBeNull()
})

test('revoked selected branch is cleared and discovery recovers through the preferred branch', async ({ context, page }) => {
  let betaRevoked = false
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const branchId = route.request().headers()['x-branch-id']
    if (path === '/api/v1/branches') {
      if (betaRevoked && branchId === '2') {
        return route.fulfill({ status: 403, json: { detail: 'Tenant membership is inactive or unavailable' } })
      }
      return route.fulfill({ json: { items: betaRevoked ? [branches[0]] : branches } })
    }
    if (path === '/api/v1/dashboard/overview') {
      if (betaRevoked && branchId === '2') {
        return route.fulfill({ status: 403, json: { detail: 'Tenant membership is inactive or unavailable' } })
      }
      return route.fulfill({ json: dashboard(branchId) })
    }
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await seedTenant(page)
  await page.goto('/dashboard')
  await page.locator('[data-testid="branch-selector-trigger"]:visible').click()
  betaRevoked = true
  await page.getByRole('option', { name: /Beta Branch/ }).click()
  await expect(page.locator('[data-testid="current-branch"]:visible')).toContainText('Alpha Branch')
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('active_branch:7:10'))).toBe('1')
})

test('no accessible branches produces a controlled state', async ({ context, page }) => {
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: [] } })
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await seedTenant(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Branch access unavailable' })).toBeVisible()
  await expect(page.getByText(/no active branch assignment/i)).toBeVisible()
})

test('super admin bypasses tenant branch bootstrap and tenant headers', async ({ context, page }) => {
  let branchRequests = 0
  let adminBranchHeader: string | undefined
  const superAdmin = {
    id: 90, email: 'admin@example.test', full_name: 'Platform Admin', role: 'super_admin',
    status: 'active', shop_id: null, organization_id: null, permissions: [],
  }
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/branches') branchRequests += 1
    if (path === '/api/v1/admin/stats') {
      adminBranchHeader = route.request().headers()['x-branch-id']
      return route.fulfill({ json: {
        total_users: 0, total_shops: 0, shop_owner_count: 0, super_admin_count: 1,
        active_users: 1, pending_users: 0, suspended_users: 0, rejected_users: 0,
        disabled_users: 0, recent_registrations: [], top_shops: [], recent_activity: [],
        platform_invoice_count: 0, platform_revenue: '0', platform_profit: '0',
        platform_collected: '0', platform_outstanding: '0', platform_revenue_last_7_days: '0',
        registrations_last_7_days: 0, admin_actions_last_7_days: 0,
      } })
    }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript((account) => {
    sessionStorage.setItem('access_token', 'platform-token')
    sessionStorage.setItem('auth_user', JSON.stringify(account))
  }, superAdmin)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()
  expect(branchRequests).toBe(0)
  expect(adminBranchHeader).toBeUndefined()
})

test('branch selector remains usable without overflow at supported widths', async ({ context, page }) => {
  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const branchId = route.request().headers()['x-branch-id']
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: branches } })
    if (path === '/api/v1/dashboard/overview') return route.fulfill({ json: dashboard(branchId) })
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await seedTenant(page)

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard')
    const trigger = page.locator('[data-testid="branch-selector-trigger"]:visible')
    await expect(trigger).toBeVisible()
    await trigger.click()
    await expect(page.getByRole('listbox', { name: 'Select branch' })).toBeVisible()
    await expect(page.getByRole('option', { name: /Beta Branch/ })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
  }
})

test('branch switching is blocked while a tenant mutation is in flight', async ({ context, page }) => {
  let releaseMutation!: () => void
  let mutationStarted = false
  const mutationRelease = new Promise<void>((resolve) => { releaseMutation = resolve })
  let mutationBranch: string | undefined

  await context.route(/\/api\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const branchId = route.request().headers()['x-branch-id']
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: branches } })
    if (path === '/api/v1/dashboard/overview') return route.fulfill({ json: dashboard(branchId) })
    if (path === '/api/v1/mutation-probe') {
      mutationBranch = branchId
      mutationStarted = true
      await mutationRelease
      return route.fulfill({ json: { ok: true } })
    }
    if (await fulfillCommon(route)) return
    return route.fulfill({ json: {} })
  })
  await seedTenant(page)
  await page.goto('/dashboard')
  const trigger = page.locator('[data-testid="branch-selector-trigger"]:visible')
  await expect(trigger).toBeVisible()

  await page.evaluate(() => {
    void import('/src/lib/api.ts').then(({ api }) => api.post('/api/v1/mutation-probe', { value: 1 }))
  })
  await expect.poll(() => mutationStarted).toBe(true)
  await expect(trigger).toBeDisabled()
  expect(mutationBranch).toBe('1')
  releaseMutation()
  await expect(trigger).toBeEnabled()
})

test('representative tenant query keys remain explicitly branch-scoped', async () => {
  const branchScopedPages = [
    'DashboardPage.tsx',
    'ProductsPage.tsx',
    'InventoryPage.tsx',
    'BillingPage.tsx',
    'VendorsPage.tsx',
    'PurchaseOrdersPage.tsx',
    'ReportsPage.tsx',
    'SubscriptionPage.tsx',
  ]
  for (const filename of branchScopedPages) {
    const source = await readFile(new URL(`../src/pages/${filename}`, import.meta.url), 'utf8')
    expect(source, `${filename} must use the shared branch query-key helper`).toContain('branchQueryKey')
  }

  const staffSource = await readFile(new URL('../src/pages/StaffPage.tsx', import.meta.url), 'utf8')
  expect(staffSource).toContain("['organization', 'current', 'staff']")
  expect(staffSource).not.toContain("branchQueryKey(selectedBranchId, 'staff'")
})
