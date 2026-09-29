import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Store,
  UploadCloud,
  User2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../components/auth/BrandLogo'
import {
  ALERT_CLASS,
  CARD_ACCENT,
  CARD_CLASS,
  ERROR_TEXT,
  FADE_RULE,
  fieldClass,
  ICON_CLASS,
  ICON_CLASS_TOP,
  LABEL_CLASS,
  LINK_CLASS,
  PRIMARY_BUTTON,
  PRIMARY_SHEEN,
} from '../components/auth/formStyles'
import { PasswordInput } from '../components/auth/PasswordInput'
import { RegisterHero } from '../components/auth/RegisterHero'
import { registerShop } from '../features/auth/api'
import { registerSchema, type RegisterFormValues } from '../features/auth/schemas'


const categories = [
  'General Store',
  'Grocery',
  'Fashion',
  'Electronics',
  'Pharmacy',
  'Bakery',
  'Hardware',
  'Stationery',
  'Other',
]


/**
 * Every text input on this form. `compact` because eleven fields at the login
 * screen's density would not fit a laptop viewport.
 */
const inputClass = fieldClass({ density: 'compact', extra: 'pr-4' })

/** Same shell, flagged red — swapped in when the field has a validation error. */
const inputErrorClass = fieldClass({ density: 'compact', error: true, extra: 'pr-4' })

const shellClass = (hasError: boolean) => (hasError ? inputErrorClass : inputClass)


type InputShellProps = {
  label: string
  icon: React.ReactNode
  error?: { message?: string }
  children: React.ReactNode
}


/**
 * Label + leading icon + inline error, wrapped around a caller-supplied input.
 *
 * The icon renders AFTER the input even though it paints on the left: it is
 * tinted by `peer-focus:`, which compiles to a sibling selector and so cannot
 * look backwards to an earlier element.
 */
function InputShell({ label, icon, error, children }: InputShellProps) {
  return (
    <div>
      <label className={`mb-1.5 block ${LABEL_CLASS}`}>{label}</label>

      <div className="relative">
        {children}
        <span className={`${ICON_CLASS} flex`}>{icon}</span>
      </div>

      {error?.message && (
        <p className={ERROR_TEXT}>
          <AlertCircle size={13} className="shrink-0" aria-hidden />
          {error.message}
        </p>
      )}
    </div>
  )
}


type CategoryDropdownProps = {
  value: string
  onChange: (value: string) => void
  error?: { message?: string }
}


