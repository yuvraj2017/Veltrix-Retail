import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Handshake,
  Infinity as InfinityIcon,
  KeyRound,
  Mail,
  MapPin,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { createCheckoutSession, getAvailablePlans, getMySubscription, submitUpiPaymentReference, verifyRazorpayPayment } from '../features/subscription/api'
import type { Plan, PlanEntitlement, UsageLimit } from '../features/admin/types'
import { getApiErrorMessage } from '../lib/api-error'
import { useToast } from '../components/ui/ToastProvider'

type BillingInterval = 'monthly' | 'annual'
type MatrixFilter = 'all' | 'limits' | 'features'
type UpiCheckout = {
  paymentId: string
  amount: string
  currency: string
  planName: string
  upiId: string
  payeeName: string
  upiUri: string
  instructions: string
  isTestMode: boolean
}

const resourceIcons = [Package, Handshake, Users, MapPin, FileText, Database]

const resourceLabels: Record<string, string> = {
  products: 'Products',
  vendors: 'Vendors',
  staff: 'Staff',
  users: 'Staff',
  locations: 'Locations',
  'orders.monthly': 'Monthly orders',
  storage: 'Storage',
}

const featureLabels: Record<string, string> = {
  'reports.advanced': 'Advanced reporting',
  'export.enabled': 'CSV / Excel export',
  'api.enabled': 'API access',
  'multi_location.enabled': 'Multi-location',
  'custom_branding.enabled': 'Custom branding',
  'integrations.enabled': 'Integrations',
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: string | number | null | undefined, currency = 'INR') {
  const amount = toNumber(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function formatCompactNumber(value?: string | number | null) {
  if (value === null || value === undefined) return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (numeric >= 1000) return numeric.toLocaleString('en-IN')
  return numeric.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function humanizeKey(key: string) {
  return (
    featureLabels[key] ||
    resourceLabels[key] ||
    key
      .replaceAll('.', ' ')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

function limitLabel(entitlement: PlanEntitlement) {
  return humanizeKey(entitlement.resource_key || entitlement.entitlement_key.replace(/\.max$/, ''))
}

function featureLabel(entitlement: PlanEntitlement) {
  return humanizeKey(entitlement.entitlement_key)
}

function formatEntitlementValue(entitlement: PlanEntitlement) {
  if (entitlement.kind === 'feature') {
    return entitlement.feature_enabled ? 'Included' : 'Not included'
  }

  if (entitlement.is_unlimited) return 'Unlimited'
  if (entitlement.limit_value === null || entitlement.limit_value === undefined) return 'Configured'

  const label = limitLabel(entitlement).toLowerCase()
  const suffix = label.includes('storage') ? ' GB' : ''
  return `${formatCompactNumber(entitlement.limit_value)}${suffix}`
}

function sortEntitlements(entitlements: PlanEntitlement[]) {
  const preferred = [
    'products.max',
    'vendors.max',
    'staff.max',
    'locations.max',
    'orders.monthly.max',
    'storage.max',
    'reports.advanced',
    'export.enabled',
    'api.enabled',
    'multi_location.enabled',
    'custom_branding.enabled',
    'integrations.enabled',
  ]
  return [...entitlements].sort((a, b) => {
    const left = preferred.indexOf(a.entitlement_key)
    const right = preferred.indexOf(b.entitlement_key)
    if (left !== -1 || right !== -1) {
      return (left === -1 ? 999 : left) - (right === -1 ? 999 : right)
    }
    return a.entitlement_key.localeCompare(b.entitlement_key)
  })
}

function planHighlights(plan: Plan) {
  const entitlements = sortEntitlements(plan.entitlements ?? [])
  const limits = entitlements
    .filter((entitlement) => entitlement.kind === 'limit')
    .map((entitlement) => ({
      label: `${formatEntitlementValue(entitlement)} ${limitLabel(entitlement).toLowerCase()}`,
      enabled: true,
    }))
  const features = entitlements
    .filter((entitlement) => entitlement.kind === 'feature')
    .slice(0, 4)
    .map((entitlement) => ({
      label: featureLabel(entitlement),
      enabled: Boolean(entitlement.feature_enabled),
    }))

  const fallback = [
    { label: `${plan.trial_days || 0} day trial window`, enabled: true },
    { label: `${plan.grace_period_days || 0} day grace period`, enabled: true },
    { label: `${plan.currency} billing`, enabled: true },
  ]

  return [...limits, ...features].slice(0, 6).length
    ? [...limits, ...features].slice(0, 6)
    : fallback
}

function UsageMeter({ limit }: { limit: UsageLimit }) {
  const used = limit.used ?? 0
  const finite = !limit.is_unlimited && limit.limit_value !== null && limit.limit_value !== undefined
  const pct = finite ? Math.min((used / Math.max(toNumber(limit.limit_value), 1)) * 100, 100) : 100

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
            {humanizeKey(limit.resource_key || limit.key)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {limit.usage_supported ? 'Measured from your shop data' : 'Usage not measured yet'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
            limit.over_limit
              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {limit.over_limit ? 'Over' : 'OK'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span>{limit.usage_supported ? used.toLocaleString('en-IN') : '-'}</span>
        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
          {limit.is_unlimited ? <InfinityIcon size={15} /> : formatCompactNumber(limit.limit_value)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${
            limit.over_limit ? 'bg-red-500' : limit.is_unlimited ? 'bg-emerald-500' : 'bg-indigo-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('annual')
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>('all')
  const [search, setSearch] = useState('')
  const [openFaq, setOpenFaq] = useState(0)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [upiCheckout, setUpiCheckout] = useState<UpiCheckout | null>(null)

  const query = useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: getMySubscription,
  })
  const plansQuery = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: getAvailablePlans,
  })

  const data = query.data
  const plans = plansQuery.data ?? []
  const license = data?.license
  const currentPlanId = data?.plan?.id
  const error = query.error
    ? getApiErrorMessage(query.error, 'Unable to load subscription details')
    : plansQuery.error
      ? getApiErrorMessage(plansQuery.error, 'Unable to load available plans')
      : ''

  const currencies = useMemo(() => {
    const values = Array.from(new Set(plans.map((plan) => plan.currency).filter(Boolean)))
    return values.length ? values : [data?.plan?.currency || 'INR']
  }, [data?.plan?.currency, plans])
  const [selectedCurrency, setSelectedCurrency] = useState('INR')
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0]

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase()
    return plans
      .filter((plan) => plan.currency === activeCurrency)
      .filter((plan) => {
        if (!term) return true
        return `${plan.name} ${plan.code} ${plan.description || ''}`.toLowerCase().includes(term)
      })
  }, [activeCurrency, plans, search])

  const matrixRows = useMemo(() => {
    const rows = new Map<string, PlanEntitlement>()
    visiblePlans.forEach((plan) => {
      ;(plan.entitlements ?? []).forEach((entitlement) => {
        if (matrixFilter === 'limits' && entitlement.kind !== 'limit') return
        if (matrixFilter === 'features' && entitlement.kind !== 'feature') return
        rows.set(entitlement.entitlement_key, entitlement)
      })
    })
    return sortEntitlements(Array.from(rows.values()))
  }, [matrixFilter, visiblePlans])

  const copyLicense = async () => {
    if (!license?.masked_key) return
    await navigator.clipboard.writeText(license.masked_key)
    setCopied(true)
    showToast({
      title: 'Masked identifier copied',
      message: 'Only the masked license identifier was copied.',
      variant: 'success',
    })
    window.setTimeout(() => setCopied(false), 1600)
  }

  const loadRazorpayScript = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const startCheckout = async (planId: number, interval: BillingInterval) => {
    try {
      const session = await createCheckoutSession({
        plan_id: planId,
        billing_interval: interval,
      })
      const metadata = session.metadata as Record<string, any>
      if (session.provider === 'upi_manual') {
        setUpiCheckout({
          paymentId: String(metadata.payment_id),
          amount: String(metadata.amount),
          currency: String(metadata.currency || 'INR'),
          planName: String(metadata.plan_name),
          upiId: String(metadata.upi_id),
          payeeName: String(metadata.payee_name),
          upiUri: String(metadata.upi_uri),
          instructions: String(metadata.instructions || ''),
          isTestMode: Boolean(metadata.is_test_mode),
        })
        return
      }
      if (session.provider !== 'razorpay') {
        throw new Error('The active payment method is not supported by this checkout.')
      }
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        showToast({
          title: 'Checkout unavailable',
          message: 'Unable to load the payment checkout. Please try again.',
          variant: 'error',
        })
        return
      }
      const Razorpay = (window as any).Razorpay
      const checkout = new Razorpay({
        key: metadata.key_id,
        amount: metadata.amount,
        currency: metadata.currency,
        name: 'Purple Retail',
        description: `${metadata.plan_name} ${interval} subscription`,
        order_id: metadata.order_id,
        handler: async (response: any) => {
          await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          showToast({
            title: 'Payment verified',
            message: 'Your subscription is active.',
            variant: 'success',
          })
          await queryClient.invalidateQueries({ queryKey: ['subscription'] })
        },
        theme: { color: '#4f46e5' },
      })
      checkout.open()
    } catch (err) {
      showToast({
        title: 'Unable to start checkout',
        message: getApiErrorMessage(err, 'Unable to start checkout'),
        variant: 'error',
      })
    }
  }

  const submitUpiReference = async (reference: string) => {
    if (!upiCheckout) return false
    try {
      await submitUpiPaymentReference({
        payment_id: upiCheckout.paymentId,
        customer_reference: reference,
      })
      showToast({
        title: 'Payment sent for verification',
        message: 'Your UPI reference was submitted. Your plan will activate after an administrator verifies it.',
        variant: 'success',
      })
      setUpiCheckout(null)
      await queryClient.invalidateQueries({ queryKey: ['subscription'] })
      return true
    } catch (err) {
      showToast({
        title: 'Reference could not be submitted',
        message: getApiErrorMessage(err, 'Check the UTR and try again.'),
        variant: 'error',
      })
      return false
    }
  }

  const faqs = [
    {
      question: 'Can I change or cancel my plan anytime?',
      answer: 'Yes. Plan changes are handled through the billing flow, and your existing business records remain untouched.',
    },
    {
      question: 'What happens when I am over a plan limit?',
      answer: 'Your data stays safe. New creation can be blocked by the backend until usage is reduced, the plan changes, or an admin override is granted.',
    },
    {
      question: 'Which payment methods are supported?',
      answer: 'Checkout uses the payment method selected by the super admin. Razorpay is verified automatically; direct UPI payments are activated after the submitted UTR is reviewed.',
    },
  ]

  return (
    <section className="mx-auto w-full max-w-[1680px] px-4 pb-10 sm:px-6 xl:px-8 2xl:px-10">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-black text-slate-500 dark:bg-slate-900 dark:text-slate-400 sm:w-[410px]">
            <a href="#plans" className="rounded-lg px-3 py-2 text-center text-indigo-700 dark:text-indigo-300">
              Plans
            </a>
            <a href="#usage" className="rounded-lg px-3 py-2 text-center hover:bg-white dark:hover:bg-slate-800">
              Usage
            </a>
            <a href="#matrix" className="rounded-lg px-3 py-2 text-center hover:bg-white dark:hover:bg-slate-800">
              Matrix
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            query.refetch()
            plansQuery.refetch()
          }}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60 dark:shadow-none"
          disabled={query.isFetching || plansQuery.isFetching}
        >
          <RefreshCcw size={16} className={query.isFetching || plansQuery.isFetching ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}
      {query.isPending ? (
        <div className="h-96 animate-pulse rounded-[28px] bg-white dark:bg-slate-900" />
      ) : (
        <div className="space-y-8">
          <header className="rounded-[28px] border border-indigo-100 bg-[#f8f9ff] px-5 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-300">
              <ShieldCheck size={14} />
              Flexible Billing Infrastructure
            </div>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-black tracking-[-0.02em] text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
              Choose the Right Plan for Your Team
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 dark:text-slate-400">
              Plans, limits, licenses, and checkout are managed from the backend, so this page updates automatically as the super admin changes the catalog.
            </p>

            <div className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <div className="grid flex-1 grid-cols-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setBillingInterval('monthly')}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    billingInterval === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval('annual')}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    billingInterval === 'annual'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Yearly Billing
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCurrencyOpen((value) => !value)}
                  className="inline-flex h-12 min-w-[96px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm outline-none transition hover:border-indigo-200 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {activeCurrency}
                  <ChevronDown
                    size={17}
                    className={`text-slate-500 transition ${currencyOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {currencyOpen && (
                  <div className="absolute right-0 z-30 mt-2 min-w-[112px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                    {currencies.map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => {
                          setSelectedCurrency(currency)
                          setCurrencyOpen(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-black transition ${
                          activeCurrency === currency
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {currency}
                        {activeCurrency === currency && <CheckCircle2 size={15} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          <div id="plans" className="space-y-5 scroll-mt-6">
            {visiblePlans.map((plan, index) => {
              const Icon = resourceIcons[index % resourceIcons.length]
              const isCurrent = currentPlanId === plan.id
              const monthly = toNumber(plan.monthly_price)
              const annual = toNumber(plan.annual_price)
              const price = billingInterval === 'annual' ? annual : monthly
              const monthlyEquivalent = billingInterval === 'annual' && annual > 0 ? annual / 12 : monthly
              const isPopular = !isCurrent && index === Math.min(1, Math.max(visiblePlans.length - 1, 0))
              const paid = price > 0

              return (
                <article
                  key={plan.id}
                  className={`relative rounded-[28px] border bg-white p-5 shadow-sm transition dark:bg-slate-900 sm:p-6 ${
                    isPopular
                      ? 'border-indigo-500 shadow-lg shadow-indigo-100 dark:border-indigo-400 dark:shadow-none'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                      Most Popular
                    </div>
                  )}
                  <div className="grid gap-6 lg:grid-cols-[1.15fr_0.72fr_1.55fr] lg:items-center 2xl:grid-cols-[1.1fr_0.65fr_1.95fr]">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          isPopular
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                            : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300'
                        }`}
                      >
                        <Icon size={21} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-slate-950 dark:text-white">{plan.name}</h2>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            {plan.code}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">
                          {plan.description || 'Configurable subscription package for your shop.'}
                        </p>
                      </div>
                    </div>

                    <div className="border-y border-slate-100 py-5 dark:border-slate-800 lg:border-x lg:border-y-0 lg:px-7">
                      {paid ? (
                        <>
                          <div className="flex flex-wrap items-end gap-2">
                            <span className="text-4xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                              {formatCurrency(monthlyEquivalent, plan.currency)}
                            </span>
                            <span className="pb-1 text-sm font-bold text-slate-500 dark:text-slate-400">/ month</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                            {billingInterval === 'annual'
                              ? `Billed annually (${formatCurrency(plan.annual_price, plan.currency)}/yr)`
                              : `Billed monthly (${formatCurrency(plan.monthly_price, plan.currency)}/mo)`}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                            Custom
                          </div>
                          <p className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                            Assigned or managed by your administrator
                          </p>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => startCheckout(plan.id, billingInterval)}
                        disabled={isCurrent || !paid}
                        className={`mt-4 inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                          isCurrent
                            ? 'bg-indigo-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            : paid
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 dark:shadow-none'
                              : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        } disabled:cursor-not-allowed`}
                      >
                        {isCurrent ? (
                          <>
                            <BadgeCheck size={17} />
                            Current Plan
                          </>
                        ) : paid ? (
                          <>
                            <span className="min-w-0 truncate">Choose {plan.name}</span>
                            <ArrowRight size={17} className="shrink-0" />
                          </>
                        ) : (
                          <>
                            <Mail size={17} />
                            Contact Admin
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {planHighlights(plan).map((highlight) => (
                        <div key={highlight.label} className="flex gap-3 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
                          <CheckCircle2
                            size={18}
                            className={highlight.enabled ? 'mt-0.5 shrink-0 text-indigo-600' : 'mt-0.5 shrink-0 text-slate-300'}
                          />
                          <span className={!highlight.enabled ? 'text-slate-400 line-through' : undefined}>
                            {highlight.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}

            {!visiblePlans.length && (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="text-lg font-black text-slate-900 dark:text-white">No plans found</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Try another search term or currency.
                </p>
              </div>
            )}
          </div>

          {data && (
            <div id="usage" className="grid scroll-mt-6 gap-6 xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px]">
              <div className="rounded-[28px] border border-slate-200 bg-[#f8f9ff] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950 dark:text-white">Usage & Limits</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                      Backend-measured usage against your effective entitlements.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                    {data.access_allowed ? 'Access active' : data.access_code || 'Restricted'}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {data.limits.map((limit) => (
                    <UsageMeter key={limit.key} limit={limit} />
                  ))}
                  {!data.limits.length && (
                    <div className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      No quantitative limits are configured for this subscription.
                    </div>
                  )}
                </div>
              </div>

              <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <KeyRound size={22} />
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">License</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  Your license is masked here. The secret is never displayed in full from this page.
                </p>
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">License Key</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-lg font-black text-slate-950 dark:text-white">
                      {license?.masked_key || '-'}
                    </p>
                    <button
                      type="button"
                      onClick={copyLicense}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      title="Copy masked license identifier"
                      aria-label="Copy masked license identifier"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {copied ? 'Copied masked identifier' : license?.status?.replaceAll('_', ' ') || 'No license'}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="font-black text-slate-900 dark:text-white">{data.plan?.name || 'No plan'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Current plan</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="font-black capitalize text-slate-900 dark:text-white">
                      {data.subscription?.billing_interval || '-'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Billing</p>
                  </div>
                </div>
              </aside>
            </div>
          )}

          <section id="matrix" className="scroll-mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Detailed Feature Matrix</h2>
                <p className="mt-1 max-w-xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">
                  Compare limits and feature availability from the live plan catalog.
                </p>
              </div>
              <div className="grid rounded-xl bg-slate-100 p-1 text-sm font-black text-slate-500 dark:bg-slate-800 sm:grid-cols-3">
                {(['all', 'limits', 'features'] as MatrixFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setMatrixFilter(filter)}
                    className={`rounded-lg px-4 py-2 capitalize transition ${
                      matrixFilter === filter
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                        : 'hover:bg-white/70 dark:hover:bg-slate-900/70'
                    }`}
                  >
                    {filter === 'all' ? 'All Capabilities' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                    <th className="px-4 py-4 font-black text-slate-700 dark:text-slate-200">Capability</th>
                    {visiblePlans.map((plan) => (
                      <th key={plan.id} className="px-4 py-4 font-black text-slate-700 dark:text-slate-200">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row.entitlement_key} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200">
                        {row.kind === 'limit' ? limitLabel(row) : featureLabel(row)}
                      </td>
                      {visiblePlans.map((plan) => {
                        const entitlement = (plan.entitlements ?? []).find(
                          (item) => item.entitlement_key === row.entitlement_key
                        )
                        return (
                          <td key={plan.id} className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-300">
                            {!entitlement ? (
                              <span className="text-slate-300">-</span>
                            ) : entitlement.kind === 'feature' ? (
                              entitlement.feature_enabled ? (
                                <CheckCircle2 size={18} className="text-indigo-600" />
                              ) : (
                                <span className="text-slate-300">-</span>
                              )
                            ) : (
                              formatEntitlementValue(entitlement)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {!matrixRows.length && (
                    <tr>
                      <td colSpan={visiblePlans.length + 1} className="px-4 py-10 text-center font-semibold text-slate-500">
                        No entitlement rows are configured for the visible plans.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.62fr] 2xl:grid-cols-[1fr_0.52fr]">
            <div>
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">Frequently Asked Questions</h2>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                Clear answers about plans, limits, and billing management.
              </p>
              <div className="mt-5 space-y-3">
                {faqs.map((faq, index) => (
                  <button
                    key={faq.question}
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span className="font-black text-slate-800 dark:text-slate-100">{faq.question}</span>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`}
                      />
                    </span>
                    {openFaq === index && (
                      <span className="mt-3 block text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">
                        {faq.answer}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-[28px] bg-indigo-600 p-7 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Zap size={22} />
              </div>
              <h2 className="mt-5 text-2xl font-black">Need a tailored subscription?</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-indigo-50">
                Talk to your administrator about special limits, custom entitlements, or enterprise payment arrangements.
              </p>
              <button
                type="button"
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-indigo-700 transition hover:bg-indigo-50"
              >
                <CalendarDays size={17} />
                Request Consultation
              </button>
            </aside>
          </section>
        </div>
      )}
      {upiCheckout && (
        <UpiPaymentModal
          checkout={upiCheckout}
          onClose={() => setUpiCheckout(null)}
          onSubmit={submitUpiReference}
          onCopied={(label) =>
            showToast({ title: `${label} copied`, message: `${label} copied to clipboard.`, variant: 'success' })
          }
        />
      )}
    </section>
  )
}

