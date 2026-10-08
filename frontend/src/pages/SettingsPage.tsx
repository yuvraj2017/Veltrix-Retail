import {
  Bell,
  ChevronRight,
  Globe2,
  LockKeyhole,
  MoonStar,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  SunMedium,
  UserCog2,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../features/staff/constants'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../components/ui/ToastProvider'
import { changeMyPassword, getMyProfile, updateMyProfile } from '../features/profile/api'
import type { Profile } from '../features/profile/types'
import { getShopSettings, updateShopSettings } from '../features/settings/api'
import {
  defaultNotificationPreferences,
  defaultWorkspacePreferences,
  loadNotificationPreferences,
  loadWorkspacePreferences,
  saveNotificationPreferences,
  saveWorkspacePreferences,
} from '../features/settings/storage'
import type {
  NotificationPreferences,
  ShopSettings,
  UpdateShopPayload,
  WorkspacePreferences,
} from '../features/settings/types'
import { getApiErrorMessage } from '../lib/api-error'
import { useBranch } from '../context/BranchContext'

const languageOptions = ['English (US)', 'English (UK)', 'Hindi', 'French']
const timezoneOptions = [
  '(GMT+05:30) India Standard Time',
  '(GMT-05:00) Eastern Time',
  '(GMT+00:00) Coordinated Universal Time',
  '(GMT+01:00) Central European Time',
]
const reportPeriodOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const

type BannerState = {
  error: string
  success: string
}

function splitFullName(fullName: string) {
  const safe = fullName.trim()
  if (!safe) return { firstName: '', lastName: '' }

  const parts = safe.split(' ')
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[] | string[]
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
      >
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
      />
    </label>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/80">
      <div>
        <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  )
}

function Banner({ state }: { state: BannerState }) {
  if (!state.error && !state.success) return null

  return (
    <div
      className={`rounded-[1.15rem] px-4 py-3 text-sm font-semibold ${
        state.error
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
      }`}
    >
      {state.error || state.success}
    </div>
  )
}

