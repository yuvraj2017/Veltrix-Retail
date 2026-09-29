import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'

import { LoginHero } from '../components/auth/LoginHero'
import { resetPassword, validateResetPasswordToken } from '../features/auth/api'
import { resetPasswordSchema, type ResetPasswordFormValues } from '../features/auth/schemas'
import { getApiErrorMessage } from '../lib/api-error'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenMessage, setTokenMessage] = useState('')
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  })

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setTokenMessage('This password reset link is incomplete or missing.')
      setTokenLoading(false)
      return
    }

    let cancelled = false

    const checkToken = async () => {
      try {
        setTokenLoading(true)
        const response = await validateResetPasswordToken(token)
        if (cancelled) return
        setTokenValid(response.valid)
        setTokenMessage(response.message)
      } catch (error) {
        if (cancelled) return
        setTokenValid(false)
        setTokenMessage(getApiErrorMessage(error, 'Unable to validate the reset link.'))
      } finally {
        if (!cancelled) {
          setTokenLoading(false)
        }
      }
    }

    void checkToken()

    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      setApiError('')
      setIsSubmitting(true)
      const response = await resetPassword({
        token,
        new_password: values.password,
      })
      setSuccessMessage(response.message)
      setTokenValid(false)
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Unable to reset your password.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <LoginHero />

      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-6 sm:mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm">
              <ShieldCheck size={14} />
              Secure Password Reset
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Create a new password
            </h1>

            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 sm:text-base">
              Choose a fresh password for your Purple account. This reset link is single-use and expires automatically.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-7">
            {tokenLoading ? (
              <div className="space-y-4">
                <div className="h-5 w-40 animate-pulse rounded-full bg-slate-100" />
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : successMessage ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-900">Password updated</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{successMessage}</p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5"
                >
                  Back to Sign In
                  <ArrowRight size={18} />
                </Link>
              </div>
            ) : !tokenValid ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <KeyRound size={28} />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-900">Reset link unavailable</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{tokenMessage}</p>
                <div className="mt-6 space-y-3">
                  <Link
                    to="/forgot-password"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Request a new reset link
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-slate-700">New Password</label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500">
                      <KeyRound size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      {...register('password')}
                      className="w-full rounded-2xl border border-slate-200 bg-[#f8fbff] py-4 pl-16 pr-16 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition hover:text-indigo-500 group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500">
                      <ShieldCheck size={18} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat the new password"
                      {...register('confirm_password')}
                      className="w-full rounded-2xl border border-slate-200 bg-[#f8fbff] py-4 pl-16 pr-16 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition hover:text-indigo-500 group-focus-within:border-indigo-200 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-xs text-red-500">{errors.confirm_password.message}</p>}
                </div>

                {tokenMessage && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                    {tokenMessage}
                  </div>
                )}

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
                    <span>{isSubmitting ? 'Updating password...' : 'Update Password'}</span>
                    {!isSubmitting && <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                  </span>
                </button>
              </form>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>One-time reset links only</span>
            <span>Link auto-expires for safety</span>
          </div>
        </div>
      </div>
    </div>
  )
}