function UpiPaymentModal({
  checkout,
  onClose,
  onSubmit,
  onCopied,
}: {
  checkout: UpiCheckout
  onClose: () => void
  onSubmit: (reference: string) => Promise<boolean>
  onCopied: (label: string) => void
}) {
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, submitting])

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    onCopied(label)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={() => !submitting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upi-payment-title"
        className="max-h-[96vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-[28px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Direct UPI payment</p>
              <h2 id="upi-payment-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white sm:text-2xl">Pay for {checkout.planName}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Scan, pay the exact amount, then submit your UTR.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close payment window" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[0.82fr_1.18fr]">
          <div className="flex flex-col items-center justify-center bg-indigo-50 p-6 text-center dark:bg-indigo-950/30 sm:p-8">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={checkout.upiUri} size={190} level="M" includeMargin={false} />
            </div>
            <p className="mt-5 text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
              {formatCurrency(checkout.amount, checkout.currency)}
            </p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Exact payable amount</p>
            <a href={checkout.upiUri} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 md:hidden">
              Open UPI app
              <ExternalLink size={15} />
            </a>
          </div>

          <form
            className="space-y-5 p-5 sm:p-7"
            onSubmit={async (event) => {
              event.preventDefault()
              setSubmitting(true)
              try {
                await onSubmit(reference)
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {checkout.isTestMode && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                This payment account is marked as test mode. Confirm with your administrator before sending money.
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Payee</p>
              <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{checkout.payeeName}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">UPI ID</p>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-black text-slate-900 dark:text-white">{checkout.upiId}</span>
                <button type="button" onClick={() => copy(checkout.upiId, 'UPI ID')} title="Copy UPI ID" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm dark:bg-slate-900">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">{checkout.instructions}</p>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">UPI transaction reference / UTR</span>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase().replace(/\s/g, ''))}
                minLength={6}
                maxLength={100}
                pattern="[A-Za-z0-9]+"
                placeholder="Example: 123456789012"
                autoComplete="off"
                required
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm font-black text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">Find this reference in your UPI app's completed transaction details.</span>
            </label>
            <button disabled={submitting || reference.length < 6} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none">
              <ShieldCheck size={17} />
              {submitting ? 'Submitting reference...' : 'I have paid - submit UTR'}
            </button>
            <p className="text-center text-[11px] font-semibold leading-5 text-slate-400">Submitting a UTR does not activate the plan immediately. It must match the receiving account record.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
