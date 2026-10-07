import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const ownerPermissions = [
  'dashboard.view', 'staff.view', 'staff.manage', 'ownership.transfer',
  'products.view', 'inventory.view', 'sales.view', 'purchasing.view',
  'vendors.view', 'reports.view', 'settings.view', 'subscription.view',
]

const owner = {
  id: 1, user_id: 1, email: 'owner@example.test', full_name: 'Current Owner',
  role: 'owner', status: 'active', shop_id: 1, shop_name: 'Main Branch',
  organization_id: 1, organization_name: 'Test Organization', active_shop_id: 1,
  membership_role: 'owner', permissions: ownerPermissions,
}

const makeStaff = () => [
  {
    membership_id: 10, user_id: 1, full_name: 'Current Owner', email: 'owner@example.test',
    role: 'owner', membership_status: 'active', account_status: 'active', active_shop_id: 1,
    branches: [{ shop_id: 1, shop_name: 'Main Branch', status: 'active', is_current: true }],
    created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
  },
  {
    membership_id: 11, user_id: 2, full_name: 'Long Staff Member Name For Layout Testing',
    email: 'very.long.staff.email.address@example.test', role: 'manager',
    membership_status: 'active', account_status: 'active', active_shop_id: 1,
    branches: [{ shop_id: 1, shop_name: 'Main Branch With A Long Display Name', status: 'active', is_current: true }],
    created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z',
  },
]

async function seedSession(page: Page, account = owner) {
  await page.addInitScript((value) => {
    sessionStorage.setItem('access_token', 'staff-test-token')
    sessionStorage.setItem('auth_user', JSON.stringify(value))
  }, account)
}

async function mockStaffApi(context: BrowserContext) {
  let currentAuth = { ...owner }
  let staff = makeStaff()
  await context.route(/\/api\/v1\//, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/me') return route.fulfill({ json: currentAuth })
    if (path === '/api/v1/shops/1') return route.fulfill({ json: { id: 1, name: 'Main Branch' } })
    if (path === '/api/v1/organizations/current/staff' && request.method() === 'GET') return route.fulfill({ json: staff })
    if (path === '/api/v1/organizations/current/staff' && request.method() === 'POST') {
      const body = request.postDataJSON()
      if (body.email === 'owner@example.test') return route.fulfill({ status: 409, json: { detail: 'A user with this email already exists' } })
      const created = {
        membership_id: 12, user_id: 3, full_name: body.full_name, email: body.email,
        role: body.role, membership_status: 'active', account_status: 'active', active_shop_id: body.default_shop_id,
        branches: [{ shop_id: 1, shop_name: 'Main Branch', status: 'active', is_current: true }],
        created_at: '2026-10-07T10:00:00Z', updated_at: '2026-10-07T10:00:00Z',
      }
      staff = [...staff, created]
      return route.fulfill({ status: 201, json: created })
    }
    if (path === '/api/v1/organizations/current/staff/ownership-transfer') {
      staff = staff.map((member) => member.membership_id === 10 ? { ...member, role: 'admin' } : member.membership_id === 11 ? { ...member, role: 'owner' } : member)
      currentAuth = { ...currentAuth, membership_role: 'admin', permissions: ownerPermissions.filter((permission) => permission !== 'ownership.transfer') }
      return route.fulfill({ json: { previous_owner: staff[0], new_owner: staff[1] } })
    }
    if (/\/staff\/\d+$/.test(path) && request.method() === 'PATCH') {
      const membershipId = Number(path.split('/').at(-1))
      const body = request.postDataJSON()
      staff = staff.map((member) => member.membership_id === membershipId ? { ...member, ...body } : member)
      return route.fulfill({ json: staff.find((member) => member.membership_id === membershipId) })
    }
    if (/\/staff\/\d+\/branches\/\d+$/.test(path)) {
      const membershipId = Number(path.split('/').at(-3))
      return route.fulfill({ json: staff.find((member) => member.membership_id === membershipId) })
    }
    return route.fulfill({ json: {} })
  })
}

