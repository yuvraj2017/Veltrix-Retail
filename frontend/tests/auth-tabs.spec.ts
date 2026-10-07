import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const admin = {
  access_token: 'test-admin-token', token_type: 'bearer', user_id: 1,
  email: 'admin@example.test', full_name: 'Test Platform Admin',
  role: 'super_admin', status: 'active', shop_id: null, shop_name: null,
}
const owner = {
  access_token: 'test-owner-token', token_type: 'bearer', user_id: 2,
  email: 'owner@example.test', full_name: 'Test Shop Owner',
  role: 'owner', status: 'active', shop_id: 2, shop_name: 'Owner Test Shop',
  organization_id: 2, active_shop_id: 2, membership_role: 'owner',
  permissions: ['dashboard.view'],
}
const accounts = [admin, owner]
type Client = 'axios' | 'billing' | 'vendors' | 'analytics'

async function mockApi(context: BrowserContext) {
  await context.route(/\/(api\/v1|customer-analytics)\//, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const authorization = request.headers().authorization
    const account = accounts.find((item) => authorization === `Bearer ${item.access_token}`)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/auth/login') {
      const body = request.postDataJSON()
      const match = accounts.find((item) => body.email === item.email)
      return route.fulfill(match && body.password === 'TestPassword123!'
        ? { json: match }
        : { status: 401, json: { detail: 'Incorrect email or password' } })
    }
    if (!account) return route.fulfill({ status: 401, json: { detail: 'Invalid token' } })
    if (path === '/api/v1/auth/me') return route.fulfill({ json: account })
    if (path.startsWith('/api/v1/shops/')) {
      return route.fulfill({ json: { id: account.shop_id, name: account.shop_name } })
    }
    if (path === '/api/v1/profile/me') {
      return route.fulfill({ json: { ...account, id: account.user_id, language: 'English (US)', is_active: true } })
    }
    if (path === '/api/v1/dashboard/overview') {
      return route.fulfill({ json: {
        greeting_name: account.full_name, performance_label: '', stats: [], sales_trends: [],
        revenue_profit: [], recent_bills: [], low_stock_products: [],
      } })
    }
    if (path === '/api/v1/admin/stats') {
      return route.fulfill({ json: {
        total_users: 2, total_shops: 1, shop_owner_count: 1, super_admin_count: 1,
        active_users: 2, pending_users: 0, suspended_users: 0, rejected_users: 0, disabled_users: 0,
        recent_registrations: [], top_shops: [], recent_activity: [],
        platform_invoice_count: 0, platform_revenue: '0', platform_profit: '0',
        platform_collected: '0', platform_outstanding: '0', platform_revenue_last_7_days: '0',
        registrations_last_7_days: 0, admin_actions_last_7_days: 0,
      } })
    }
    return route.fulfill({ json: { authorization } })
  })
}

async function signIn(page: Page, account: typeof admin | typeof owner) {
  await page.goto('/')
  await page.locator('#login-email').fill(account.email)
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(account.role === 'super_admin' ? /\/admin$/ : /\/dashboard$/)
  await expect(page.getByRole('heading', { name: account.role === 'super_admin' ? 'Administration' : 'Dashboard', exact: true })).toBeVisible()
}

async function token(page: Page) {
  return page.evaluate(() => sessionStorage.getItem('access_token'))
}

async function requestWith(page: Page, client: Client) {
  return page.evaluate(async (transport) => {
    // Load the same Vite modules used by the application to cover every client.
    const modules = {
      axios: '/src/lib/api.ts',
      billing: '/src/features/billing/api.ts',
      vendors: '/src/features/vendors/api.ts',
      analytics: '/src/features/customerAnalytics/api.ts',
    }
    const module = await import(modules[transport])
    try {
      if (transport === 'axios') return (await module.api.get('/api/v1/session-probe')).data
      if (transport === 'billing') return await module.billingApi.getInvoiceStats()
      if (transport === 'vendors') return await module.vendorsApi.getVendors()
      return await module.getCustomerAnalyticsStats()
    } catch {
      return { failed: true }
    }
  }, client)
}

test.beforeEach(async ({ context }) => mockApi(context))

