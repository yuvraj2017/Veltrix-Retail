import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Mail,
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

type InputShellProps = {
  label: string
  icon: React.ReactNode
  error?: { message?: string }
  children: React.ReactNode
}

function InputShell({ label, icon, error, children }: InputShellProps) {
  return (
    <div className="space-y-2.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>

      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm">
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
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="space-y-2.5">
      <label className="text-sm font-semibold text-slate-700">Category</label>

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`group w-full rounded-2xl border bg-white/80 py-4 pl-16 pr-14 text-left text-sm text-slate-900 outline-none transition-all duration-300 ${
            open
              ? 'border-indigo-400 bg-white ring-4 ring-indigo-100'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="pointer-events-none absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:text-indigo-500">
            <Building2 size={18} />
          </div>

          <span className={value ? 'text-slate-900' : 'text-slate-400'}>
            {value || 'Select category'}
          </span>

          <div
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-all duration-300 ${
              open ? 'rotate-180 text-indigo-500' : ''
            }`}
          >
            <ChevronDown size={18} />
          </div>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-[24px] border border-indigo-100/80 bg-white/90 p-2 shadow-[0_24px_60px_rgba(79,70,229,0.14)] backdrop-blur-xl">
            <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {categories.map((category) => {
                const isSelected = value === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      onChange(category)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium">{category}</span>

                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-[0_8px_18px_rgba(79,70,229,0.22)]'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Check size={14} />
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
  }, [reset])

  useEffect(() => {
    if (!selectedLogo) {
      setPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(selectedLogo)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
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

      if (selectedLogo) {
        formData.append('logo', selectedLogo)
      }

      await registerShop(formData)

      reset({
        shop_name: '',
        owner_name: '',
        email: '',
        category: '',
        phone: '',
        password: '',
        confirm_password: '',
      })
      setSelectedLogo(null)
      setPreviewUrl('')

      navigate('/login')
    } catch (error: any) {
      setApiError(error?.response?.data?.detail || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <RegisterHero />

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_22%),linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-90px] top-16 h-56 w-56 rounded-full bg-violet-200/20 blur-3xl" />
          <div className="absolute bottom-10 left-10 h-44 w-44 rounded-full bg-indigo-200/20 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-[580px]">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm">
                <ShieldCheck size={14} />
                Create Your Retail Workspace
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Launch your Veltrix account
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 sm:text-base">
                Set up your store profile, upload your brand identity, and get
                ready to manage products, billing, and operations from one
                modern retail workspace.
              </p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-[0_16px_34px_rgba(79,70,229,0.10)]"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            autoComplete="off"
            className="space-y-5"
          >
            <input
              type="text"
              name="fake_username"
              autoComplete="username"
              className="hidden"
              tabIndex={-1}
            />
            <input
              type="password"
              name="fake_password"
              autoComplete="new-password"
              className="hidden"
              tabIndex={-1}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <InputShell
                label="Shop Name"
                icon={<Store size={18} />}
                error={errors.shop_name}
              >
                <input
                  type="text"
                  placeholder="Your shop name"
                  autoComplete="off"
                  {...register('shop_name')}
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </InputShell>

              <InputShell
                label="Owner Name"
                icon={<User2 size={18} />}
                error={errors.owner_name}
              >
                <input
                  type="text"
                  placeholder="Owner full name"
                  autoComplete="off"
                  {...register('owner_name')}
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </InputShell>
            </div>

            <InputShell
              label="Business Email"
              icon={<Mail size={18} />}
              error={errors.email}
            >
              <input
                type="email"
                placeholder="you@shop.com"
                autoComplete="off"
                {...register('email')}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </InputShell>

            <div className="grid gap-5 sm:grid-cols-[1fr_0.95fr]">
              <CategoryDropdown
                value={selectedCategory}
                onChange={(value) =>
                  setValue('category', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                error={errors.category}
              />

              <InputShell
                label="Phone Number"
                icon={<Phone size={18} />}
                error={errors.phone}
              >
                <input
                  type="text"
                  placeholder="9876543210"
                  autoComplete="off"
                  {...register('phone')}
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </InputShell>
            </div>

            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-slate-700">Shop Logo</label>

              <label className="group block cursor-pointer overflow-hidden rounded-[28px] border border-dashed border-indigo-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(245,247,255,0.88)_100%)] p-5 shadow-[0_18px_50px_rgba(79,70,229,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_24px_60px_rgba(79,70,229,0.12)]">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setSelectedLogo(file)
                  }}
                  className="hidden"
                />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100 transition duration-300 group-hover:scale-105 group-hover:rotate-3">
                      <UploadCloud size={26} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Upload your shop logo
                      </p>
                      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                        PNG, JPG, JPEG or WEBP. Add a clean and professional
                        identity to your retail workspace.
                      </p>

                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition group-hover:bg-indigo-100">
                        <CheckCircle2 size={13} />
                        Click to browse
                      </div>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all duration-300 group-hover:shadow-md">
                      <img
                        src={previewUrl}
                        alt="Logo Preview"
                        className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                      <div className="min-w-0">
                        <p className="max-w-[140px] truncate text-sm font-semibold text-slate-900">
                          {selectedLogo?.name || 'Logo selected'}
                        </p>
                        <p className="text-xs text-slate-500">Preview ready</p>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
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

            {apiError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(79,70,229,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_34%)]" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative flex items-center justify-center gap-2">
                <span>{isSubmitting ? 'Creating account...' : 'Create Shop Account'}</span>
                {!isSubmitting && (
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                )}
              </span>
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-4 text-center text-sm text-slate-500 shadow-sm">
              Already have an account?{' '}
              <Link
                to="/login"
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