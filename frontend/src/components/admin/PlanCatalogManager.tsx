import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  RefreshCcw,
  Rocket,
  X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

import { getPlanCatalogVersions, publishPlanCatalogVersion } from '../../features/admin/api'
import type {
  EntitlementDefinition,
  Plan,
  PlanCatalogPublishPayload,
  PlanCatalogVersion,
} from '../../features/admin/types'
import { getApiErrorMessage } from '../../lib/api-error'
import { useToast } from '../ui/ToastProvider'

type DraftEntitlement = {
  limitValue: string
  isUnlimited: boolean | null
  featureEnabled: boolean | null
}

type CatalogDraft = {
  planId: number
  baseVersionNumber: number
  monthlyPrice: string
  annualPrice: string
  currency: string
  trialDays: string
  gracePeriodDays: string
  entitlements: Record<number, DraftEntitlement>
}

type ValidationErrors = Record<string, string>

function draftFrom(
  version: PlanCatalogVersion | undefined,
  plan: Plan,
  definitions: EntitlementDefinition[],
): CatalogDraft {
  const snapshots = new Map(
    (version?.entitlement_snapshots ?? []).map((snapshot) => [snapshot.entitlement_id, snapshot]),
  )
  return {
    planId: plan.id,
    baseVersionNumber: version?.version_number ?? 0,
    monthlyPrice: String(version?.monthly_price ?? plan.monthly_price ?? '0'),
    annualPrice: String(version?.annual_price ?? plan.annual_price ?? '0'),
    currency: String(version?.currency ?? plan.currency ?? 'INR').toUpperCase(),
    trialDays: String(version?.trial_days ?? plan.trial_days ?? 0),
    gracePeriodDays: String(version?.grace_period_days ?? plan.grace_period_days ?? 0),
    entitlements: Object.fromEntries(
      definitions
        .filter((definition) => definition.is_active)
        .map((definition) => {
          const snapshot = snapshots.get(definition.id)
          return [
            definition.id,
            {
              limitValue: snapshot ? String(snapshot.limit_value ?? '') : '',
              isUnlimited: snapshot ? Boolean(snapshot.is_unlimited) : null,
              featureEnabled:
                snapshot?.feature_enabled == null ? null : Boolean(snapshot.feature_enabled),
            },
          ]
        }),
    ),
  }
}

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatPublishedAt(value?: string | null) {
  if (!value) return 'Publication time unavailable'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function snapshotValue(version: PlanCatalogVersion | undefined, definition: EntitlementDefinition) {
  const snapshot = version?.entitlement_snapshots.find(
    (item) => item.entitlement_id === definition.id,
  )
  if (!snapshot) return 'Not configured'
  if (definition.kind === 'feature') return snapshot.feature_enabled ? 'Enabled' : 'Disabled'
  if (snapshot.is_unlimited) return 'Unlimited'
  return String(snapshot.limit_value ?? '0')
}

function draftValue(draft: CatalogDraft, definition: EntitlementDefinition) {
  const value = draft.entitlements[definition.id]
  if (!value) return 'Not configured'
  if (definition.kind === 'feature') {
    if (value.featureEnabled == null) return 'Not configured'
    return value.featureEnabled ? 'Enabled' : 'Disabled'
  }
  if (value.isUnlimited == null) return 'Not configured'
  if (value.isUnlimited) return 'Unlimited'
  return value.limitValue || 'Not configured'
}

function validateDraft(draft: CatalogDraft, definitions: EntitlementDefinition[]) {
  const errors: ValidationErrors = {}
  const validateNonNegative = (key: string, value: string, label: string) => {
    if (value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
      errors[key] = `${label} must be a nonnegative number.`
    }
  }
  validateNonNegative('monthlyPrice', draft.monthlyPrice, 'Monthly price')
  validateNonNegative('annualPrice', draft.annualPrice, 'Annual price')
  if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
    errors.currency = 'Currency must be a three-letter code.'
  }
  for (const [key, value, label] of [
    ['trialDays', draft.trialDays, 'Trial days'],
    ['gracePeriodDays', draft.gracePeriodDays, 'Grace days'],
  ]) {
    if (!/^\d+$/.test(value)) errors[key] = `${label} must be a nonnegative whole number.`
  }
  for (const definition of definitions.filter((item) => item.is_active)) {
    const configured = draft.entitlements[definition.id]
    if (!configured) {
      errors[`entitlement-${definition.id}`] = `${definition.name} is required.`
      continue
    }
    if (definition.kind === 'feature') {
      if (configured.featureEnabled == null) {
        errors[`entitlement-${definition.id}`] = 'Choose Enabled or Disabled.'
      }
      continue
    }
    if (configured.isUnlimited == null) {
      errors[`entitlement-${definition.id}`] = 'Enter a limit or select Unlimited.'
      continue
    }
    if (!configured.isUnlimited) {
      const numeric = Number(configured.limitValue)
      if (configured.limitValue.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
        errors[`entitlement-${definition.id}`] = 'Enter a nonnegative limit or select Unlimited.'
      } else if (definition.value_type === 'integer' && !Number.isInteger(numeric)) {
        errors[`entitlement-${definition.id}`] = 'This limit must be a whole number.'
      }
    }
  }
  return errors
}

