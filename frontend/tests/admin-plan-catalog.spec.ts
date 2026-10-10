import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

const admin = {
  id: 1,
  user_id: 1,
  email: 'catalog-admin@example.test',
  full_name: 'Catalog Admin',
  role: 'super_admin',
  status: 'active',
  shop_id: null,
  shop_name: null,
}

const plan = {
  id: 7,
  code: 'growth',
  name: 'Growth',
  description: 'For growing retail teams',
  monthly_price: '499.00',
  annual_price: '4990.00',
  currency: 'INR',
  trial_days: 7,
  grace_period_days: 3,
  is_active: true,
  is_archived: false,
  display_order: 1,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  catalog_version_id: 70,
  catalog_version_number: 1,
}

const shop = {
  id: 21,
  name: 'Catalog Shop',
  category: 'Grocery',
  email: 'catalog-shop@example.test',
  phone: '9000000021',
  created_at: '2026-10-01T00:00:00Z',
}

const definitions = [
  {
    id: 11,
    key: 'staff.max',
    name: 'Staff seats',
    description: 'Active non-owner organization memberships',
    kind: 'limit',
    value_type: 'integer',
    resource_key: 'staff',
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 12,
    key: 'reports.advanced',
    name: 'Advanced reports',
    kind: 'feature',
    value_type: 'boolean',
    resource_key: 'reports',
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
] as const

function version(number: number, monthly = '499.00') {
  return {
    id: 69 + number,
    plan_id: plan.id,
    version_number: number,
    status: 'published',
    monthly_price: monthly,
    annual_price: number === 1 ? '4990.00' : '5990.00',
    currency: 'INR',
    trial_days: 7,
    grace_period_days: 3,
    published_at: `2026-10-0${number}T10:00:00Z`,
    published_by_user_id: 1,
    entitlement_snapshots: [
      {
        id: 100 + number,
        entitlement_id: 11,
        entitlement_key: 'staff.max',
        entitlement_name: 'Staff seats',
        kind: 'limit',
        value_type: 'integer',
        resource_key: 'staff',
        limit_value: number === 1 ? '0.00' : '5.00',
        is_unlimited: false,
        feature_enabled: null,
      },
      {
        id: 200 + number,
        entitlement_id: 12,
        entitlement_key: 'reports.advanced',
        entitlement_name: 'Advanced reports',
        kind: 'feature',
        value_type: 'boolean',
        resource_key: 'reports',
        limit_value: null,
        is_unlimited: false,
        feature_enabled: number > 1,
      },
    ],
  }
}

async function mockCatalog(
  context: BrowserContext,
  options: {
    conflict?: boolean
    delayPublication?: boolean
    networkFailure?: boolean
    definitions?: ReadonlyArray<Record<string, unknown>>
  } = {},
) {
  let versions = [version(1)]
  let publications = 0
  let planCreations = 0
  let conflictDelivered = false
  let lastPayload: Record<string, unknown> | null = null
  let lastPlanPayload: Record<string, unknown> | null = null
  let configuredDefinitions = options.definitions ?? definitions

  await context.route(/\/api\/v1\//, async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/v1/auth/me') return route.fulfill({ json: admin })
    if (path === '/api/v1/branches') return route.fulfill({ json: { items: [] } })
    if (path === '/api/v1/profile/me') return route.fulfill({ json: admin })
    if (path === '/api/v1/admin/plans' && request.method() === 'GET') {
      return route.fulfill({ json: [{ ...plan, catalog_version_number: versions[0].version_number }] })
    }
    if (path === '/api/v1/admin/plans' && request.method() === 'POST') {
      planCreations += 1
      lastPlanPayload = request.postDataJSON()
      return route.fulfill({ status: 201, json: { ...plan, id: 8, code: 'new-plan' } })
    }
    if (path === '/api/v1/admin/entitlements') return route.fulfill({ json: configuredDefinitions })
    if (path === '/api/v1/admin/shops') return route.fulfill({ json: [shop] })
    if (path === `/api/v1/admin/shops/${shop.id}/subscription`) {
      return route.fulfill({
        json: {
          access_allowed: true,
          access_code: null,
          plan,
          subscription: {
            id: 31,
            shop_id: shop.id,
            plan_id: plan.id,
            status: 'active',
            billing_interval: 'monthly',
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
          },
          license: {
            id: 41,
            shop_id: shop.id,
            subscription_id: 31,
            masked_key: 'AAYL-****-0041',
            status: 'active',
            issued_at: '2026-10-01T00:00:00Z',
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
          },
          limits: [],
          features: [],
        },
      })
    }
    if (path === `/api/v1/admin/shops/${shop.id}/overrides`) return route.fulfill({ json: [] })
    if (path === '/api/v1/admin/payment-gateways') return route.fulfill({ json: [] })
    if (path === '/api/v1/admin/payments') return route.fulfill({ json: [] })
    if (path === `/api/v1/admin/plans/${plan.id}/catalog-versions`) {
      if (request.method() === 'GET') return route.fulfill({ json: versions })
      publications += 1
      lastPayload = request.postDataJSON()
      if (options.delayPublication) await new Promise((resolve) => setTimeout(resolve, 250))
      if (options.networkFailure) return route.abort('failed')
      if (options.conflict && !conflictDelivered) {
        conflictDelivered = true
        versions = [version(2, '575.00'), ...versions]
        return route.fulfill({
          status: 409,
          json: { detail: { code: 'CATALOG_VERSION_CONFLICT', message: 'The catalog changed since this draft was prepared. Refresh and review the latest version.' } },
        })
      }
      const published = version(versions[0].version_number + 1, '599.00')
      versions = [published, ...versions]
      return route.fulfill({ status: 201, json: published })
    }
    return route.fulfill({ json: [] })
  })

  return {
    publicationCount: () => publications,
    payload: () => lastPayload,
    planCreationCount: () => planCreations,
    planPayload: () => lastPlanPayload,
    setDefinitions: (next: ReadonlyArray<Record<string, unknown>>) => {
      configuredDefinitions = next
    },
  }
}