test.beforeEach(async ({ context, page }) => {
  await mockStaffApi(context)
  await seedSession(page)
})

test('staff workspace adapts across supported widths and dialogs stay in viewport', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: 'Staff Management' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    if (width < 1024) await expect(page.getByTestId('staff-mobile-cards')).toBeVisible()
    else await expect(page.getByTestId('staff-desktop-table')).toBeVisible()

    await page.getByRole('button', { name: 'Add staff' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    await page.getByRole('button', { name: 'Close Add staff member' }).click()
  }
})

test('role options fail closed and create errors remain controlled', async ({ page }) => {
  await page.goto('/staff')
  await page.getByRole('button', { name: 'Add staff' }).click()
  const roleSelect = page.getByLabel('Role')
  await expect(roleSelect.locator('option')).toHaveCount(6)
  await expect(roleSelect.locator('option[value="owner"]')).toHaveCount(0)
  await expect(roleSelect.locator('option[value="super_admin"]')).toHaveCount(0)
  await page.getByLabel('Full name').fill('Duplicate Owner')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Initial password').fill('StrongPassword123!')
  await page.getByRole('button', { name: 'Create staff' }).click()
  await expect(page.getByText('A user with this email already exists')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('staff creation and access deactivation update the workspace', async ({ page }) => {
  await page.goto('/staff')
  await page.getByRole('button', { name: 'Add staff' }).click()
  await page.getByLabel('Full name').fill('New Cashier')
  await page.getByLabel('Email').fill('cashier@example.test')
  await page.getByLabel('Initial password').fill('StrongPassword123!')
  await page.getByLabel('Role').selectOption('cashier')
  await page.getByRole('button', { name: 'Create staff' }).click()
  await expect(page.getByText('Staff created')).toBeVisible()
  await expect(page.getByTestId('staff-desktop-table').getByText('cashier@example.test')).toBeVisible()

  await page.getByTestId('staff-desktop-table').getByRole('button', { name: 'Deactivate', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Deactivate access' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Deactivate access', exact: true }).click()
  await expect(page.getByText('Access deactivated')).toBeVisible()
})

test('admin role options exclude Admin, Owner, and Super Admin', async ({ context }) => {
  const adminPage = await context.newPage()
  await seedSession(adminPage, {
    ...owner,
    membership_role: 'admin',
    permissions: ['dashboard.view', 'staff.view', 'staff.manage'],
  })
  await adminPage.goto('/staff')
  await adminPage.getByRole('button', { name: 'Add staff' }).click()
  const roleSelect = adminPage.getByLabel('Role')
  await expect(roleSelect.locator('option')).toHaveCount(5)
  await expect(roleSelect.locator('option[value="admin"]')).toHaveCount(0)
  await expect(roleSelect.locator('option[value="owner"]')).toHaveCount(0)
  await expect(roleSelect.locator('option[value="super_admin"]')).toHaveCount(0)
  await adminPage.close()
})

test('ownership transfer requires confirmation and refreshes effective authorization', async ({ page }) => {
  await page.goto('/staff')
  await page.getByRole('button', { name: 'Transfer ownership' }).click()
  await expect(page.getByText('Current Owner becomes Admin immediately.')).toBeVisible()
  const confirm = page.getByRole('button', { name: 'Confirm transfer' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('I understand this changes my role and transfers business ownership.').check()
  await confirm.click()
  await expect(page.getByRole('button', { name: 'Transfer ownership' })).toHaveCount(0)
  await expect(page.getByText('Ownership transferred')).toBeVisible()
})

test('staff route and navigation deny users without staff.view', async ({ context }) => {
  const deniedPage = await context.newPage()
  await seedSession(deniedPage, {
    ...owner,
    membership_role: 'cashier',
    permissions: ['dashboard.view', 'sales.view', 'sales.create'],
  })
  await deniedPage.goto('/staff')
  await expect(deniedPage.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await expect(deniedPage.getByRole('link', { name: 'Staff' })).toHaveCount(0)
  await expect(deniedPage.getByTestId('staff-page')).toHaveCount(0)
  await deniedPage.close()
})