export default function SettingsPage() {
  const { user, refreshMe, hasPermission } = useAuth()
  const { selectedBranchId } = useBranch()
  const canManageSettings = hasPermission(PERMISSIONS.settingsManage)
  const { darkMode, setDarkMode } = useTheme()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [shop, setShop] = useState<ShopSettings | null>(null)

  const [shopForm, setShopForm] = useState<UpdateShopPayload>({
    name: '',
    category: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    address: '',
    logo_url: '',
    gst_enabled: false,
    gstin: '',
    state: '',
    gst_state_code: '',
  })
  const [accountForm, setAccountForm] = useState({
    full_name: '',
    phone: '',
    profile_image_url: '',
    language: 'English (US)',
    timezone: '(GMT+05:30) India Standard Time',
    two_factor_enabled: false,
  })
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(
    defaultWorkspacePreferences,
  )
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(defaultNotificationPreferences)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [storeBanner, setStoreBanner] = useState<BannerState>({ error: '', success: '' })

  const [savingStore, setSavingStore] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!selectedBranchId) return

    let cancelled = false

    const loadSettings = async () => {
      try {
        setLoading(true)
        const [profileData, shopData] = await Promise.all([
          getMyProfile(),
          getShopSettings(selectedBranchId),
        ])

        if (cancelled) return

        setProfile(profileData)
        setShop(shopData)
        setShopForm({
          name: shopData.name,
          category: shopData.category,
          email: shopData.email,
          phone: shopData.phone,
          whatsapp_number: shopData.whatsapp_number || '',
          address: shopData.address || '',
          logo_url: shopData.logo_url || '',
          gst_enabled: Boolean(shopData.gst_enabled),
          gstin: shopData.gstin || '',
          state: shopData.state || '',
          gst_state_code: shopData.gst_state_code || '',
        })
        setAccountForm({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          profile_image_url: profileData.profile_image_url || '',
          language: profileData.language || 'English (US)',
          timezone: profileData.timezone || '(GMT+05:30) India Standard Time',
          two_factor_enabled: Boolean(profileData.two_factor_enabled),
        })
        setWorkspacePreferences(loadWorkspacePreferences())
        setNotificationPreferences(loadNotificationPreferences())
      } catch (error) {
        if (!cancelled) {
          const message = getApiErrorMessage(error, 'Unable to load settings')
          setStoreBanner({ error: message, success: '' })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSettings()
    return () => {
      cancelled = true
    }
  }, [selectedBranchId])

  const blueprintCards = useMemo(
    () => [
      { title: 'Business Identity', note: 'Store profile and contact channels', status: 'Live' },
      { title: 'Account & Security', note: 'Owner profile and security', status: 'Live' },
      { title: 'Workspace Controls', note: 'Theme and report defaults', status: 'Live' },
      { title: 'Billing Automation', note: 'Invoice rules and reminders', status: 'Next' },
    ],
    [],
  )

  const handleSaveStore = async () => {
    if (!selectedBranchId) return

    try {
      setSavingStore(true)
      setStoreBanner({ error: '', success: '' })
      const updated = await updateShopSettings(selectedBranchId, {
        ...shopForm,
        whatsapp_number: shopForm.whatsapp_number || null,
        address: shopForm.address || null,
        logo_url: shopForm.logo_url || null,
        gst_enabled: Boolean(shopForm.gst_enabled),
        gstin: shopForm.gstin || null,
        state: shopForm.state || null,
        gst_state_code: shopForm.gst_state_code || null,
      })
      setShop(updated)
      showToast({
        title: 'Store updated',
        message: 'Store identity updated successfully.',
        variant: 'success',
      })
      await refreshMe()
    } catch (error) {
      showToast({
        title: 'Unable to update store',
        message: getApiErrorMessage(error, 'Unable to update store settings'),
        variant: 'error',
      })
    } finally {
      setSavingStore(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!profile) return

    try {
      setSavingAccount(true)

      const nameParts = splitFullName(accountForm.full_name)
      const updated = await updateMyProfile({
        full_name: accountForm.full_name.trim() || profile.full_name,
        first_name: nameParts.firstName || null,
        last_name: nameParts.lastName || null,
        phone: accountForm.phone || null,
        profile_image_url: accountForm.profile_image_url || null,
        timezone: accountForm.timezone || null,
        language: accountForm.language,
        two_factor_enabled: accountForm.two_factor_enabled,
      })

      setProfile(updated)
      showToast({
        title: 'Account updated',
        message: 'Account preferences updated successfully.',
        variant: 'success',
      })
      await refreshMe()
    } catch (error) {
      showToast({
        title: 'Unable to update account',
        message: getApiErrorMessage(error, 'Unable to update account preferences'),
        variant: 'error',
      })
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveWorkspace = async () => {
    try {
      setSavingWorkspace(true)
      saveWorkspacePreferences(workspacePreferences)
      saveNotificationPreferences(notificationPreferences)
      showToast({
        title: 'Workspace saved',
        message: 'Workspace preferences saved for this browser.',
        variant: 'success',
      })
    } finally {
      setSavingWorkspace(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.new_password.trim().length < 6) {
      showToast({
        title: 'Password is too short',
        message: 'New password must be at least 6 characters long.',
        variant: 'error',
      })
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast({
        title: 'Passwords do not match',
        message: 'New password and confirm password must match.',
        variant: 'error',
      })
      return
    }

    try {
      setSavingPassword(true)
      await changeMyPassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      showToast({
        title: 'Password updated',
        message: 'Password updated successfully.',
        variant: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Unable to update password',
        message: getApiErrorMessage(error, 'Unable to update password'),
        variant: 'error',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) {
    return (
        <div className="p-8 text-sm font-semibold text-slate-500 dark:text-slate-400">Settings are unavailable right now.</div>
    )
  }

  if (loading) {
    return (
        <div className="p-8 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading settings control center...</div>
    )
  }

  return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-1 py-2 sm:px-2">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-indigo-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_transparent_32%),linear-gradient(135deg,_#eef2ff_0%,_#dbeafe_40%,_#c7d2fe_100%)] px-6 py-8 text-slate-950 shadow-[0_24px_70px_rgba(99,102,241,0.16)] dark:border-indigo-900/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.24),_transparent_28%),linear-gradient(135deg,_#172554_0%,_#312e81_54%,_#1d4ed8_100%)] dark:text-white sm:px-8 lg:px-10">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-white/50 blur-3xl dark:bg-white/10" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-blue-300/60 blur-3xl dark:bg-cyan-400/20" />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/82 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-indigo-100">
                <Sparkles size={14} />
                Settings Control Center
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Settings, without the clutter.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base dark:text-indigo-100/85">
                Manage store, account, workspace, alerts, and security from one place.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <HeroMetric label="Store" value={shop?.name || 'Store'} hint={shop?.category || 'Business'} />
              <HeroMetric label="Language" value={accountForm.language} hint={accountForm.timezone} />
              <HeroMetric label="Theme" value={darkMode ? 'Dark' : 'Light'} hint="Workspace" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {blueprintCards.map((card) => (
            <div key={card.title} className="rounded-[1.8rem] border border-white/70 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-950 dark:text-white">{card.title}</p>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${card.status === 'Live now' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'}`}>
                  {card.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <SectionCard
            icon={<Store size={20} />}
            title="Business Identity"
            description="Store identity used across the workspace."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Store Name" value={shopForm.name} onChange={(value) => setShopForm((current) => ({ ...current, name: value }))} />
              <InputField label="Business Category" value={shopForm.category} onChange={(value) => setShopForm((current) => ({ ...current, category: value }))} />
              <InputField label="Business Email" value={shopForm.email} type="email" onChange={(value) => setShopForm((current) => ({ ...current, email: value }))} />
              <InputField label="Phone Number" value={shopForm.phone} onChange={(value) => setShopForm((current) => ({ ...current, phone: value }))} />
              <InputField label="WhatsApp Number" value={shopForm.whatsapp_number || ''} onChange={(value) => setShopForm((current) => ({ ...current, whatsapp_number: value }))} />
              <InputField label="Logo URL" value={shopForm.logo_url || ''} onChange={(value) => setShopForm((current) => ({ ...current, logo_url: value }))} placeholder="https://..." />
            </div>
            <div className="mt-4">
              <TextAreaField label="Business Address" value={shopForm.address || ''} onChange={(value) => setShopForm((current) => ({ ...current, address: value }))} placeholder="Full operating address" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ToggleRow
                title="GST registered"
                description="Enable GST calculation for products with GST rates."
                checked={Boolean(shopForm.gst_enabled)}
                onChange={(checked) => setShopForm((current) => ({ ...current, gst_enabled: checked }))}
              />
              <InputField label="GSTIN" value={shopForm.gstin || ''} onChange={(value) => setShopForm((current) => ({ ...current, gstin: value }))} placeholder="24AAAAA0000A1Z5" />
              <InputField label="Business State" value={shopForm.state || ''} onChange={(value) => setShopForm((current) => ({ ...current, state: value }))} placeholder="Gujarat" />
              <InputField label="GST State Code" value={shopForm.gst_state_code || ''} onChange={(value) => setShopForm((current) => ({ ...current, gst_state_code: value }))} placeholder="24" />
            </div>
            <div className="mt-4 space-y-4">
              <Banner state={storeBanner} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Shop-wide setting
                </p>
                {canManageSettings && <button
                  type="button"
                  onClick={handleSaveStore}
                  disabled={savingStore}
                  className="inline-flex h-11 items-center gap-2 rounded-[1.1rem] bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-[1px] disabled:opacity-70"
                >
                  <Save size={15} />
                  {savingStore ? 'Saving...' : 'Save Store Settings'}
                </button>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<UserCog2 size={20} />}
            title="Account Preferences"
            description="Owner profile and preference settings."
          >
            <div className="space-y-4">
              <InputField label="Display Name" value={accountForm.full_name} onChange={(value) => setAccountForm((current) => ({ ...current, full_name: value }))} />
              <InputField label="Contact Number" value={accountForm.phone} onChange={(value) => setAccountForm((current) => ({ ...current, phone: value }))} />
              <InputField label="Profile Image URL" value={accountForm.profile_image_url} onChange={(value) => setAccountForm((current) => ({ ...current, profile_image_url: value }))} placeholder="https://..." />
              <SelectField label="Language" value={accountForm.language} onChange={(value) => setAccountForm((current) => ({ ...current, language: value }))} options={languageOptions} />
              <SelectField label="Timezone" value={accountForm.timezone} onChange={(value) => setAccountForm((current) => ({ ...current, timezone: value }))} options={timezoneOptions} />
              <ToggleRow
                title="Two-factor authentication"
                description="Extra sign-in protection."
                checked={accountForm.two_factor_enabled}
                onChange={(checked) => setAccountForm((current) => ({ ...current, two_factor_enabled: checked }))}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAccount}
                  disabled={savingAccount}
                  className="inline-flex h-11 items-center gap-2 rounded-[1.1rem] bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-[1px] disabled:opacity-70"
                >
                  <ShieldCheck size={15} />
                  {savingAccount ? 'Saving...' : 'Save Account Preferences'}
                </button>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            icon={<Globe2 size={20} />}
            title="Workspace Controls"
            description="Device-level preferences for this browser."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Theme mode"
                description="Switch the workspace between light and dark instantly."
                checked={darkMode}
                onChange={(checked) => setDarkMode(checked)}
              />
              <SelectField
                label="Default Reports Period"
                value={workspacePreferences.default_reports_period}
                onChange={(value) =>
                  setWorkspacePreferences((current) => ({
                    ...current,
                    default_reports_period: value as WorkspacePreferences['default_reports_period'],
                  }))
                }
                options={reportPeriodOptions}
              />
              <SelectField
                label="Reports Visit Behavior"
                value={workspacePreferences.default_reports_scope}
                onChange={(value) =>
                  setWorkspacePreferences((current) => ({
                    ...current,
                    default_reports_scope: value as WorkspacePreferences['default_reports_scope'],
                  }))
                }
                options={[
                  { value: 'keep-last', label: 'Keep my last report filters' },
                  { value: 'reset-each-visit', label: 'Reset to default each visit' },
                ]}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveWorkspace}
                  disabled={savingWorkspace}
                  className="inline-flex h-11 items-center gap-2 rounded-[1.1rem] bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-[1px] disabled:opacity-70"
                >
                  {darkMode ? <MoonStar size={15} /> : <SunMedium size={15} />}
                  {savingWorkspace ? 'Saving...' : 'Save Workspace Settings'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Bell size={20} />}
            title="Alerts & Operations"
            description="Alert preferences for this browser."
          >
            <div className="grid gap-4">
              <ToggleRow
                title="Low-stock alerts"
                description="Prioritize inventory warnings inside the workspace."
                checked={notificationPreferences.low_stock_alerts}
                onChange={(checked) => setNotificationPreferences((current) => ({ ...current, low_stock_alerts: checked }))}
              />
              <ToggleRow
                title="Unpaid invoice alerts"
                description="Keep receivable pressure visible for customer follow-up."
                checked={notificationPreferences.unpaid_invoice_alerts}
                onChange={(checked) => setNotificationPreferences((current) => ({ ...current, unpaid_invoice_alerts: checked }))}
              />
              <ToggleRow
                title="Vendor due alerts"
                description="Surface payable risk before due dates slip."
                checked={notificationPreferences.vendor_due_alerts}
                onChange={(checked) => setNotificationPreferences((current) => ({ ...current, vendor_due_alerts: checked }))}
              />
              <ToggleRow
                title="Weekly digest"
                description="Enable a compact weekly operations summary pattern."
                checked={notificationPreferences.weekly_digest}
                onChange={(checked) => setNotificationPreferences((current) => ({ ...current, weekly_digest: checked }))}
              />

              <div className="rounded-[1.35rem] border border-indigo-100 bg-indigo-50/70 px-4 py-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-sm font-black text-slate-950 dark:text-white">Next up</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">
                  Billing rules, roles, exports, and automation.
                </p>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            icon={<LockKeyhole size={20} />}
            title="Security"
            description="Password and account protection."
          >
            <div className="grid gap-4">
              <InputField label="Current Password" type="password" value={passwordForm.current_password} onChange={(value) => setPasswordForm((current) => ({ ...current, current_password: value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="New Password" type="password" value={passwordForm.new_password} onChange={(value) => setPasswordForm((current) => ({ ...current, new_password: value }))} />
                <InputField label="Confirm Password" type="password" value={passwordForm.confirm_password} onChange={(value) => setPasswordForm((current) => ({ ...current, confirm_password: value }))} />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="inline-flex h-11 items-center gap-2 rounded-[1.1rem] bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-[1px] disabled:opacity-70"
                >
                  <LockKeyhole size={15} />
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<WalletCards size={20} />}
            title="Implementation Blueprint"
            description="Planned settings groups for the next phase."
          >
            <div className="space-y-3">
              {[
                ['Billing Defaults', 'Invoice rules, taxes, payment terms'],
                ['Inventory Rules', 'Low-stock and reorder rules'],
                ['Roles & Permissions', 'Access boundaries by role'],
                ['Data & Compliance', 'Exports, backups, retention'],
              ].map(([title, body]) => (
                <div key={title} className="flex items-start justify-between gap-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <div>
                    <p className="text-sm font-black text-slate-950 dark:text-white">{title}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{body}</p>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-slate-400" />
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </div>
  )
}

function HeroMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[1.65rem] border border-indigo-100/70 bg-white/74 px-4 py-4 shadow-sm backdrop-blur-sm dark:border-white/15 dark:bg-white/10">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-100/72">{label}</p>
      <p className="mt-3 line-clamp-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500 dark:text-indigo-100/72">{hint}</p>
    </div>
  )
}