test('admin and owner remain independent in two tabs, across refresh and every API client', async ({ page, context }) => {
  await signIn(page, admin)
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  expect(await token(other)).toBeNull()
  await signIn(other, owner)

  // A legacy shared token must not override either tab, even in fetch clients.
  await page.evaluate(() => localStorage.setItem('access_token', 'wrong-shared-token'))
  for (const client of ['axios', 'billing', 'vendors', 'analytics'] as const) {
    expect(await requestWith(page, client)).toEqual({ authorization: `Bearer ${admin.access_token}` })
    expect(await requestWith(other, client)).toEqual({ authorization: `Bearer ${owner.access_token}` })
  }
  await page.reload()
  await other.reload()
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible()
  await expect(other.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  expect(await token(page)).toBe(admin.access_token)
  expect(await token(other)).toBe(owner.access_token)
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull()
})

test('logout only ends the current tab and login clears previous account cache', async ({ page, context }) => {
  await signIn(page, admin)
  const other = await context.newPage()
  await signIn(other, owner)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await token(page)).toBeNull()
  expect(await requestWith(other, 'axios')).toEqual({ authorization: `Bearer ${owner.access_token}` })

  await page.evaluate(async () => {
    const path = '/src/lib/queryClient.ts'
    const { queryClient } = await import(path)
    queryClient.setQueryData(['old-account'], { private: true })
  })
  await page.locator('#login-email').fill(owner.email)
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await page.evaluate(async () => {
    const path = '/src/lib/queryClient.ts'
    return (await import(path)).queryClient.getQueryData(['old-account']) ?? null
  })).toBeNull()
})

for (const [client, path, status, detail] of [
  ['axios', '**/api/v1/session-probe', 401, 'Token expired'],
  ['billing', '**/api/v1/invoices/stats', 401, 'Token expired'],
  ['vendors', '**/api/v1/vendors', 403, 'account_inactive: Account suspended'],
  ['analytics', '**/customer-analytics/stats', 401, 'Token expired'],
] as const) {
  test(`${client} session failure logs out only the affected tab`, async ({ page, context }) => {
    await signIn(page, admin)
    const other = await context.newPage()
    await signIn(other, owner)
    await other.route(path, (route) => route.fulfill({ status, json: { detail } }))
    await requestWith(other, client).catch(() => undefined) // Redirect can destroy the evaluation context.
    await expect(other).toHaveURL(/\/$/)
    await expect(other.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    expect(await token(other)).toBeNull()
    expect(await requestWith(page, 'axios')).toEqual({ authorization: `Bearer ${admin.access_token}` })
  })
}

test('ordinary permission errors do not end a session', async ({ page }) => {
  await signIn(page, owner)
  await page.route('**/api/v1/session-probe', (route) => route.fulfill({ status: 403, json: { detail: 'Not permitted' } }))
  expect(await requestWith(page, 'axios')).toEqual({ failed: true })
  expect(await token(page)).toBe(owner.access_token)
  await expect(page).toHaveURL(/\/dashboard$/)
})

for (const client of ['axios', 'billing'] as const) {
  test(`${client} ignores a late 401 belonging to a replaced session`, async ({ page }) => {
    await signIn(page, owner)
    let release!: () => void
    let started!: () => void
    const released = new Promise<void>((resolve) => { release = resolve })
    const received = new Promise<void>((resolve) => { started = resolve })
    await page.route(client === 'axios' ? '**/api/v1/session-probe' : '**/api/v1/invoices/stats', async (route) => {
      started()
      await released
      await route.fulfill({ status: 401, json: { detail: 'Previous token expired' } })
    })
    const pending = requestWith(page, client)
    await received
    await page.evaluate((account) => {
      sessionStorage.setItem('access_token', account.access_token)
      sessionStorage.setItem('auth_user', JSON.stringify(account))
    }, admin)
    release()
    expect(await pending).toEqual({ failed: true })
    expect(await token(page)).toBe(admin.access_token)
    await expect(page).toHaveURL(/\/dashboard$/)
  })
}

test('legacy shared login is discarded while preferences are preserved', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((account) => {
    localStorage.setItem('access_token', account.access_token)
    localStorage.setItem('auth_user', JSON.stringify(account))
    localStorage.setItem('authToken', account.access_token)
    localStorage.setItem('theme', 'dark')
  }, admin)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  expect(await token(page)).toBeNull()
  expect(await page.evaluate(() => [localStorage.getItem('access_token'), localStorage.getItem('auth_user'), localStorage.getItem('authToken')])).toEqual([null, null, null])
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
})

test('a corrupt cached user recovers from the tab token', async ({ page }) => {
  await signIn(page, owner)
  await page.evaluate(() => sessionStorage.setItem('auth_user', '{invalid-json'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  expect(await token(page)).toBe(owner.access_token)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('auth_user')!).email)).toBe(owner.email)
})
