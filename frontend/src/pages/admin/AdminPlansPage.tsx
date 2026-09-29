import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  BadgeIndianRupee,
  Blocks,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Download,
  Gauge,
  Layers3,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Store,
  ToggleLeft,
  WalletCards,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import { useToast } from '../../components/ui/ToastProvider'
import {
  assignShopSubscription,
  createEntitlement,
  createPlan,
  createShopOverride,
  expireShopOverride,
  getAdminShops,
  getEntitlements,
  getPaymentGateways,
  getPlanEntitlements,
  getPlans,
  getShopOverrides,
  getShopSubscriptionOverview,
  getSubscriptionPayments,
  recordSubscriptionPayment,
  reviewUpiPayment,
  savePaymentGateway,
  updateLicenseStatus,
  updateSubscriptionStatus,
  upsertPlanEntitlement,
} from '../../features/admin/api'
import type { EntitlementDefinition, License, PaymentGatewayConfig, PlanEntitlement, SubscriptionPayment } from '../../features/admin/types'
import { getApiErrorMessage } from '../../lib/api-error'

const featureOptions = [
  ['reports.advanced', 'Advanced reports'],
  ['export.enabled', 'CSV/Excel export'],
  ['api.enabled', 'API access'],
  ['multi_location.enabled', 'Multi-location'],
  ['custom_branding.enabled', 'Custom branding'],
  ['integrations.enabled', 'Integrations'],
] as const

const limitFields = [
  ['products_max', 'Products Limit', 'products.max'],
  ['vendors_max', 'Vendors Allowed', 'vendors.max'],
  ['staff_max', 'Staff Seats', 'staff.max'],
  ['locations_max', 'Locations Allowed', 'locations.max'],
  ['orders_monthly_max', 'Monthly Orders', 'orders.monthly.max'],
  ['storage_max', 'Cloud Storage (GB)', 'storage.max'],
] as const

const gatewayCards = [
  {
    id: 'razorpay',
    title: 'Razorpay',
    subtitle: 'Live INR production',
    enabled: true,
  },
  {
    id: 'stripe',
    title: 'Stripe India',
    subtitle: 'Standby / ready',
    enabled: false,
  },
  {
    id: 'upi_manual',
    title: 'UPI Direct',
    subtitle: 'QR + UTR verification',
    enabled: true,
  },
] as const

function money(value: string | number | null | undefined, currency = 'INR') {
  const numeric = Number(value || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric)
}

