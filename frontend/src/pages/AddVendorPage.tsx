import { useState } from 'react'
import type { ElementType, FormEventHandler } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
  MapPin,
  Save,
  UserRound,
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import { vendorsApi } from '../features/vendors/api'
import { vendorSchema } from '../features/vendors/schemas'
import type { VendorCreatePayload } from '../features/vendors/types'

export default function AddVendorPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    vendor_name: '',
    company_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    tax_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    payment_terms: 'Net 15',
    default_reminder_days: 7,
    notes: '',
    is_active: true,
  })

  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const updateField = (
    field: keyof typeof form,
    value: string | number | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    try {
      setErrorMessage('')

      const parsed = vendorSchema.safeParse(form)

      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message || 'Invalid vendor data')
        return
      }

      setIsSaving(true)

      const vendorName = parsed.data.vendor_name?.trim()

      if (!vendorName) {
        setErrorMessage('Vendor company name is required')
        return
      }

      const vendorPayload: VendorCreatePayload = {
        ...parsed.data,
        vendor_name: vendorName,
        default_reminder_days: parsed.data.default_reminder_days ?? 7,
        is_active: parsed.data.is_active ?? true,
      }

      const created = await vendorsApi.createVendor(vendorPayload)

      navigate(`/vendors/${created.id}`)

    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save vendor'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      {/* Constrain max width; horizontal padding scales with screen size */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate('/vendors')}
            className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-3 py-2 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 sm:mb-6 sm:px-4 sm:py-2.5"
          >
            <ArrowLeft size={16} />
            <span className="hidden xs:inline">Back to Vendors</span>
            <span className="xs:hidden">Back</span>
          </button>

          {/* Page header */}
          <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              {/* Breadcrumb badge */}
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl sm:mb-4 sm:px-4 sm:py-2 sm:text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 sm:h-2 sm:w-2" />
                Vendors › Add New Vendor
              </div>

              {/* Responsive heading */}
              <h1 className="text-[32px] font-black tracking-[-0.04em] text-slate-950 sm:text-[42px] md:text-[56px]">
                Vendor Onboarding
              </h1>

              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600 sm:mt-3 sm:text-[18px] sm:leading-8">
                Configure your vendor ecosystem with financial terms, approval workflows, and intelligent billing automation.
              </p>
            </div>

            {/* Guided-setup badge — hide on mobile to save space */}
            <div className="hidden shrink-0 rounded-[28px] bg-white/70 p-4 shadow-[0_18px_48px_rgba(99,102,241,0.08)] backdrop-blur-xl lg:block">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">Guided setup</p>
                  <p className="text-xs text-slate-500">Vendor data syncs with bills</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Main form grid ──
              Mobile: single column (main card stacked above sidebar)
              XL: two columns [1fr / 360px] with sticky sidebar              */}
          <form
            onSubmit={handleSubmit}
            className="grid gap-6 sm:gap-8 xl:grid-cols-[1fr_360px]"
          >
            {/* ── Left / main card ── */}
            <div className="rounded-[28px] bg-white/78 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:rounded-[34px] sm:p-8">
              {errorMessage && (
                <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* ── Organisation Details ── */}
              <SectionTitle icon={Building2} title="Organisation Details" />

              <div className="grid lg:grid-cols-1 lg:gap-6 space-y-6 lg:space-y-0">
                <Input
                  label="Vendor Company Name"
                  value={form.vendor_name}
                  onChange={(value) => updateField('vendor_name', value)}
                  placeholder="e.g. Global Logistics Corp"
                />

                <Input
                  label="Display / Business Name"
                  value={form.company_name}
                  onChange={(value) => updateField('company_name', value)}
                  placeholder="Optional business name"
                />

                {/* Two-col on sm+ */}
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    label="Payment Terms"
                    value={form.payment_terms}
                    onChange={(value) => updateField('payment_terms', value)}
                    placeholder="Net 15"
                  />

                  <Input
                    label="Tax ID / VAT"
                    value={form.tax_number}
                    onChange={(value) => updateField('tax_number', value)}
                    placeholder="GST / VAT number"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    type="number"
                    label="Default Reminder Days"
                    value={form.default_reminder_days}
                    onChange={(value) =>
                      updateField('default_reminder_days', Number(value))
                    }
                    placeholder="7"
                  />

                  <label className="space-y-2">
                    <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
                      Vendor Status
                    </span>

                    <select
                      value={form.is_active ? 'active' : 'inactive'}
                      onChange={(event) =>
                        updateField('is_active', event.target.value === 'active')
                      }
                      className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] font-semibold text-slate-800 outline-none transition-all duration-300 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>

              <SoftDivider />

              {/* ── Primary Contact ── */}
              <SectionTitle icon={UserRound} title="Primary Contact" />

              <div className="grid gap-4  sm:gap-5">
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    label="Primary Contact Person"
                    value={form.company_name}
                    onChange={(value) => updateField('company_name', value)}
                    placeholder="Full name of contact"
                  />

                  <Input
                    label="Email Address"
                    value={form.email}
                    onChange={(value) => updateField('email', value)}
                    placeholder="contact@company.com"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    label="Phone Number"
                    value={form.phone}
                    onChange={(value) => updateField('phone', value)}
                    placeholder="+91 98765 43210"
                  />

                  <Input
                    label="Alternate Phone"
                    value={form.alternate_phone}
                    onChange={(value) => updateField('alternate_phone', value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <SoftDivider />

              {/* ── Address ── */}
              <SectionTitle icon={MapPin} title="Logistics & Address" />

              <div className="grid gap-4 sm:gap-5">
                <Input
                  label="Address Line 1"
                  value={form.address_line_1}
                  onChange={(value) => updateField('address_line_1', value)}
                  placeholder="Street / building / area"
                />

                <Input
                  label="Address Line 2"
                  value={form.address_line_2}
                  onChange={(value) => updateField('address_line_2', value)}
                  placeholder="Optional"
                />

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(value) => updateField('city', value)}
                    placeholder="Rajkot"
                  />

                  <Input
                    label="State"
                    value={form.state}
                    onChange={(value) => updateField('state', value)}
                    placeholder="Gujarat"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 sm:gap-5">
                  <Input
                    label="Postal Code"
                    value={form.postal_code}
                    onChange={(value) => updateField('postal_code', value)}
                    placeholder="360001"
                  />

                  <Input
                    label="Country"
                    value={form.country}
                    onChange={(value) => updateField('country', value)}
                    placeholder="India"
                  />
                </div>

                <label className="space-y-2">
                  <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
                    Notes
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    rows={4}
                    placeholder="Internal vendor notes"
                    className="w-full resize-none rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 py-3 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
                  />
                </label>
              </div>

              {/* ── Mobile-only action buttons (inside form card) ── */}
              <div className="mt-8 space-y-3 xl:hidden">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Save Vendor
                </motion.button>

                <button
                  type="button"
                  onClick={() => navigate('/vendors')}
                  className="h-14 w-full rounded-[22px] bg-slate-100 text-sm font-black text-slate-800 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* ── Right / sidebar ──
                Hidden on mobile (actions live inside the main card above).
                Shown + sticky on xl.                                        */}
            <aside className="hidden xl:sticky xl:top-6 xl:block xl:space-y-6 xl:self-start">
              {/* Actions card */}
              <div className="rounded-[34px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Actions
                </p>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -2 }}
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Save Vendor
                </motion.button>

                <button
                  type="button"
                  onClick={() => navigate('/vendors')}
                  className="mt-3 h-14 w-full rounded-[22px] bg-slate-100 text-sm font-black text-slate-800 transition hover:bg-slate-200"
                >
                  Cancel
                </button>

                <p className="mt-6 text-sm leading-6 text-slate-500">
                  This vendor will be available for purchase bills, payment
                  tracking, and due reminders.
                </p>
              </div>

              {/* Pro tip */}
              <div className="rounded-[28px] border border-indigo-100 bg-indigo-50/80 p-6 text-indigo-950 shadow-[0_18px_40px_rgba(99,102,241,0.08)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-700">
                  <Info size={18} />
                  Pro Tip
                </div>

                <p className="text-sm leading-6">
                  Accurate payment terms help Veltrix calculate reminders and
                  payable insights more clearly.
                </p>
              </div>

              {/* Promo card */}
              <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#1a087a] via-[#2910a8] to-[#4f46e5] p-7 text-white shadow-[0_28px_70px_rgba(49,46,129,0.28)]">
                <ClipboardCheck size={38} className="mb-20 opacity-85" />

                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                  Veltrix Global
                </p>

                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                  Empower reliable partnerships.
                </h3>

                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/18 blur-2xl" />
                <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-violet-300/20 blur-3xl" />
              </div>
            </aside>
          </form>
        </motion.div>
      </div>
    </AppShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: ElementType
  title: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] sm:h-12 sm:w-12">
        <Icon size={20} />
      </div>

      <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950 sm:text-xl">
        {title}
      </h2>
    </div>
  )
}

function SoftDivider() {
  return (
    <div className="my-7 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent sm:my-9" />
  )
}

function Input({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  placeholder?: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        /* min-h ensures comfortable tap targets on mobile */
        className="h-12 w-full rounded-[18px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] sm:h-14 sm:rounded-[20px]"
      />
    </label>
  )
}