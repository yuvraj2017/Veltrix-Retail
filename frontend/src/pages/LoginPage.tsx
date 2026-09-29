/**
 * LoginPage — split layout: brand panel (lg and up) + the sign-in task.
 *
 * Responsive strategy
 * -------------------
 *   < 640   the card loses its chrome (border/shadow/padding) and the fields
 *           run edge to edge, so a 360px phone spends none of its width on
 *           decoration. A compact gradient brand band replaces the hero.
 *   640+    the form becomes a real card on a tinted panel.
 *   1024+   the hero panel appears alongside at 50/50 and the mobile brand
 *           band and trust strip switch off.
 *   1280+   wider gutters and a slightly larger measure.
 *
 * The form column is the product here, so it gets equal width, the calmer
 * surface, and every affordance a returning user expects: real <label for>
 * bindings, autocomplete hints so password managers fill correctly, a caps
 * lock warning, errors announced to assistive tech, and one unambiguous
 * primary action.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { BRAND, TRUST } from '../components/auth/authContent'
import { BrandLogo } from '../components/auth/BrandLogo'
import {
  ALERT_CLASS,
  CARD_ACCENT,
  CARD_CLASS,
  ERROR_TEXT,
  FADE_RULE,
  fieldClass,
  ICON_CLASS,
  LABEL_CLASS,
  LINK_CLASS,
  PRIMARY_BUTTON,
  PRIMARY_SHEEN,
} from '../components/auth/formStyles'
import { LoginHero } from '../components/auth/LoginHero'
import { useAuth } from '../context/AuthContext'
import { loginSchema, type LoginFormValues } from '../features/auth/schemas'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [apiError, setApiError] = useState('')
  /** Bumped on every failure so the alert remounts and replays its shake. */
  const [errorSeq, setErrorSeq] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  /**
   * Held separately because the caps-lock hint needs its own `onBlur`, and a
   * plain `onBlur={...}` after `{...register('password')}` would silently
   * overwrite the one react-hook-form uses to track touched state.
   */
  const passwordField = register('password')

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
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Login failed. Please try again.'))
      setErrorSeq((seq) => seq + 1)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <LoginHero />

      {/* ── Task column ───────────────────────────────────────────── */}
      <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#fbfcff] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-14 2xl:px-20">
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

        <div className="relative mx-auto w-full max-w-[420px] sm:max-w-[456px] lg:max-w-[400px] xl:max-w-[440px]">
          {/* ── Mobile brand band — stands in for the hidden hero ───── */}
          <div
            className="relative mb-6 overflow-hidden rounded-2xl px-4 py-3.5 shadow-[0_14px_34px_-16px_rgba(76,29,149,0.7)] sm:px-5 sm:py-4 lg:hidden"
            style={{ background: 'linear-gradient(122deg, #4f46e5 0%, #5b21b6 58%, #2a1065 100%)' }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 90% at 92% 0%, rgba(255,255,255,0.16) 0%, transparent 70%)',
              }}
            />

            {/* No logo tile in this band on purpose — the sign-in card below
                carries the mark at every width, and two copies 24px apart
                read as a mistake. The band keeps the name and tagline. */}
            <div className="relative flex items-center gap-3">
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-bold tracking-tight text-white">
                  {BRAND.name}
                </p>
                <p className="truncate text-[11px] font-medium text-white/65">{BRAND.tagline}</p>
              </div>

              <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 sm:inline-flex">
                <span aria-hidden className="auth-pulse h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Online
              </span>
            </div>
          </div>

          {/* ══ LOGO PLACEHOLDER — the brand mark above the sign-in card ════
              tone="bare" means no tile and no plate: the artwork sits straight
              on the page background, so the logo's own silhouette reads rather
              than a white box around it. `fill` lets any aspect ratio use the
              box below without being squashed into a square.

              The PNG/SVG file path is set by BRAND.logoSrc in
              ../components/auth/authContent.ts — change it THERE, not here.

              To resize, change h-20 w-48 below. It sits outside the card so
              the card's own padding does not constrain it. */}
          <BrandLogo tone="bare" fill className="mx-auto mb-7 h-20 w-48" />

          {/* ── Sign-in card ────────────────────────────────────────── */}
          <div
            className={`${CARD_CLASS} max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none`}
          >
            {/* Hairline accent, ties the card back to the brand gradient.
                Back now that nothing straddles the card's top edge. */}
            <div aria-hidden className={`${CARD_ACCENT} max-sm:hidden`} />

            <header className="mb-7 text-center">
              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[30px] xl:text-[32px]">
                Welcome back
              </h1>
              <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                Sign in to pick up your store operations right where you left off.
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className={`mb-1.5 block ${LABEL_CLASS}`}>
                  Business email
                </label>

                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@shop.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    {...register('email')}
                    className={fieldClass({ error: Boolean(errors.email), extra: 'pr-4' })}
                  />
                  <Mail size={17} className={ICON_CLASS} aria-hidden />
                </div>

                {errors.email && (
                  <p id="login-email-error" className={ERROR_TEXT}>
                    <AlertCircle size={13} className="shrink-0" aria-hidden />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                {/* Just the label — the recovery link moved down to the options
                    row, so both fields now open the same way. */}
                <label htmlFor="login-password" className={`mb-1.5 block ${LABEL_CLASS}`}>
                  Password
                </label>

                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      [
                        errors.password ? 'login-password-error' : '',
                        capsLock ? 'login-capslock' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    {...passwordField}
                    onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                    onBlur={(event) => {
                      void passwordField.onBlur(event)
                      setCapsLock(false)
                    }}
                    className={fieldClass({ error: Boolean(errors.password), extra: 'pr-12' })}
                  />
                  <LockKeyhole size={17} className={ICON_CLASS} aria-hidden />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {errors.password && (
                  <p id="login-password-error" className={ERROR_TEXT}>
                    <AlertCircle size={13} className="shrink-0" aria-hidden />
                    {errors.password.message}
                  </p>
                )}

                {/* Caps Lock is the single most common cause of a "wrong
                    password" that is not actually wrong. */}
                {capsLock && !errors.password && (
                  <p
                    id="login-capslock"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600"
                  >
                    <AlertCircle size={13} className="shrink-0" aria-hidden />
                    Caps Lock is on
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className={`text-[13px] ${LINK_CLASS}`}>
                  Forgot password?
                </Link>
              </div>

              {/* Server error — role="alert" so it is announced on arrival */}
              {apiError && (
                <div
                  key={errorSeq}
                  role="alert"
                  className={`auth-shake ${ALERT_CLASS}`}
                >
                  <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{apiError}</span>
                </div>
              )}

              {/* Primary action */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${PRIMARY_BUTTON} mt-1`}
              >
                {/* sheen sweep on hover — transform only, no repaint */}
                <span
                  aria-hidden
                  className={PRIMARY_SHEEN}
                />

                {isSubmitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" aria-hidden />
                    Signing you in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </>
                )}
              </button>
            </form>

            {/* ── Secondary path ────────────────────────────────────── */}
            {/* A hairline that fades at both ends, so the divider stops short
                of the card edge instead of cutting the card in two. */}
            <div
              aria-hidden
              className={`mt-7 ${FADE_RULE}`}
            />

            <p className="pt-5 text-center text-sm text-slate-500">
              New to {BRAND.name}?{' '}
              <Link to="/register" className={LINK_CLASS}>
                Create an account
              </Link>
            </p>
          </div>

          {/* ── Mobile trust strip — the hero's numbers, without the hero ── */}
          <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3.5 lg:hidden">
            {TRUST.map(({ value, short }) => (
              <div key={short} className="min-w-0 text-center">
                <dd className="text-base font-extrabold tracking-tight text-slate-900">{value}</dd>
                <dt className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{short}</dt>
              </div>
            ))}
          </dl>

          {/* One trust signal, not three. */}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 lg:mt-7">
            <ShieldCheck size={13} className="shrink-0" aria-hidden />
            Protected by encrypted sessions
          </p>
        </div>
      </main>
    </div>
  )
}