function CategoryDropdown({ value, onChange, error }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)


  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])


  return (
    <div>
      <label className={`mb-1.5 block ${LABEL_CLASS}`}>Category</label>

      <div ref={containerRef} className="relative">
        {/* A <button>, so it never matches `:focus` while the menu is open —
            hence `active` rather than relying on the focus variants. */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={fieldClass({
            active: open,
            error: Boolean(error),
            density: 'compact',
            extra: 'pr-10 text-left',
          })}
        >
          <span className={value ? 'text-slate-900' : 'text-slate-400'}>
            {value || 'Select category'}
          </span>
        </button>

        {/* Both decorations sit after the button so `peer-focus:` can tint the
            leading icon; the chevron turns on `open` instead. */}
        <Building2 size={16} className={ICON_CLASS} aria-hidden />

        <ChevronDown
          size={16}
          aria-hidden
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-indigo-500' : ''
          }`}
        />


        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-indigo-100/80 bg-white/90 p-1.5 shadow-[0_20px_50px_rgba(79,70,229,0.14)] backdrop-blur-xl">
            <div className="custom-scrollbar max-h-52 overflow-y-auto pr-0.5">
              {categories.map((category) => {
                const isSelected = value === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => { onChange(category); setOpen(false) }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium">{category}</span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.22)]'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Check size={12} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {error?.message && (
        <p className={ERROR_TEXT}>
          <AlertCircle size={13} className="shrink-0" aria-hidden />
          {error.message}
        </p>
      )}
    </div>
  )
}


export default function RegisterPage() {
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Set once registration succeeds. The account is `pending` at this point,
   *  so the form is replaced by an explanation rather than a redirect. */
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [shopAddress, setShopAddress] = useState('')


  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      shop_name: '',
      owner_name: '',
      email: '',
      category: '',
      phone: '',
      password: '',
      confirm_password: '',
    },
  })


  const selectedCategory = watch('category')


  useEffect(() => {
    reset({
      shop_name: '',
      owner_name: '',
      email: '',
      category: '',
      phone: '',
      password: '',
      confirm_password: '',
    })
    setWhatsappNumber('')
    setShopAddress('')
  }, [reset])


  useEffect(() => {
    if (!selectedLogo) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(selectedLogo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedLogo])


  const onSubmit = async (values: RegisterFormValues) => {
    setApiError('')
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('shop_name', values.shop_name)
      formData.append('owner_name', values.owner_name)
      formData.append('email', values.email)
      formData.append('category', values.category)
      formData.append('phone', values.phone)
      formData.append('password', values.password)
      formData.append('whatsapp_number', whatsappNumber)
      formData.append('shop_address', shopAddress)
      if (selectedLogo) formData.append('logo', selectedLogo)
      const response = await registerShop(formData)
      reset({ shop_name: '', owner_name: '', email: '', category: '', phone: '', password: '', confirm_password: '' })
      setSelectedLogo(null)
      setPreviewUrl('')
      setWhatsappNumber('')
      setShopAddress('')
      // No token is issued for a pending account, so there is nothing to log
      // in with. Show what happens next instead of redirecting.
      setSubmittedEmail(response.email || values.email)
    } catch (error: any) {
      setApiError(error?.response?.data?.detail || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }


  /**
   * Post-registration state.
   *
   * The account is created in `pending` and issued no token, so there is
   * nothing to sign in with yet. This replaces the form rather than
   * redirecting to /login, where the person would otherwise be met by a
   * refusal they had no way to anticipate.
   */
  if (submittedEmail) {
    return (
      <div className="min-h-screen overflow-hidden bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="">
          <RegisterHero />
        </div>

        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfcff] px-4 py-8 sm:px-6 lg:px-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 45% at 100% 0%, rgba(99,102,241,0.07) 0%, transparent 70%),' +
                'radial-gradient(ellipse 60% 40% at 0% 100%, rgba(139,92,246,0.05) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 w-full max-w-[520px] text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-emerald-600">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h1 className="mt-6 text-[30px] font-black leading-tight tracking-[-0.03em] text-slate-950 sm:text-[36px]">
              Registration received
            </h1>

            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Thanks for signing up. Your account for{' '}
              <span className="font-bold text-slate-900">{submittedEmail}</span> is
              awaiting approval from an administrator.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50 px-5 py-4 text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                What happens next
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                You will not be able to sign in until your registration has been
                reviewed. Once it is approved you can sign in with the email and
                password you just chose.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
              >
                Go to sign in
              </Link>

              <button
                type="button"
                onClick={() => setSubmittedEmail('')}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Register another shop
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Outer layout: single column on mobile, two-column on lg+
   <div className="min-h-screen overflow-hidden bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Hero — hidden on mobile, shown on lg+ */}
      <div className="">
        <RegisterHero />
      </div>


      {/* Form panel — same surface and wash as the login and recovery screens */}
      <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-[#fbfcff] px-4 py-8 sm:px-6 sm:py-10 lg:items-center lg:px-10 lg:py-10">
        {/* barely-there wash so the white panel is not clinical */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 100% 0%, rgba(99,102,241,0.07) 0%, transparent 70%),' +
              'radial-gradient(ellipse 60% 40% at 0% 100%, rgba(139,92,246,0.05) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[560px]">
          {/* ══ LOGO PLACEHOLDER — the brand mark above the card ════════════
              Same treatment as the login and recovery screens: tone="bare"
              means no tile, so the artwork sits on the page background.

              Smaller here (h-16 w-40) than on those two — this form is eleven
              fields long, so the mark takes less of the vertical budget.

              The PNG/SVG file path is set by BRAND.logoSrc in
              ../components/auth/authContent.ts — change it THERE, not here. */}
          <BrandLogo tone="bare" fill className="mx-auto mb-6 h-16 w-40" />

          <div className={CARD_CLASS}>
            <div aria-hidden className={CARD_ACCENT} />

            {/* ── Header ──
                The old "Back to Login" pill is gone: the footer link at the
                bottom of this card already goes there, and two routes to the
                same place read as indecision. */}
            <header className="mb-6 text-center">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-600">
                <ShieldCheck size={12} aria-hidden />
                Create your retail workspace
              </span>

              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[30px]">
                Launch your Purple account
              </h1>
              <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-slate-500">
                Set up your store profile, add your brand, and start managing products,
                billing and operations from one workspace.
              </p>
            </header>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-3.5">
            {/* Honeypot fields */}
            <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
            <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} />


            {/* Shop Name + Owner Name */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
              <InputShell label="Shop Name" icon={<Store size={15} />} error={errors.shop_name}>
                <input
                  type="text"
                  placeholder="Your shop name"
                  autoComplete="off"
                  {...register('shop_name')}
                  className={shellClass(Boolean(errors.shop_name))}
                />
              </InputShell>
              <InputShell label="Owner Name" icon={<User2 size={15} />} error={errors.owner_name}>
                <input
                  type="text"
                  placeholder="Owner full name"
                  autoComplete="off"
                  {...register('owner_name')}
                  className={shellClass(Boolean(errors.owner_name))}
                />
              </InputShell>
            </div>


            {/* Email */}
            <InputShell label="Business Email" icon={<Mail size={15} />} error={errors.email}>
              <input
                type="email"
                placeholder="you@shop.com"
                autoComplete="off"
                {...register('email')}
                className={shellClass(Boolean(errors.email))}
              />
            </InputShell>


            {/* Category + Phone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
              <CategoryDropdown
                value={selectedCategory}
                onChange={(val) =>
                  setValue('category', val, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                error={errors.category}
              />
              <InputShell label="Phone Number" icon={<Phone size={15} />} error={errors.phone}>
                <input
                  type="text"
                  placeholder="9876543210"
                  autoComplete="off"
                  {...register('phone')}
                  className={shellClass(Boolean(errors.phone))}
                />
              </InputShell>
            </div>


            {/* WhatsApp + Address */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
              {/* WhatsApp — optional, so no validation and no error slot */}
              <div>
                <label htmlFor="reg-whatsapp" className={`mb-1.5 block ${LABEL_CLASS}`}>
                  WhatsApp Number
                </label>

                <div className="relative">
                  <input
                    id="reg-whatsapp"
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="WhatsApp number"
                    autoComplete="off"
                    className={inputClass}
                  />
                  <MessageCircle size={16} className={ICON_CLASS} aria-hidden />
                </div>
              </div>


              {/* Address */}
              <div>
                <label htmlFor="reg-address" className={`mb-1.5 block ${LABEL_CLASS}`}>
                  Shop Address
                </label>

                <div className="relative">
                  <textarea
                    id="reg-address"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="Enter full shop address"
                    rows={1}
                    className={fieldClass({ density: 'compact', extra: 'resize-none pr-4' })}
                  />
                  {/* Pinned near the top, not centred — a textarea grows. */}
                  <MapPin size={16} className={ICON_CLASS_TOP} aria-hidden />
                </div>
              </div>
            </div>


            {/* Logo upload — a dashed version of the field surface, so the drop
                zone reads as part of the same form rather than a widget bolted
                on. The caption is a <span>: the real <label> is the one below,
                which wraps the file input, and a second <label> labelling
                nothing would just confuse a screen reader. */}
            <div>
              <span className={`mb-1.5 block ${LABEL_CLASS}`}>Shop Logo</span>

              <label className="group block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 transition duration-200 hover:border-indigo-300 hover:bg-indigo-50/40 sm:p-4">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => setSelectedLogo(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {/* Upload content: stacks on mobile, side-by-side on sm+ */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: icon + text */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition duration-200 group-hover:ring-indigo-200 sm:h-12 sm:w-12">
                      <UploadCloud size={20} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Upload your shop logo</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        PNG, JPG, JPEG or WEBP.{' '}
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 transition group-hover:bg-indigo-100">
                          <CheckCircle2 size={11} aria-hidden />
                          Click to browse
                        </span>
                      </p>
                    </div>
                  </div>


                  {/* Right: preview — full width on mobile, auto on sm+ */}
                  {previewUrl && (
                    <div className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-all duration-300 group-hover:shadow-md sm:w-auto sm:shrink-0">
                      <img
                        src={previewUrl}
                        alt="Logo Preview"
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200 sm:h-12 sm:w-12"
                        decoding="async"
                      />
                      <div className="min-w-0">
                        <p className="max-w-[160px] truncate text-xs font-semibold text-slate-900 sm:max-w-[120px]">
                          {selectedLogo?.name || 'Logo selected'}
                        </p>
                        <p className="text-[11px] text-slate-500">Preview ready</p>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>


            {/* Passwords */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
              <PasswordInput
                label="Password"
                placeholder="Create password"
                autoComplete="new-password"
                {...register('password')}
                error={errors.password}
              />
              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm password"
                autoComplete="new-password"
                {...register('confirm_password')}
                error={errors.confirm_password}
              />
            </div>


            {/* API error — role="alert" so it is announced on arrival */}
            {apiError && (
              <div role="alert" className={ALERT_CLASS}>
                <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{apiError}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className={`${PRIMARY_BUTTON} mt-1`}>
              <span aria-hidden className={PRIMARY_SHEEN} />

              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                <>
                  Create shop account
                  <ArrowRight
                    size={17}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </>
              )}
            </button>
          </form>

            {/* ── Way back ─────────────────────────────────────────── */}
            <div aria-hidden className={`mt-7 ${FADE_RULE}`} />

            <p className="pt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/" className={LINK_CLASS}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