function toPayload(
  draft: CatalogDraft,
  definitions: EntitlementDefinition[],
): PlanCatalogPublishPayload {
  return {
    expected_latest_version_number: draft.baseVersionNumber,
    monthly_price: draft.monthlyPrice,
    annual_price: draft.annualPrice,
    currency: draft.currency.trim().toUpperCase(),
    trial_days: Number(draft.trialDays),
    grace_period_days: Number(draft.gracePeriodDays),
    entitlements: definitions
      .filter((definition) => definition.is_active)
      .map((definition) => {
        const value = draft.entitlements[definition.id]
        if (!value) throw new Error(`${definition.name} is not configured.`)
        if (definition.kind === 'feature' && value.featureEnabled == null) {
          throw new Error(`${definition.name} is not configured.`)
        }
        if (definition.kind === 'limit' && value.isUnlimited == null) {
          throw new Error(`${definition.name} is not configured.`)
        }
        return {
          entitlement_id: definition.id,
          limit_value:
            definition.kind === 'limit' && !value.isUnlimited ? value.limitValue : null,
          is_unlimited: definition.kind === 'limit' && value.isUnlimited === true,
          feature_enabled: definition.kind === 'feature' ? value.featureEnabled : null,
        }
      }),
  }
}

export function PlanCatalogManager({
  plans,
  definitions,
  loading,
}: {
  plans: Plan[]
  definitions: EntitlementDefinition[]
  loading: boolean
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [mode, setMode] = useState<'history' | 'draft'>('history')
  const [draft, setDraft] = useState<CatalogDraft | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publicationError, setPublicationError] = useState('')
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const draftPlanIdRef = useRef<number | null>(null)

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]
  const versionsQuery = useQuery({
    queryKey: ['admin', 'plan-catalog-versions', selectedPlan?.id],
    queryFn: () => getPlanCatalogVersions(selectedPlan.id),
    enabled: Boolean(selectedPlan),
  })
  const versions = versionsQuery.data ?? []
  const latestVersion = versions[0]
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? latestVersion

  useEffect(() => {
    if (!selectedPlanId && plans[0]) setSelectedPlanId(plans[0].id)
  }, [plans, selectedPlanId])

  const definitionIdentity = useMemo(
    () => definitions.map((item) => `${item.id}:${item.is_active}`).join('|'),
    [definitions],
  )

  useEffect(() => {
    if (!selectedPlan || !latestVersion) return
    const planChanged = draftPlanIdRef.current !== selectedPlan.id
    setSelectedVersionId(latestVersion.id)
    if (planChanged) {
      draftPlanIdRef.current = selectedPlan.id
      setDraft(draftFrom(latestVersion, selectedPlan, definitions))
      setErrors({})
      setPublicationError('')
      return
    }
    setDraft((current) => {
      if (!current) return draftFrom(latestVersion, selectedPlan, definitions)
      const fallback = draftFrom(latestVersion, selectedPlan, definitions)
      return {
        ...current,
        entitlements: Object.fromEntries(
          definitions
            .filter((definition) => definition.is_active)
            .map((definition) => [
              definition.id,
              current.entitlements[definition.id] ?? fallback.entitlements[definition.id],
            ]),
        ),
      }
    })
  }, [definitionIdentity, definitions, latestVersion, selectedPlan])

  const draftIsStale = Boolean(
    draft && latestVersion && draft.baseVersionNumber !== latestVersion.version_number,
  )

  const changedItems = useMemo(() => {
    if (!draft || !latestVersion) return []
    const items: Array<{ label: string; before: string; after: string; tone: string }> = []
    const add = (label: string, before: string, after: string, tone = 'changed') => {
      if (before !== after) items.push({ label, before, after, tone })
    }
    add('Monthly price', String(latestVersion.monthly_price), draft.monthlyPrice)
    add('Annual price', String(latestVersion.annual_price), draft.annualPrice)
    add('Currency', latestVersion.currency, draft.currency.trim().toUpperCase())
    add('Trial days', String(latestVersion.trial_days), draft.trialDays)
    add('Grace period', String(latestVersion.grace_period_days), draft.gracePeriodDays)
    for (const definition of definitions.filter((item) => item.is_active)) {
      const before = snapshotValue(latestVersion, definition)
      const after = draftValue(draft, definition)
      const tone =
        definition.kind === 'limit' && before !== 'Unlimited' && after !== 'Unlimited'
          ? Number(after) < Number(before)
            ? 'reduced'
            : 'increased'
          : 'changed'
      add(definition.name, before, after, tone)
    }
    return items
  }, [definitions, draft, latestVersion])

  const publishMutation = useMutation({
    mutationFn: (payload: PlanCatalogPublishPayload) =>
      publishPlanCatalogVersion(selectedPlan.id, payload),
    onSuccess: async (published) => {
      setConfirmOpen(false)
      setPublicationError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'plan-catalog-versions', selectedPlan.id],
        }),
      ])
      setSelectedVersionId(published.id)
      draftPlanIdRef.current = selectedPlan.id
      setDraft(draftFrom(published, selectedPlan, definitions))
      setMode('history')
      showToast({
        title: `Version ${published.version_number} published`,
        message: 'The immutable catalog version is now available for new commercial agreements.',
        variant: 'success',
      })
    },
    onError: async (error) => {
      const message = getApiErrorMessage(error)
      setConfirmOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'plan-catalog-versions', selectedPlan.id],
      })
      setPublicationError(message)
    },
  })

  const updateDraft = (patch: Partial<CatalogDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setErrors({})
    setPublicationError('')
  }

  const updateEntitlement = (id: number, patch: Partial<DraftEntitlement>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            entitlements: {
              ...current.entitlements,
              [id]: { ...current.entitlements[id], ...patch },
            },
          }
        : current,
    )
    setErrors({})
    setPublicationError('')
  }

  const openPreview = () => {
    if (!draft || !latestVersion) return
    if (draftIsStale) {
      setPublicationError('A newer catalog version exists. Review it, then explicitly rebase or reset this draft before publishing.')
      return
    }
    const nextErrors = validateDraft(draft, definitions)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!changedItems.length) {
      setPublicationError('Change at least one catalog value before publishing.')
      return
    }
    setConfirmOpen(true)
  }

  const resetDraftToLatest = () => {
    if (!latestVersion) return
    setDraft(draftFrom(latestVersion, selectedPlan, definitions))
    setErrors({})
    setPublicationError('')
  }

  const rebaseDraft = () => {
    if (!draft || !latestVersion) return
    setDraft({ ...draft, baseVersionNumber: latestVersion.version_number })
    setConfirmOpen(false)
    setPublicationError('Draft rebased onto the latest catalog. Review every change and confirm publication again.')
  }

  const confirmPublication = () => {
    if (!draft) return
    const nextErrors = validateDraft(draft, definitions)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setConfirmOpen(false)
      setPublicationError('Complete every active entitlement before publishing.')
      return
    }
    publishMutation.mutate(toPayload(draft, definitions))
  }

  if (loading) {
    return (
      <section className="border-y border-slate-200 bg-white px-4 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <LoaderCircle className="mx-auto animate-spin text-teal-600" size={26} />
        <p className="mt-3 text-sm font-semibold text-slate-500">Loading catalog controls...</p>
      </section>
    )
  }

  if (!selectedPlan) {
    return (
      <section className="border-y border-slate-200 bg-white px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="font-bold text-slate-800 dark:text-slate-100">No plans are available.</p>
        <p className="mt-1 text-sm text-slate-500">Create a plan to publish its first catalog version.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="catalog-manager-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-[#fffdf7] px-4 py-5 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-teal-700 dark:text-teal-300">
            <LockKeyhole size={14} /> Immutable catalog
          </div>
          <h2 id="catalog-manager-title" className="mt-1 text-xl font-black text-[#10243e] dark:text-white sm:text-2xl">
            Plan catalog versions
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Review contract history and publish complete pricing and entitlement snapshots.
          </p>
        </div>
        <label className="block w-full lg:w-72">
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Plan</span>
          <select
            aria-label="Catalog plan"
            value={selectedPlan.id}
            onChange={(event) => {
              setSelectedPlanId(Number(event.target.value))
              setMode('history')
              setPublicationError('')
            }}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 sm:grid-cols-4 lg:grid-cols-8">
        <Summary label="Status" value={selectedPlan.is_archived ? 'Archived' : selectedPlan.is_active ? 'Active' : 'Inactive'} />
        <Summary label="Current version" value={latestVersion ? `v${latestVersion.version_number}` : 'None'} />
        <Summary label="Monthly" value={formatMoney(latestVersion?.monthly_price ?? selectedPlan.monthly_price, latestVersion?.currency ?? selectedPlan.currency)} />
        <Summary label="Annual" value={formatMoney(latestVersion?.annual_price ?? selectedPlan.annual_price, latestVersion?.currency ?? selectedPlan.currency)} />
        <Summary label="Currency" value={latestVersion?.currency ?? selectedPlan.currency} />
        <Summary label="Trial" value={`${latestVersion?.trial_days ?? selectedPlan.trial_days} days`} />
        <Summary label="Grace" value={`${latestVersion?.grace_period_days ?? selectedPlan.grace_period_days} days`} />
        <Summary label="Publication" value={latestVersion?.status ?? 'Unavailable'} />
      </div>

      <div className="grid min-h-[570px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-500">Version history</p>
            <button type="button" onClick={() => versionsQuery.refetch()} title="Refresh version history" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:hover:bg-slate-800">
              <RefreshCcw size={15} className={versionsQuery.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
          {versionsQuery.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{getApiErrorMessage(versionsQuery.error)}</p>}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[500px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {versions.map((version, index) => (
              <button
                key={version.id}
                type="button"
                onClick={() => { setSelectedVersionId(version.id); setMode('history') }}
                className={`min-w-48 rounded-lg border px-3 py-3 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 lg:min-w-0 ${selectedVersion?.id === version.id && mode === 'history' ? 'border-teal-600 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100' : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:text-slate-200'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-black">Version {version.version_number}</span>
                  {index === 0 && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">CURRENT</span>}
                </span>
                <span className="mt-1 block text-xs text-slate-500">{formatPublishedAt(version.published_at)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Catalog view">
            <Tab active={mode === 'history'} onClick={() => setMode('history')} icon={<History size={16} />} label="Published details" />
            <Tab active={mode === 'draft'} onClick={() => setMode('draft')} icon={<PencilLine size={16} />} label="Prepare next version" />
          </div>
          {versionsQuery.isLoading ? (
            <div className="flex min-h-96 items-center justify-center"><LoaderCircle className="animate-spin text-teal-600" /></div>
          ) : !latestVersion ? (
            <div className="p-6 text-sm text-slate-600">No published version was returned for this plan.</div>
          ) : mode === 'history' && selectedVersion ? (
            <VersionDetails version={selectedVersion} />
          ) : draft ? (
            <div className="p-4 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-orange-700 dark:text-orange-300">Draft based on version {draft.baseVersionNumber}</p>
                  <h3 className="mt-1 text-lg font-black text-[#10243e] dark:text-white">Proposed version {latestVersion.version_number + 1}</h3>
                  <p className="mt-1 text-sm text-slate-500">Draft changes remain in this browser until you confirm publication.</p>
                </div>
                <button type="button" onClick={resetDraftToLatest} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:text-slate-200">
                  <RefreshCcw size={15} /> Reset to latest
                </button>
              </div>

              {draftIsStale && (
                <div role="alert" className="mb-5 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
                  <p className="font-black">Version {latestVersion.version_number} was published while this draft was open.</p>
                  <p className="mt-1">Your entries are preserved. Review the latest version, then rebase this draft or reset it before publishing.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setSelectedVersionId(latestVersion.id); setMode('history') }} className="h-10 rounded-lg border border-orange-300 px-3 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500">Review latest</button>
                    <button type="button" onClick={rebaseDraft} className="h-10 rounded-lg bg-orange-700 px-3 font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">Rebase preserved draft</button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <CatalogInput label="Monthly price" value={draft.monthlyPrice} onChange={(monthlyPrice) => updateDraft({ monthlyPrice })} error={errors.monthlyPrice} type="number" />
                <CatalogInput label="Annual price" value={draft.annualPrice} onChange={(annualPrice) => updateDraft({ annualPrice })} error={errors.annualPrice} type="number" />
                <CatalogInput label="Currency" value={draft.currency} onChange={(currency) => updateDraft({ currency })} error={errors.currency} maxLength={3} />
                <CatalogInput label="Trial days" value={draft.trialDays} onChange={(trialDays) => updateDraft({ trialDays })} error={errors.trialDays} type="number" />
                <CatalogInput label="Grace days" value={draft.gracePeriodDays} onChange={(gracePeriodDays) => updateDraft({ gracePeriodDays })} error={errors.gracePeriodDays} type="number" />
              </div>

              <div className="mt-7 grid gap-x-6 gap-y-4 xl:grid-cols-2">
                {definitions.filter((item) => item.is_active).map((definition) => {
                  const value = draft.entitlements[definition.id]
                  const error = errors[`entitlement-${definition.id}`]
                  return (
                    <div key={definition.id} className="border-t border-slate-200 pt-4 dark:border-slate-800">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white">{definition.name}</p>
                          <p className="truncate font-mono text-xs text-slate-500">{definition.key}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{definition.kind}</span>
                      </div>
                      {definition.kind === 'feature' ? (
                        <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 dark:bg-slate-950">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Available in this version</span>
                          <select aria-label={`${definition.name} availability`} aria-invalid={Boolean(error)} aria-describedby={error ? `entitlement-error-${definition.id}` : undefined} value={value?.featureEnabled == null ? '' : String(value.featureEnabled)} onChange={(event) => updateEntitlement(definition.id, { featureEnabled: event.target.value === '' ? null : event.target.value === 'true' })} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-900">
                            <option value="">Choose...</option>
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        </label>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input aria-label={`${definition.name} limit`} aria-invalid={Boolean(error)} aria-describedby={error ? `entitlement-error-${definition.id}` : undefined} type="number" min="0" step={definition.value_type === 'integer' ? '1' : 'any'} disabled={value?.isUnlimited === true} value={value?.limitValue ?? ''} onChange={(event) => updateEntitlement(definition.id, { limitValue: event.target.value, isUnlimited: false })} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800" />
                          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-800">
                            <input aria-label={`${definition.name} unlimited`} type="checkbox" checked={value?.isUnlimited === true} onChange={(event) => updateEntitlement(definition.id, { isUnlimited: event.target.checked })} className="h-4 w-4 accent-teal-700" /> Unlimited
                          </label>
                        </div>
                      )}
                      {error && <p id={`entitlement-error-${definition.id}`} role="alert" className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
                    </div>
                  )
                })}
              </div>

              <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{changedItems.length} proposed change{changedItems.length === 1 ? '' : 's'}</p>
                  <p className="text-xs text-slate-500">Existing subscriptions remain bound to their contracted versions.</p>
                </div>
                <button ref={reviewButtonRef} type="button" onClick={openPreview} disabled={draftIsStale} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-black text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Eye size={16} /> Review publication
                </button>
              </div>
              {publicationError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{publicationError}</p>}
            </div>
          ) : null}
        </div>
      </div>

      {confirmOpen && draft && latestVersion && (
        <PublicationDialog
          plan={selectedPlan}
          nextVersion={latestVersion.version_number + 1}
          changes={changedItems}
          error={publicationError}
          pending={publishMutation.isPending}
          returnFocusRef={reviewButtonRef}
          onClose={() => !publishMutation.isPending && setConfirmOpen(false)}
          onConfirm={confirmPublication}
        />
      )}
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-r border-t border-slate-100 px-3 py-3 first:border-t-0 dark:border-slate-800 sm:px-4"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-black capitalize text-slate-800 dark:text-slate-100" title={value}>{value}</p></div>
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 ${active ? 'border-teal-700 text-teal-800 dark:text-teal-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{icon}{label}</button>
}

function VersionDetails({ version }: { version: PlanCatalogVersion }) {
  return <div className="p-4 sm:p-6">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Published contract</p><h3 className="mt-1 text-xl font-black text-[#10243e] dark:text-white">Version {version.version_number}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Clock3 size={14} />{formatPublishedAt(version.published_at)}</p></div>
      <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"><CheckCircle2 size={16} /> Immutable and published</div>
    </div>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-3 xl:grid-cols-6">
      <Detail label="Monthly" value={formatMoney(version.monthly_price, version.currency)} />
      <Detail label="Annual" value={formatMoney(version.annual_price, version.currency)} />
      <Detail label="Currency" value={version.currency} />
      <Detail label="Trial" value={`${version.trial_days} days`} />
      <Detail label="Grace" value={`${version.grace_period_days} days`} />
      <Detail label="Published by" value={version.published_by_user_id ? `User #${version.published_by_user_id}` : 'System migration'} />
    </dl>
    <h4 className="border-t border-slate-200 pt-5 text-sm font-black text-slate-900 dark:border-slate-800 dark:text-white">Entitlement snapshot</h4>
    <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
      {version.entitlement_snapshots.map((snapshot) => <div key={snapshot.id} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{snapshot.entitlement_name}</p><p className="truncate font-mono text-xs text-slate-500">{snapshot.entitlement_key}</p></div><span className="shrink-0 text-sm font-black text-[#10243e] dark:text-white">{snapshot.kind === 'feature' ? snapshot.feature_enabled ? 'Enabled' : 'Disabled' : snapshot.is_unlimited ? 'Unlimited' : String(snapshot.limit_value ?? '0')}</span></div>)}
      {!version.entitlement_snapshots.length && <p className="py-5 text-sm text-slate-500">This historical version has no entitlement snapshot rows.</p>}
    </div>
  </div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{value}</dd></div>
}

function CatalogInput({ label, value, onChange, error, type = 'text', maxLength }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; maxLength?: number }) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  return <label className="block" htmlFor={inputId}><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span><input id={inputId} type={type} min={type === 'number' ? '0' : undefined} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold outline-none focus:ring-2 dark:bg-slate-950 ${error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-teal-600 focus:ring-teal-100 dark:border-slate-700'}`} />{error && <span id={errorId} role="alert" className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}</label>
}

function PublicationDialog({ plan, nextVersion, changes, error, pending, returnFocusRef, onClose, onConfirm }: { plan: Plan; nextVersion: number; changes: Array<{ label: string; before: string; after: string; tone: string }>; error: string; pending: boolean; returnFocusRef: RefObject<HTMLButtonElement | null>; onClose: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const pendingRef = useRef(pending)
  closeRef.current = onClose
  pendingRef.current = pending
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!focusable.length) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      returnFocusRef.current?.focus()
    }
  }, [returnFocusRef])
  return <div className="fixed inset-0 z-[180] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="publication-dialog-title" aria-describedby="publication-dialog-description" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg bg-white shadow-2xl dark:bg-slate-900 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6"><div><p className="text-xs font-bold uppercase text-orange-700">Final review</p><h2 id="publication-dialog-title" className="mt-1 text-xl font-black text-[#10243e] dark:text-white">Publish {plan.name} version {nextVersion}</h2></div><button type="button" onClick={onClose} disabled={pending} aria-label="Close publication review" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:hover:bg-slate-800"><X size={19} /></button></div>
      <div className="overflow-y-auto px-4 py-4 sm:px-6">
        <div id="publication-dialog-description" className="mb-4 flex gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><p>Publication is permanent. Existing subscriptions keep their contracted catalog versions and will not be repriced automatically.</p></div>
        <div className="divide-y divide-slate-100 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">{changes.map((change) => <div key={change.label} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-3 text-sm"><div className="min-w-0"><p className="truncate font-bold text-slate-800 dark:text-slate-100">{change.label}</p><p className="truncate text-xs text-slate-500">{change.before}</p></div><ArrowRight className="text-slate-400" size={15} /><div className="min-w-0 text-right"><span className={`inline-flex max-w-full truncate rounded-full px-2 py-1 text-xs font-bold ${change.tone === 'reduced' ? 'bg-orange-100 text-orange-800' : change.tone === 'increased' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'}`}>{change.after}</span></div></div>)}</div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-6"><button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-black text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={17} /> : <Rocket size={17} />}{pending ? 'Publishing...' : `Publish version ${nextVersion}`}</button></div>
    </div>
  </div>
}
