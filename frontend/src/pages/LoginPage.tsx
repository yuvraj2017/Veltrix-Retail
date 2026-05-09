import { zodResolver } from '@hookform/resolvers/zod'
import { Globe, LockKeyhole, Mail, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { LoginHero } from '../components/auth/LoginHero'
import { useAuth } from '../context/AuthContext'
import { loginSchema, type LoginFormValues } from '../features/auth/schemas'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: true,
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setApiError('')
      setIsSubmitting(true)

      const response = await api.post('/api/v1/auth/login', {
        email: values.email,
        password: values.password,
      })

      login(response.data)
      navigate('/dashboard')
    } catch (error: any) {
      console.error('login failed', error)
      setApiError(error?.response?.data?.detail || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <LoginHero />

      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-6 sm:mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Secure Staff Access
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Sign in to Veltrix
            </h1>

            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 sm:text-base">
              Access your retail dashboard, inventory controls, billing tools,
              and store operations from one secure place.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-slate-700">
                Business Email
              </label>

              <div className="group relative">
                <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500">
                  <Mail size={18} />
                </div>

                <input
                  type="email"
                  placeholder="you@shop.com"
                  {...register('email')}
                  className="w-full rounded-2xl border border-slate-200 bg-[#f8fbff] py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  Forgot Password?
                </Link>
              </div>

              <div className="group relative">
                <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500">
                  <LockKeyhole size={18} />
                </div>

                <input
                  type="password"
                  placeholder="Enter password"
                  {...register('password')}
                  className="w-full rounded-2xl border border-slate-200 bg-[#f8fbff] py-4 pl-16 pr-4 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  {...register('remember')}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Keep me signed in
              </label>

              <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                Retail-grade security
              </span>
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
                <span>{isSubmitting ? 'Signing in...' : 'Sign In to Dashboard'}</span>
                {!isSubmitting && (
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                )}
              </span>
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] px-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                <Globe size={18} />
                Google Coming Soon
              </button>

              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                Enterprise SSO Coming Soon
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-indigo-600 transition hover:text-indigo-700"
              >
                Create one
              </Link>
            </div>
          </form>

          <div className="mt-8 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Built for modern retail teams</span>
            <span>Fast. Secure. Reliable.</span>
          </div>
        </div>
      </div>
    </div>
  )
}