async function openCatalog(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('access_token', 'catalog-admin-token'))
  await page.goto('/admin/plans')
  await expect(page.getByRole('heading', { name: 'Plan catalog versions' })).toBeVisible()
}

test('super admin reviews immutable history and publishes one complete catalog version', async ({ page, context }) => {
  const api = await mockCatalog(context, { delayPublication: true })
  await openCatalog(page)

  await expect(page.getByText('Version 1', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Immutable and published')).toBeVisible()
  await expect(page.getByText('Shop Subscriptions Registry')).toBeVisible()
  await expect(page.getByText('LIC-41')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revoke License' })).toBeVisible()

  await page.getByRole('tab', { name: 'Prepare next version' }).click()
  const editor = page.locator('section[aria-labelledby="catalog-manager-title"]')
  await editor.getByLabel('Monthly price').fill('599')
  await editor.getByLabel('Staff seats limit').fill('5')
  await editor.getByLabel('Advanced reports availability').selectOption('true')
  await editor.getByRole('button', { name: 'Review publication' }).click()

  const dialog = page.getByRole('dialog', { name: 'Publish Growth version 2' })
  await expect(dialog.getByText('Existing subscriptions keep their contracted catalog versions')).toBeVisible()
  await dialog.getByRole('button', { name: 'Publish version 2' }).click()
  await expect(dialog.getByRole('button', { name: 'Publishing...' })).toBeDisabled()
  await expect(page.getByText('Immutable and published')).toBeVisible()

  expect(api.publicationCount()).toBe(1)
  expect(api.payload()).toMatchObject({
    expected_latest_version_number: 1,
    monthly_price: '599',
    entitlements: [
      { entitlement_id: 11, limit_value: '5', is_unlimited: false },
      { entitlement_id: 12, feature_enabled: true, is_unlimited: false },
    ],
  })
})

test('invalid draft is blocked and stale publication is surfaced for review', async ({ page, context }) => {
  const api = await mockCatalog(context, { conflict: true })
  await openCatalog(page)
  await page.getByRole('tab', { name: 'Prepare next version' }).click()
  const editor = page.locator('section[aria-labelledby="catalog-manager-title"]')

  await editor.getByLabel('Monthly price').fill('-1')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  await expect(editor.getByText('Monthly price must be a nonnegative number.')).toBeVisible()
  expect(api.publicationCount()).toBe(0)

  await editor.getByLabel('Monthly price').fill('599')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish version 2' }).click()
  await expect(editor.getByText('The catalog changed since this draft was prepared. Refresh and review the latest version.')).toBeVisible()
  await expect(editor.getByLabel('Monthly price')).toHaveValue('599')
  await expect(editor.getByText('Draft based on version 1')).toBeVisible()
  await expect(editor.getByText('Version 2 was published while this draft was open.')).toBeVisible()
  expect(api.publicationCount()).toBe(1)

  await editor.getByRole('button', { name: 'Rebase preserved draft' }).click()
  await expect(editor.getByLabel('Monthly price')).toHaveValue('599')
  await expect(editor.getByText('Draft based on version 2')).toBeVisible()
  expect(api.publicationCount()).toBe(1)

  await editor.getByRole('button', { name: 'Review publication' }).click()
  const retry = page.getByRole('dialog', { name: 'Publish Growth version 3' })
  await retry.getByRole('button', { name: 'Publish version 3' }).click()
  await expect(page.getByText('Version 3', { exact: true }).first()).toBeVisible()
  expect(api.publicationCount()).toBe(2)
  expect(api.payload()).toMatchObject({ expected_latest_version_number: 2, monthly_price: '599' })
})

test('new numeric definitions require explicit values and preserve finite zero', async ({ page, context }) => {
  const extraLimit = {
    id: 13,
    key: 'warehouse.bins.max',
    name: 'Warehouse bins',
    kind: 'limit',
    value_type: 'integer',
    resource_key: 'warehouse_bins',
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }
  const api = await mockCatalog(context, { definitions: [...definitions, extraLimit] })
  await openCatalog(page)

  await page.getByLabel('Plan Code / Slug').fill('new-plan')
  await page.getByLabel('Display Plan Name').fill('New Plan')
  await page.getByRole('button', { name: 'Create Plan' }).click()
  await expect(page.getByText('Enter a nonnegative limit or the word Unlimited.').first()).toBeVisible()
  expect(api.planCreationCount()).toBe(0)

  await page.getByLabel('Staff seats').fill('0')
  await page.getByLabel('Warehouse bins').fill('8')
  await page.getByRole('button', { name: 'Create Plan' }).click()
  await expect.poll(api.planCreationCount).toBe(1)
  expect(api.planPayload()).toMatchObject({
    entitlements: [
      { entitlement_id: 11, limit_value: '0', is_unlimited: false },
      { entitlement_id: 12, feature_enabled: false, is_unlimited: false },
      { entitlement_id: 13, limit_value: '8', is_unlimited: false },
    ],
  })
})

test('active definition refresh preserves the mounted draft and requires explicit configuration', async ({ page, context }) => {
  const api = await mockCatalog(context)
  await openCatalog(page)
  await page.getByRole('tab', { name: 'Prepare next version' }).click()
  const editor = page.locator('section[aria-labelledby="catalog-manager-title"]')

  await editor.getByLabel('Monthly price').fill('649')
  await editor.getByLabel('Staff seats limit').fill('7')
  api.setDefinitions([
    ...definitions,
    {
      id: 13,
      key: 'warehouse.bins.max',
      name: 'Warehouse bins',
      kind: 'limit',
      value_type: 'integer',
      resource_key: 'warehouse_bins',
      is_active: true,
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T00:00:00Z',
    },
  ])
  await page.getByRole('button', { name: 'Refresh State' }).click()

  await expect(editor.getByLabel('Monthly price')).toHaveValue('649')
  await expect(editor.getByLabel('Staff seats limit')).toHaveValue('7')
  await expect(editor.getByLabel('Warehouse bins limit')).toHaveValue('')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  await expect(editor.getByText('Enter a limit or select Unlimited.')).toBeVisible()
  expect(api.publicationCount()).toBe(0)

  await editor.getByLabel('Warehouse bins limit').fill('8')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  const dialog = page.getByRole('dialog', { name: 'Publish Growth version 2' })
  await expect(dialog.getByText('Warehouse bins')).toBeVisible()
  await expect(dialog.getByText('Not configured')).toBeVisible()
  await expect(dialog.getByText('8', { exact: true })).toBeVisible()
  expect(api.publicationCount()).toBe(0)
})

test('publication dialog traps focus, restores focus, and describes field errors', async ({ page, context }) => {
  await mockCatalog(context)
  await openCatalog(page)
  await page.getByRole('tab', { name: 'Prepare next version' }).click()
  const editor = page.locator('section[aria-labelledby="catalog-manager-title"]')
  const monthly = editor.getByLabel('Monthly price')
  await monthly.fill('-1')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  const errorId = await monthly.getAttribute('aria-describedby')
  expect(errorId).toBeTruthy()
  await expect(page.locator(`[id="${errorId}"]`)).toHaveAttribute('role', 'alert')

  await monthly.fill('599')
  const reviewButton = editor.getByRole('button', { name: 'Review publication' })
  await reviewButton.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Publish version 2' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close publication review' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Publish version 2' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(reviewButton).toBeFocused()
})

test('network failure never reports publication success', async ({ page, context }) => {
  const api = await mockCatalog(context, { networkFailure: true })
  await openCatalog(page)
  await page.getByRole('tab', { name: 'Prepare next version' }).click()
  const editor = page.locator('section[aria-labelledby="catalog-manager-title"]')
  await editor.getByLabel('Monthly price').fill('599')
  await editor.getByRole('button', { name: 'Review publication' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish version 2' }).click()

  await expect(editor.getByText('Unable to reach the server. Please check your connection and try again.')).toBeVisible()
  await expect(page.getByText('Version 1', { exact: true }).first()).toBeVisible()
  expect(api.publicationCount()).toBe(1)
})

for (const width of [375, 768, 1024, 1440]) {
  test(`catalog management remains viewport-safe at ${width}px`, async ({ page, context }) => {
    await mockCatalog(context)
    await page.setViewportSize({ width, height: 900 })
    await openCatalog(page)
    await page.getByRole('tab', { name: 'Prepare next version' }).click()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page.getByRole('button', { name: 'Review publication' })).toBeVisible()
  })
}
