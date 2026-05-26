import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
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
import { Link, useNavigate } from 'react-router-dom'
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


const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-14 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100'


type InputShellProps = {
  label: string
  icon: React.ReactNode
  error?: { message?: string }
  children: React.ReactNode
}


function InputShell({ label, icon, error, children }: InputShellProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm">
          {icon}
        </div>
        {children}
      </div>
      {error?.message && <p className="text-xs text-red-500">{error.message}</p>}
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
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">Category</label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`group w-full rounded-xl border bg-white/80 py-3 pl-14 pr-10 text-left text-sm text-slate-900 outline-none transition-all duration-300 ${
            open
              ? 'border-indigo-400 bg-white ring-4 ring-indigo-100'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:text-indigo-500">
            <Building2 size={15} />
          </div>
          <span className={value ? 'text-slate-900' : 'text-slate-400'}>
            {value || 'Select category'}
          </span>
          <div
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-all duration-300 ${
              open ? 'rotate-180 text-indigo-500' : ''
            }`}
          >
            <ChevronDown size={15} />
          </div>
        </button>


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
      {error?.message && <p className="text-xs text-red-500">{error.message}</p>}
    </div>
  )
}


export default function RegisterPage() {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      await registerShop(formData)
      reset({ shop_name: '', owner_name: '', email: '', category: '', phone: '', password: '', confirm_password: '' })
      setSelectedLogo(null)
      setPreviewUrl('')
      setWhatsappNumber('')
      setShopAddress('')
      navigate('/login')
    } catch (error: any) {
      setApiError(error?.response?.data?.detail || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    // Outer layout: single column on mobile, two-column on lg+
   <div className="min-h-screen overflow-hidden bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Hero — hidden on mobile, shown on lg+ */}
      <div className="">
        <RegisterHero />
      </div>


      {/* Form panel */}
      <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_22%),linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] px-4 py-6 sm:px-6 sm:py-8 lg:items-center lg:px-10 lg:py-10">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-70px] top-12 h-48 w-48 rounded-full bg-violet-200/20 blur-3xl" />
          <div className="absolute bottom-8 left-8 h-36 w-36 rounded-full bg-indigo-200/20 blur-3xl" />
        </div>


        <div className="relative z-10 w-full max-w-[560px]">


          {/* ── Header ── */}
          <div className="mb-5 flex flex-col gap-3 xs:flex-row xs:items-start xs:justify-between sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-600 shadow-sm">
                <ShieldCheck size={12} />
                Create Your Retail Workspace
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                Launch your StoreMitraa account
              </h1>
              <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500 sm:leading-6">
                Set up your store profile, upload your brand identity, and get
                ready to manage products, billing, and operations from one
                modern retail workspace.
              </p>
            </div>


            <Link
              to="/login"
              className="inline-flex shrink-0 self-start items-center gap-1.5 rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_6px_20px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 sm:px-4 sm:py-2.5"
            >
              <ArrowLeft size={14} />
              <span className="hidden xs:inline sm:inline">Back to Login</span>
              <span className="xs:hidden sm:hidden">Login</span>
            </Link>
          </div>


          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-3 sm:space-y-3.5">
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
                  className={inputClass}
                />
              </InputShell>
              <InputShell label="Owner Name" icon={<User2 size={15} />} error={errors.owner_name}>
                <input
                  type="text"
                  placeholder="Owner full name"
                  autoComplete="off"
                  {...register('owner_name')}
                  className={inputClass}
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
                className={inputClass}
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
                  className={inputClass}
                />
              </InputShell>
            </div>


            {/* WhatsApp + Address */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">WhatsApp Number</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm">
                    <MessageCircle size={15} />
                  </div>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="WhatsApp number"
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              </div>


              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Shop Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm">
                    <MapPin size={15} />
                  </div>
                  <textarea
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="Enter full shop address"
                    rows={1}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white/80 py-3 pl-14 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>


            {/* Logo upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Shop Logo</label>
              <label className="group block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-indigo-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(245,247,255,0.88)_100%)] p-3.5 shadow-[0_12px_36px_rgba(79,70,229,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_18px_44px_rgba(79,70,229,0.10)] sm:p-4">
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
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100 transition duration-300 group-hover:scale-105 group-hover:rotate-3 sm:h-12 sm:w-12">
                      <UploadCloud size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Upload your shop logo</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        PNG, JPG, JPEG or WEBP.{' '}
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 transition group-hover:bg-indigo-100">
                          <CheckCircle2 size={11} />
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


            {/* API error */}
            {apiError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
                {apiError}
              </div>
            )}


            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(79,70,229,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(79,70,229,0.32)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_34%)]" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-2">
                <span>{isSubmitting ? 'Creating account…' : 'Create Shop Account'}</span>
                {!isSubmitting && (
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                )}
              </span>
            </button>


            {/* Sign-in link */}
            <div className="rounded-xl border border-slate-200 bg-white/75 px-4 py-3 text-center text-xs text-slate-500 shadow-sm">
              Already have an account?{' '}
              <Link
                to="/"
                className="font-semibold text-indigo-600 transition hover:text-indigo-700"
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