function titleFromKey(key: string) {
  return key
    .replace(/\.max$/, '')
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entitlementValue(row?: PlanEntitlement) {
  if (!row) return '-'
  if (row.kind === 'feature') return row.feature_enabled ? 'On' : 'Off'
  if (row.is_unlimited) return 'Unlimited'
  return row.limit_value ?? '-'
}

export default function AdminPlansPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  const [gatewayProvider, setGatewayProvider] = useState('razorpay')
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false)
  const [shopFilter, setShopFilter] = useState('')
  const [pendingLicenseAction, setPendingLicenseAction] = useState<{
    status: 'active' | 'suspended' | 'revoked'
    label: string
    destructive?: boolean
  } | null>(null)
  const [licenseReason, setLicenseReason] = useState('')

  const plansQuery = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => getPlans(true) })
  const entitlementsQuery = useQuery({ queryKey: ['admin', 'entitlements'], queryFn: getEntitlements })
  const shopsQuery = useQuery({ queryKey: ['admin', 'shops'], queryFn: getAdminShops })
  const gatewaysQuery = useQuery({
    queryKey: ['admin', 'payment-gateways'],
    queryFn: getPaymentGateways,
  })
  const allPaymentsQuery = useQuery({
    queryKey: ['admin', 'subscription-payments', 'all'],
    queryFn: () => getSubscriptionPayments(),
  })
  const planEntitlementsQuery = useQuery({
    queryKey: ['admin', 'plan-entitlements', selectedPlanId],
    queryFn: () => getPlanEntitlements(selectedPlanId as number),
    enabled: Boolean(selectedPlanId),
  })
  const shopOverviewQuery = useQuery({
    queryKey: ['admin', 'shop-subscription', selectedShopId],
    queryFn: () => getShopSubscriptionOverview(selectedShopId as number),
    enabled: Boolean(selectedShopId),
  })
  const overridesQuery = useQuery({
    queryKey: ['admin', 'shop-overrides', selectedShopId],
    queryFn: () => getShopOverrides(selectedShopId as number),
    enabled: Boolean(selectedShopId),
  })
  const selectedPaymentsQuery = useQuery({
    queryKey: ['admin', 'subscription-payments', selectedShopId],
    queryFn: () => getSubscriptionPayments(selectedShopId || undefined),
  })

  const plans = plansQuery.data ?? []
  const entitlements = entitlementsQuery.data ?? []
  const shops = shopsQuery.data ?? []
  const gateways = gatewaysQuery.data ?? []
  const payments = allPaymentsQuery.data ?? []
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0]
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) || shops[0]
  const activeGateway = gateways.find((gateway) => gateway.is_active)
  const selectedGateway = gateways.find((gateway) => gateway.provider === gatewayProvider)
  const submittedUpiPayments = payments.filter(
    (payment) => payment.provider === 'upi_manual' && payment.status === 'submitted',
  )

  useEffect(() => {
    if (!selectedPlanId && plans[0]) setSelectedPlanId(plans[0].id)
    if (!selectedShopId && shops[0]) setSelectedShopId(shops[0].id)
  }, [plans, selectedPlanId, selectedShopId, shops])

  const activePlans = plans.filter((plan) => plan.is_active && !plan.is_archived)
  const limitCount = entitlements.filter((item) => item.kind === 'limit').length
  const featureCount = entitlements.filter((item) => item.kind === 'feature').length
  const recurringMonthly = payments
    .filter((payment) => payment.status === 'succeeded')
    .reduce((total, payment) => {
      const amount = Number(payment.amount || 0)
      return total + (payment.billing_interval === 'annual' ? amount / 12 : amount)
    }, 0)

  const selectedPlanEntitlements = planEntitlementsQuery.data ?? []
  const selectedEntitlementMap = useMemo(() => {
    return new Map(selectedPlanEntitlements.map((item) => [item.entitlement_key, item]))
  }, [selectedPlanEntitlements])

  const filteredShops = shops.filter((shop) => {
    const term = shopFilter.trim().toLowerCase()
    if (!term) return true
    return `${shop.name} ${shop.email} ${shop.category}`.toLowerCase().includes(term)
  })

  const runMutation = async (work: () => Promise<unknown>, success: string) => {
    try {
      await work()
      showToast({ title: 'Saved', message: success, variant: 'success' })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      return true
    } catch (err) {
      showToast({
        title: 'Unable to save changes',
        message: getApiErrorMessage(err),
        variant: 'error',
      })
      return false
    }
  }

  const openLicenseAction = (
    status: 'active' | 'suspended' | 'revoked',
    label: string,
    destructive = false,
  ) => {
    setLicenseReason('')
    setPendingLicenseAction({ status, label, destructive })
  }

  const confirmLicenseAction = async () => {
    const license = shopOverviewQuery.data?.license
    if (!license || !pendingLicenseAction) return
    const reason = licenseReason.trim()
    if (!reason) {
      showToast({
        title: 'Reason required',
        message: 'Add an administrator reason before changing license status.',
        variant: 'error',
      })
      return
    }
    const ok = await runMutation(
      () =>
        updateLicenseStatus(license.id, {
          status: pendingLicenseAction.status,
          reason,
        }),
      `License ${pendingLicenseAction.status.replaceAll('_', ' ')}.`,
    )
    if (ok) {
      setPendingLicenseAction(null)
      setLicenseReason('')
    }
  }

  const createPlanMutation = useMutation({
    mutationFn: (form: FormData) =>
      createPlan({
        code: String(form.get('code') || ''),
        name: String(form.get('name') || ''),
        description: String(form.get('description') || '') || null,
        monthly_price: String(form.get('monthly_price') || '0'),
        annual_price: String(form.get('annual_price') || '0'),
        currency: String(form.get('currency') || 'INR'),
        trial_days: Number(form.get('trial_days') || 0),
        grace_period_days: Number(form.get('grace_period_days') || 0),
        is_active: true,
        display_order: Number(form.get('display_order') || 0),
      }),
  })

  const createPlanWithCoreEntitlements = async (form: FormData) => {
    const plan = await createPlanMutation.mutateAsync(form)
    const coreLimits: Record<string, string> = {
      'products.max': String(form.get('products_max') || ''),
      'vendors.max': String(form.get('vendors_max') || ''),
      'staff.max': String(form.get('staff_max') || ''),
      'locations.max': String(form.get('locations_max') || ''),
      'orders.monthly.max': String(form.get('orders_monthly_max') || ''),
      'storage.max': String(form.get('storage_max') || ''),
    }

    for (const [key, value] of Object.entries(coreLimits)) {
      const definition = entitlements.find((item) => item.key === key)
      if (!definition) continue
      const unlimited = value.trim().toLowerCase() === 'unlimited'
      await upsertPlanEntitlement(plan.id, definition.id, {
        is_unlimited: unlimited,
        limit_value: unlimited ? null : value || '0',
        feature_enabled: null,
      })
    }

    for (const [key] of featureOptions) {
      const definition = entitlements.find((item) => item.key === key)
      if (!definition) continue
      await upsertPlanEntitlement(plan.id, definition.id, {
        is_unlimited: false,
        limit_value: null,
        feature_enabled: form.get(key) === 'on',
      })
    }
  }

  const createEntitlementMutation = useMutation({
    mutationFn: (form: FormData) =>
      createEntitlement({
        key: String(form.get('key') || ''),
        name: String(form.get('name') || ''),
        kind: String(form.get('kind') || 'limit') as 'limit' | 'feature',
        value_type: String(form.get('value_type') || 'integer'),
        resource_key: String(form.get('resource_key') || '') || null,
      }),
  })

  const configureEntitlement = (definition: EntitlementDefinition, form: FormData) => {
    if (!selectedPlan) return
    const isUnlimited = form.get('is_unlimited') === 'on'
    const enabled = form.get('feature_enabled') === 'on'
    runMutation(
      () =>
        upsertPlanEntitlement(selectedPlan.id, definition.id, {
          is_unlimited: definition.kind === 'limit' ? isUnlimited : false,
          limit_value:
            definition.kind === 'limit' && !isUnlimited
              ? String(form.get('limit_value') || '0')
              : null,
          feature_enabled: definition.kind === 'feature' ? enabled : null,
        }),
      'Plan entitlement saved.',
    )
  }

  const assignSelectedShop = (form: FormData) => {
    if (!selectedShop) return
    runMutation(
      () =>
        assignShopSubscription(selectedShop.id, {
          plan_id: Number(form.get('plan_id')),
          status: String(form.get('status') || 'active'),
          billing_interval: String(form.get('billing_interval') || 'monthly'),
          reason: String(form.get('reason') || '') || null,
        }),
      'Shop subscription updated.',
    )
  }

  const createOverride = (form: FormData) => {
    if (!selectedShop) return
    const definition = entitlements.find((item) => item.id === Number(form.get('entitlement_id')))
    if (!definition) return
    const isUnlimited = form.get('is_unlimited') === 'on'
    runMutation(
      () =>
        createShopOverride(selectedShop.id, {
          entitlement_id: definition.id,
          is_unlimited: definition.kind === 'limit' ? isUnlimited : false,
          limit_value:
            definition.kind === 'limit' && !isUnlimited
              ? String(form.get('limit_value') || '0')
              : null,
          feature_enabled: definition.kind === 'feature' ? form.get('feature_enabled') === 'on' : null,
          reason: String(form.get('reason') || '') || null,
        }),
      'Shop override added.',
    )
  }

  const recordPayment = (form: FormData) => {
    if (!selectedShop) return
    runMutation(
      () =>
        recordSubscriptionPayment({
          shop_id: selectedShop.id,
          plan_id: Number(form.get('plan_id')),
          amount: String(form.get('amount') || '0'),
          currency: String(form.get('currency') || 'INR'),
          billing_interval: String(form.get('billing_interval') || 'monthly'),
          provider: String(form.get('provider') || 'manual'),
          provider_payment_id: String(form.get('provider_payment_id') || ''),
          provider_event_id: String(form.get('provider_event_id') || '') || null,
          status: String(form.get('status') || 'succeeded'),
          reason: String(form.get('reason') || '') || null,
        }),
      'Payment recorded.',
    )
  }

  const saveGateway = async (form: FormData) => {
    const isUpi = gatewayProvider === 'upi_manual'
    const saved = await runMutation(
      () =>
        savePaymentGateway({
          provider: gatewayProvider,
          display_name: String(form.get('display_name') || (isUpi ? 'Direct UPI' : 'Razorpay')),
          key_id: isUpi ? null : String(form.get('key_id') || '') || null,
          key_secret: isUpi ? null : String(form.get('key_secret') || '') || null,
          webhook_secret: isUpi ? null : String(form.get('webhook_secret') || '') || null,
          settings: isUpi
            ? {
                upi_id: String(form.get('upi_id') || ''),
                payee_name: String(form.get('payee_name') || ''),
                merchant_code: String(form.get('merchant_code') || ''),
                note_prefix: String(form.get('note_prefix') || ''),
                instructions: String(form.get('instructions') || ''),
              }
            : {},
          is_active: form.get('is_active') === 'on',
          is_test_mode: form.get('is_test_mode') === 'on',
        }),
      `${isUpi ? 'UPI collection account' : 'Razorpay gateway'} saved.`,
    )
    if (saved) setGatewayModalOpen(false)
  }

  const reviewPayment = (payment: SubscriptionPayment, status: 'succeeded' | 'failed') =>
    runMutation(
      () =>
        reviewUpiPayment(payment.id, {
          status,
          reason: status === 'succeeded' ? 'UTR matched by administrator' : 'UTR could not be verified',
        }),
      status === 'succeeded' ? 'UPI payment approved and subscription activated.' : 'UPI payment rejected.',
    )

  const webhookUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/v1/subscription/webhooks/razorpay`

  return (
    <section className="mx-auto w-full max-w-[1680px] px-4 pb-10 sm:px-6 xl:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
            <ShieldCheck size={13} />
            Commercial Access Active
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Production Billing
          </div>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
            Plans & Subscription Administration
          </h1>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
            Configure database-driven tier plans, dynamic entitlements, payment gateway credentials, shop subscriptions, overrides, and transaction ledgers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Download size={16} />
            Audit Export
          </button>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none"
          >
            <RefreshCcw size={16} />
            Refresh State
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Layers3 size={19} />} label="Active Tier Plans" value={`${activePlans.length} Plans`} helper={activePlans.map((plan) => plan.name).slice(0, 4).join(', ') || 'No active plans'} />
        <MetricCard icon={<ListChecks size={19} />} label="Entitlements" value={`${entitlements.length} Rules`} helper={`${limitCount} limits / ${featureCount} feature flags`} accent="violet" />
        <MetricCard icon={<Gauge size={19} />} label="Gateway Status" value={activeGateway?.display_name || 'Not configured'} helper={activeGateway?.is_active ? `${activeGateway.is_test_mode ? 'Test' : 'Live'} gateway active` : 'Needs setup'} accent={activeGateway?.is_active ? 'cyan' : 'amber'} />
        <MetricCard icon={<Store size={19} />} label="Subscribed Shops" value={String(shops.length)} helper={`${shopOverviewQuery.data?.limits.length ?? 0} tracked meters on selected shop`} />
        <MetricCard icon={<WalletCards size={19} />} label="Monthly Recurring" value={money(recurringMonthly)} helper={`${money(recurringMonthly * 12)} run rate`} accent="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.85fr]">
        <Card
          icon={<Blocks size={20} />}
          title="Plan Configurator"
          description="Define database-level tier properties, storage quotas, and feature flags."
          action={<Pill>Schema Builder</Pill>}
        >
          <form
            className="space-y-5"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const ok = await runMutation(() => createPlanWithCoreEntitlements(form), 'Plan and core limits created.')
              if (ok) event.currentTarget.reset()
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="code" label="Plan Code / Slug" placeholder="starter_v2" required />
              <Field name="name" label="Display Plan Name" placeholder="Starter Pro Tier" required />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field name="monthly_price" label="Monthly Price (INR)" placeholder="1499" type="number" />
              <Field name="annual_price" label="Yearly Price (INR)" placeholder="14990" type="number" />
              <Field name="trial_days" label="Trial Period (Days)" placeholder="14" type="number" />
              <Field name="grace_period_days" label="Grace Period (Days)" placeholder="7" type="number" />
              <input type="hidden" name="currency" value="INR" />
            </div>
            <TextArea name="description" label="Plan Description" placeholder="Essential operational toolset for scaling retail stores." />

            <div>
              <SectionTitle icon={<Gauge size={15} />} title="Hard Quota Allocations" />
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {limitFields.map(([name, label]) => (
                  <div key={name} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                    <Field name={name} label={label} placeholder={name.includes('storage') ? '25' : '100'} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle icon={<ToggleLeft size={15} />} title="Enabled Entitlement Flags" />
              <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-3">
                {featureOptions.map(([name, label]) => (
                  <label key={name} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <input name={name} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button type="reset" className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Reset Draft
              </button>
              <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none">
                <Save size={16} />
                Create Plan
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card
            icon={<Database size={20} />}
            title="Plan Entitlements"
            description="Schema registry for enforceable meter flags."
            action={<Pill>{entitlements.length} Defined</Pill>}
          >
            <form
              className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20"
              onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                const ok = await runMutation(
                  () => createEntitlementMutation.mutateAsync(new FormData(event.currentTarget)),
                  'Entitlement created.',
                )
                if (ok) event.currentTarget.reset()
              }}
            >
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Define New Entitlement
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field name="key" label="Entitlement Key" placeholder="products.max" required />
                <Field name="name" label="Display Label" placeholder="Maximum Products" required />
                <SelectBox name="kind" label="Rule Type" options={['limit', 'feature']} />
                <SelectBox name="value_type" label="Value Type" options={['integer', 'decimal', 'boolean', 'string']} />
                <Field name="resource_key" label="Category" placeholder="products" />
              </div>
              <button className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none">
                <Plus size={15} />
                Create Entitlement
              </button>
            </form>

            <div className="mt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Active Schema Registry
              </p>
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {entitlements.map((definition) => (
                  <div key={definition.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-black text-slate-900 dark:text-white">{definition.key}</p>
                      <p className="text-xs text-slate-500">{definition.kind} / {definition.value_type}</p>
                    </div>
                    <Pill>{definition.resource_key || 'platform'}</Pill>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            icon={<SlidersHorizontal size={20} />}
            title="Shop Overrides"
            description="Inject custom quota exceptions per merchant."
            action={<Pill>Bypass</Pill>}
          >
            <form
              className="space-y-3"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                createOverride(new FormData(event.currentTarget))
                event.currentTarget.reset()
              }}
            >
              <SelectBox
                name="entitlement_id"
                label="Target Entitlement"
                options={entitlements.map((item) => String(item.id))}
                labels={Object.fromEntries(entitlements.map((item) => [String(item.id), item.key]))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Field name="limit_value" label="Override Value" placeholder="2500" />
                <Field name="reason" label="Reason for Exception" placeholder="Annual expansion grant" />
              </div>
              <div className="flex flex-wrap gap-5">
                <CheckInput name="is_unlimited" label="Unlimited" />
                <CheckInput name="feature_enabled" label="Feature on" />
              </div>
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none">
                <ShieldCheck size={15} />
                Add Override
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {overridesQuery.data?.slice(0, 4).map((override) => (
                <div key={override.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">{override.entitlement_key}</p>
                    <p className="text-xs text-slate-500">{override.is_unlimited ? 'Unlimited' : override.limit_value ?? String(override.feature_enabled)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runMutation(() => expireShopOverride(override.id, 'Expired by administrator'), 'Override expired.')}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200"
                  >
                    <Archive size={13} />
                    Expire
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.85fr]">
        <Card
          icon={<CreditCard size={20} />}
          title="Payment Gateway Settings"
          description="Merchant provider routing, live keys, and webhook signing endpoints."
          action={<Pill>{activeGateway?.is_active ? 'Active Gateway' : 'Needs Setup'}</Pill>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {gatewayCards.map((gateway) => (
              <button
                key={gateway.id}
                type="button"
                disabled={!gateway.enabled}
                onClick={() => {
                  setGatewayProvider(gateway.id)
                  setGatewayModalOpen(true)
                }}
                className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                  activeGateway?.provider === gateway.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                } ${!gateway.enabled ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md'}`}
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                  {gateway.id === 'upi_manual' ? <Smartphone size={18} /> : <CreditCard size={18} />}
                </span>
                <p className="text-sm font-black">{gateway.title}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{gateway.subtitle}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-300">
                  {gateway.enabled ? (gateways.some((item) => item.provider === gateway.id) ? 'Configure' : 'Set up') : 'Coming soon'}
                  {gateway.enabled && <Settings2 size={13} />}
                </span>
                {activeGateway?.provider === gateway.id && (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Currently routing checkout through</p>
              <p className="mt-1 font-black text-slate-950 dark:text-white">{activeGateway?.display_name || 'No active payment method'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setGatewayProvider(activeGateway?.provider || 'razorpay')
                setGatewayModalOpen(true)
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Settings2 size={16} />
              Configure payment method
            </button>
          </div>
        </Card>

        <Card
          icon={<ReceiptText size={20} />}
          title="Payments Ledger"
          description="Record offline payments and manual ledger reconciliations."
          action={<Pill>Manual Sync</Pill>}
        >
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              recordPayment(new FormData(event.currentTarget))
              event.currentTarget.reset()
            }}
          >
            <SelectBox
              name="plan_id"
              label="Client Plan"
              options={plans.filter((plan) => plan.is_active && !plan.is_archived).map((plan) => String(plan.id))}
              labels={Object.fromEntries(plans.map((plan) => [String(plan.id), plan.name]))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Field name="amount" label="Amount (INR)" placeholder="999" required />
              <Field name="currency" label="Currency" placeholder="INR" />
              <SelectBox name="billing_interval" label="Billing Interval" options={['monthly', 'annual']} />
              <SelectBox name="status" label="Status" options={['succeeded', 'failed', 'pending', 'refunded']} />
              <Field name="provider" label="Method" placeholder="manual" />
              <Field name="provider_payment_id" label="Payment Ref" placeholder="NEFT_991820" required />
            </div>
            <Field name="reason" label="Notes / Ledger Reason" placeholder="Direct bank deposit confirmed." />
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none">
              <BadgeIndianRupee size={16} />
              Record Payment
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white">UPI verification queue</p>
                <p className="text-xs font-semibold text-slate-500">Approve only after matching the UTR with your bank statement.</p>
              </div>
              <Pill>{submittedUpiPayments.length} pending</Pill>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {submittedUpiPayments.map((payment) => {
                const shop = shops.find((item) => item.id === payment.shop_id)
                return (
                  <div key={payment.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/25">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{shop?.name || `Shop #${payment.shop_id}`}</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">UTR {payment.customer_reference}</p>
                      </div>
                      <p className="text-sm font-black text-slate-950 dark:text-white">{money(payment.amount, payment.currency)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => reviewPayment(payment, 'failed')} className="h-9 rounded-lg border border-red-200 bg-white text-xs font-black text-red-600 dark:border-red-900 dark:bg-slate-950">
                        Reject
                      </button>
                      <button type="button" onClick={() => reviewPayment(payment, 'succeeded')} className="h-9 rounded-lg bg-emerald-600 text-xs font-black text-white">
                        Approve
                      </button>
                    </div>
                  </div>
                )
              })}
              {!submittedUpiPayments.length && (
                <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs font-semibold text-slate-500 dark:bg-slate-950">
                  No UPI payments are waiting for review.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card
          icon={<Layers3 size={20} />}
          title={`Configure ${selectedPlan?.name || 'Plan'} Rules`}
          description="Select a plan and save its enforceable meter values."
        >
          <div className="mb-4 grid gap-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedPlan?.id === plan.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{plan.name}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{plan.code}</span>
                </span>
                <span className="text-xs font-black">{money(plan.monthly_price, plan.currency)}</span>
              </button>
            ))}
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {entitlements.map((definition) => {
              const configured = selectedEntitlementMap.get(definition.key)
              return (
                <form
                  key={definition.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                  onSubmit={(event) => {
                    event.preventDefault()
                    configureEntitlement(definition, new FormData(event.currentTarget))
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-black text-slate-950 dark:text-white">{definition.key}</p>
                      <p className="text-xs text-slate-500">{definition.kind} / current: {String(entitlementValue(configured))}</p>
                    </div>
                    <Pill>{definition.resource_key || 'platform'}</Pill>
                  </div>
                  {definition.kind === 'limit' ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <Field name="limit_value" label="Limit Value" placeholder={String(configured?.limit_value ?? '100')} />
                      <CheckInput name="is_unlimited" label="Unlimited" defaultChecked={configured?.is_unlimited} />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                        <CheckCircle2 size={15} />
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <CheckInput name="feature_enabled" label="Enabled for this plan" defaultChecked={Boolean(configured?.feature_enabled)} />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                        <CheckCircle2 size={15} />
                        Save
                      </button>
                    </div>
                  )}
                </form>
              )
            })}
          </div>
        </Card>

        <Card
          icon={<Store size={20} />}
          title="Shop Subscriptions Registry"
          description="Live overview of connected merchant shops, active allotments, and quota health."
          action={<Pill>All ({shops.length})</Pill>}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Field
              value={shopFilter}
              onChange={(event) => setShopFilter(event.target.value)}
              label="Filter Shops"
              placeholder="Filter by shop or plan..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:bg-slate-950">
                  <th className="px-4 py-3">Shop Details</th>
                  <th className="px-4 py-3">Tier Plan</th>
                  <th className="px-4 py-3">Subscription Status</th>
                  <th className="px-4 py-3">Quota Utilization</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredShops.slice(0, 8).map((shop) => {
                  const isSelected = selectedShop?.id === shop.id
                  const usageLimit = isSelected ? shopOverviewQuery.data?.limits[0] : null
                  const used = usageLimit?.used ?? 0
                  const limit = Number(usageLimit?.limit_value || 0)
                  const pct = usageLimit?.is_unlimited || !limit ? 0 : Math.min((used / limit) * 100, 100)
                  return (
                    <tr key={shop.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950">
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-950 dark:text-white">{shop.name}</p>
                        <p className="text-xs font-mono text-slate-400">ID: SH-{shop.id} / {shop.category}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Pill>{isSelected ? shopOverviewQuery.data?.plan?.name || 'Unassigned' : 'Select to view'}</Pill>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill active={isSelected && shopOverviewQuery.data?.access_allowed}>
                          {isSelected ? shopOverviewQuery.data?.subscription?.status || '-' : '-'}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-4">
                        {isSelected && usageLimit ? (
                          <div className="w-44 space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span>{usageLimit.is_unlimited ? 'Unlimited' : `${used} / ${usageLimit.limit_value ?? '-'}`}</span>
                              <span className={usageLimit.over_limit ? 'font-black text-red-600' : 'font-black text-indigo-600'}>
                                {usageLimit.is_unlimited ? 'OK' : `${Math.round(pct)}%`}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className={`h-full rounded-full ${usageLimit.over_limit ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${usageLimit.is_unlimited ? 100 : pct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedShopId(shop.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200"
                        >
                          <Settings2 size={14} />
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card
          icon={<CalendarDays size={20} />}
          title={`Selected Shop Controls${selectedShop ? ` - ${selectedShop.name}` : ''}`}
          description="Assign plan, suspend subscriptions, and revoke licenses with audit reasons."
        >
          {selectedShop && (
            <div className="space-y-5">
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  assignSelectedShop(new FormData(event.currentTarget))
                }}
              >
                <SelectBox
                  name="plan_id"
                  label="Plan"
                  options={plans.filter((plan) => plan.is_active && !plan.is_archived).map((plan) => String(plan.id))}
                  labels={Object.fromEntries(plans.map((plan) => [String(plan.id), plan.name]))}
                />
                <SelectBox name="status" label="Status" options={['active', 'past_due', 'grace_period', 'suspended', 'expired', 'cancelled']} />
                <SelectBox name="billing_interval" label="Cycle" options={['monthly', 'annual', 'legacy']} />
                <Field name="reason" label="Reason" placeholder="Administrative plan change" />
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none md:col-span-2">
                  <Save size={16} />
                  Assign Subscription
                </button>
              </form>

              {shopOverviewQuery.data && (
                <div className="grid gap-3 md:grid-cols-3">
                  <MiniStat label="Plan" value={shopOverviewQuery.data.plan?.name || '-'} />
                  <MiniStat label="Subscription" value={shopOverviewQuery.data.subscription?.status || '-'} />
                  <MiniStat label="Access" value={shopOverviewQuery.data.access_allowed ? 'Allowed' : shopOverviewQuery.data.access_code || 'Blocked'} />
                </div>
              )}

              {shopOverviewQuery.data?.license && (
                <LicensePanel
                  license={shopOverviewQuery.data.license}
                  planName={shopOverviewQuery.data.plan?.name || '-'}
                  billingInterval={shopOverviewQuery.data.subscription?.billing_interval || '-'}
                  subscriptionStatus={shopOverviewQuery.data.subscription?.status || '-'}
                  onAction={openLicenseAction}
                />
              )}

              <div className="flex flex-wrap gap-3">
                {shopOverviewQuery.data?.subscription && (
                  <button
                    type="button"
                    onClick={() =>
                      runMutation(
                        () =>
                          updateSubscriptionStatus(shopOverviewQuery.data!.subscription!.id, {
                            status: 'suspended',
                            reason: 'Suspended by administrator',
                          }),
                        'Subscription suspended.',
                      )
                    }
                    className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white"
                  >
                    Suspend Subscription
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card
          icon={<ReceiptText size={20} />}
          title="Recent Payments"
          description="Latest manual and gateway payment records for the selected merchant."
        >
          <div className="space-y-3">
            {(selectedPaymentsQuery.data ?? []).slice(0, 8).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{payment.provider_payment_id}</span>
                  <StatusPill active={payment.status === 'succeeded'}>{payment.status}</StatusPill>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {money(payment.amount, payment.currency)} via {payment.provider} / {payment.billing_interval || 'monthly'}
                </p>
              </div>
            ))}
            {!selectedPaymentsQuery.data?.length && (
              <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-800">
                No payments recorded for this selection yet.
              </p>
            )}
          </div>
        </Card>
      </div>

      {gatewayModalOpen && (
        <GatewaySetupModal
          key={gatewayProvider}
          provider={gatewayProvider}
          config={selectedGateway}
          webhookUrl={webhookUrl}
          onClose={() => setGatewayModalOpen(false)}
          onSave={saveGateway}
          onCopyWebhook={() => {
            navigator.clipboard.writeText(webhookUrl)
            showToast({ title: 'Webhook copied', message: 'Webhook endpoint copied to clipboard.', variant: 'success' })
          }}
        />
      )}

      {pendingLicenseAction && (
        <LicenseActionModal
          action={pendingLicenseAction}
          reason={licenseReason}
          onReasonChange={setLicenseReason}
          onClose={() => setPendingLicenseAction(null)}
          onConfirm={confirmLicenseAction}
        />
      )}
    </section>
  )
}

function LicensePanel({
  license,
  planName,
  billingInterval,
  subscriptionStatus,
  onAction,
}: {
  license: License
  planName: string
  billingInterval: string
  subscriptionStatus: string
  onAction: (status: 'active' | 'suspended' | 'revoked', label: string, destructive?: boolean) => void
}) {
  const status = license.status
  const actions: { status: 'active' | 'suspended' | 'revoked'; label: string; destructive?: boolean }[] = []
  if (status === 'active') {
    actions.push({ status: 'suspended', label: 'Suspend License' })
    actions.push({ status: 'revoked', label: 'Revoke License', destructive: true })
  } else if (status === 'suspended') {
    actions.push({ status: 'active', label: 'Reactivate License' })
    actions.push({ status: 'revoked', label: 'Revoke License', destructive: true })
  } else if (status === 'pending' || status === 'expired') {
    actions.push({ status: 'revoked', label: 'Revoke License', destructive: true })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">License</p>
          <p className="mt-1 truncate font-mono text-sm font-black text-slate-950 dark:text-white">
            {license.masked_key}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Masked identifier only. The full secret key is not stored or displayed.
          </p>
        </div>
        <StatusPill active={status === 'active'}>{status.replaceAll('_', ' ')}</StatusPill>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Issued" value={formatDateTime(license.issued_at)} />
        <MiniStat label="Activated" value={formatDateTime(license.activated_at)} />
        <MiniStat label="Expires" value={formatDateTime(license.expires_at)} />
        <MiniStat label="Revoked" value={formatDateTime(license.revoked_at)} />
        <MiniStat label="Plan" value={planName} />
        <MiniStat label="Billing" value={billingInterval} />
        <MiniStat label="Subscription" value={subscriptionStatus} />
        <MiniStat label="License ID" value={`LIC-${license.id}`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            onClick={() => onAction(action.status, action.label, action.destructive)}
            className={`rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${
              action.destructive
                ? 'bg-red-600 hover:bg-red-700'
                : action.status === 'active'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {action.label}
          </button>
        ))}
        {!actions.length && (
          <p className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            No direct license action is available for this status.
          </p>
        )}
      </div>
    </div>
  )
}

function LicenseActionModal({
  action,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  action: { status: 'active' | 'suspended' | 'revoked'; label: string; destructive?: boolean }
  reason: string
  onReasonChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-action-title"
        className="w-full max-w-xl rounded-t-[28px] border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-[28px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              License lifecycle
            </p>
            <h2 id="license-action-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {action.label}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              This changes server-side tenant access. Add the administrator reason that should appear in audit records.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          {action.destructive && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Revocation is a security-sensitive action and cannot be directly reactivated. A future reissue workflow is required.
            </div>
          )}
          <TextArea
            label="Admin Reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Explain why this license status is changing"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`rounded-xl px-4 py-3 text-sm font-black text-white transition ${
                action.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              Confirm {action.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GatewaySetupModal({
  provider,
  config,
  webhookUrl,
  onClose,
  onSave,
  onCopyWebhook,
}: {
  provider: string
  config?: PaymentGatewayConfig
  webhookUrl: string
  onClose: () => void
  onSave: (form: FormData) => Promise<void>
  onCopyWebhook: () => void
}) {
  const isUpi = provider === 'upi_manual'
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-dialog-title"
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-[28px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              {isUpi ? <Smartphone size={20} /> : <CreditCard size={20} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Secure payment setup</p>
              <h2 id="gateway-dialog-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white sm:text-2xl">
                {isUpi ? 'Configure Direct UPI' : 'Configure Razorpay'}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {isUpi ? 'Customers scan a QR and submit their UTR for your approval.' : 'Credentials are encrypted before they are stored.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close gateway setup" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-5 p-5 sm:p-7"
          onSubmit={async (event) => {
            event.preventDefault()
            setSaving(true)
            try {
              await onSave(new FormData(event.currentTarget))
            } finally {
              setSaving(false)
            }
          }}
        >
          <Field
            name="display_name"
            label="Account label"
            defaultValue={config?.display_name || (isUpi ? 'Direct UPI' : 'Razorpay')}
            required
          />

          {isUpi ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="upi_id" label="Receiving UPI ID" placeholder="billing@bank" defaultValue={String(config?.settings?.upi_id || '')} required />
                <Field name="payee_name" label="Payee / business name" placeholder="Purple Retail Pvt Ltd" defaultValue={String(config?.settings?.payee_name || '')} required />
                <Field name="merchant_code" label="Merchant category code" placeholder="Optional, e.g. 7399" defaultValue={String(config?.settings?.merchant_code || '')} />
                <Field name="note_prefix" label="Payment note prefix" placeholder="Subscription payment" defaultValue={String(config?.settings?.note_prefix || 'Subscription')} />
              </div>
              <TextArea
                name="instructions"
                label="Customer instructions"
                placeholder="Pay the exact amount, then enter the UTR shown by your UPI app."
                defaultValue={String(config?.settings?.instructions || '')}
              />
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                Direct UPI has no signed payment callback. A submitted UTR enters the verification queue and never activates a plan until a super admin approves it.
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="key_id" label="Razorpay Key ID" placeholder="rzp_live_xxxxx" defaultValue={config?.key_id || ''} required />
                <Field
                  name="key_secret"
                  label="Razorpay Key Secret"
                  placeholder={config?.key_secret_masked ? 'Leave blank to keep stored secret' : 'Paste the key secret'}
                  type="password"
                  required={!config?.key_secret_masked}
                />
              </div>
              <Field
                name="webhook_secret"
                label="Webhook signing secret"
                placeholder={config?.webhook_secret_masked ? 'Leave blank to keep stored secret' : 'Recommended for payment.captured verification'}
                type="password"
              />
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Webhook endpoint</span>
                <span className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <span className="min-w-0 flex-1 truncate">{webhookUrl}</span>
                  <button type="button" onClick={onCopyWebhook} title="Copy webhook endpoint" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                    <Copy size={14} />
                  </button>
                </span>
              </label>
            </>
          )}

          <div className="flex flex-col gap-3 rounded-2xl bg-indigo-50 px-4 py-4 dark:bg-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
            <CheckInput name="is_active" label="Use for customer checkout" defaultChecked={config?.is_active ?? true} />
            {!isUpi && <CheckInput name="is_test_mode" label="Test / sandbox mode" defaultChecked={config?.is_test_mode ?? true} />}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              Cancel
            </button>
            <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-black text-white shadow-lg shadow-indigo-200 disabled:cursor-wait disabled:opacity-60 dark:shadow-none">
              <Save size={16} />
              {saving ? 'Saving...' : `Save ${isUpi ? 'UPI account' : 'Razorpay'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Card({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm font-medium leading-5 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  accent = 'indigo',
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
  accent?: 'indigo' | 'violet' | 'cyan' | 'amber'
}) {
  const accents = {
    indigo: 'border-l-indigo-600 text-indigo-600',
    violet: 'border-l-violet-600 text-violet-600',
    cyan: 'border-l-cyan-600 text-cyan-600',
    amber: 'border-l-amber-500 text-amber-600',
  }
  return (
    <div className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${accents[accent]}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{value}</p>
      <p className="mt-2 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
      <span className="text-indigo-600">{icon}</span>
      {title}
    </p>
  )
}

function Field({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      <input
        {...props}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950"
      />
    </label>
  )
}

function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      <textarea
        {...props}
        rows={3}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950"
      />
    </label>
  )
}

function SelectBox({
  label,
  options,
  labels,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  options: string[]
  labels?: Record<string, string>
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      <select
        {...props}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] || titleFromKey(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckInput({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
      {label}
    </label>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
      {children}
    </span>
  )
}

function StatusPill({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black capitalize ${
        active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {children}
    </span>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
