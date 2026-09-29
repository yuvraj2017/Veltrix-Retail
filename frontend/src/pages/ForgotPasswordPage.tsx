/**
 * ForgotPasswordPage — request a reset link.
 *
 * Deliberately built from the same parts as LoginPage: the hero panel on the
 * left from `lg`, one centred column on the right, the brand mark bare above
 * a single card, and every field/button class pulled from ./formStyles. The
 * two screens are one step apart in the same flow, so they should not look
 * like two different products.
 *
 * The response is intentionally identical whether or not the address exists,
 * which is why the copy says so out loud — otherwise this form is an account
 * enumeration oracle.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
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
  LABEL_CLASS,
  LINK_CLASS,
  PRIMARY_BUTTON,
  PRIMARY_SHEEN,
  SECONDARY_BUTTON,
} from '../components/auth/formStyles'
import { LoginHero } from '../components/auth/LoginHero'
import { forgotPassword } from '../features/auth/api'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../features/auth/schemas'
import { getApiErrorMessage } from '../lib/api-error'

export default function ForgotPasswordPage() {
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      setApiError('')
      setIsSubmitting(true)
      const response = await forgotPassword({ email: values.email })
      setSubmittedEmail(values.email)
      setSuccessMessage(response.message)
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Unable to process your request right now.'))
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
          {/* ══ LOGO PLACEHOLDER — the brand mark above the card ════════════
              Same treatment as the login screen: tone="bare" means no tile, so
              the artwork sits straight on the page background.

              The PNG/SVG file path is set by BRAND.logoSrc in
              ../components/auth/authContent.ts — change it THERE, not here. */}
          <BrandLogo tone="bare" fill className="mx-auto mb-7 h-20 w-48" />

          <div className={CARD_CLASS}>
            <div aria-hidden className={CARD_ACCENT} />

            {!successMessage ? (
              <>
                <header className="mb-7 text-center">
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-600">
                    <ShieldCheck size={12} aria-hidden />
                    Password recovery
                  </span>

                  <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[30px]">
                    Reset your password
                  </h1>
                  <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                    Enter the email on your account and we will send a secure reset link.
                  </p>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  <div>
                    <label htmlFor="forgot-email" className={`mb-1.5 block ${LABEL_CLASS}`}>
                      Business email
                    </label>

                    <div className="relative">
                      <input
                        id="forgot-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="you@shop.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                        {...register('email')}
                        className={fieldClass({ error: Boolean(errors.email), extra: 'pr-4' })}
                      />

                      {/* After the input on purpose — `peer-focus:` compiles to
                          a sibling selector and cannot look backwards. */}
                      <Mail size={17} className={ICON_CLASS} aria-hidden />
                    </div>

                    {errors.email && (
                      <p id="forgot-email-error" className={ERROR_TEXT}>
                        <AlertCircle size={13} className="shrink-0" aria-hidden />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Says the quiet part out loud: the reply is the same either
                      way, so a non-answer is not read as "no such account". */}
                  <p className="rounded-2xl border border-slate-200/90 bg-slate-50/70 px-4 py-3 text-[13px] leading-relaxed text-slate-500">
                    For your security the response is the same whether or not this address is
                    registered.
                  </p>

                  {apiError && (
                    <div role="alert" className={ALERT_CLASS}>
                      <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
                      <span className="min-w-0 break-words">{apiError}</span>
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting} className={`${PRIMARY_BUTTON} mt-1`}>
                    <span aria-hidden className={PRIMARY_SHEEN} />

                    {isSubmitting ? (
                      <>
                        <Loader2 size={17} className="animate-spin" aria-hidden />
                        Sending reset link…
                      </>
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight
                          size={17}
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* ── Sent ─────────────────────────────────────────────── */
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                  <CheckCircle2 size={26} aria-hidden />
                </span>

                <h1 className="mt-5 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[28px]">
                  Check your email
                </h1>

                <p
                  role="status"
                  className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-slate-500 sm:text-[15px]"
                >
                  {successMessage}
                </p>

                <div className="mt-6 rounded-2xl border border-slate-200/90 bg-slate-50/70 px-4 py-3.5 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Sent to
                  </p>
                  <p className="mt-1.5 break-all text-sm font-semibold text-slate-800">
                    {submittedEmail}
                  </p>
                </div>

                <ul className="mt-4 space-y-2 text-left">
                  <Hint text="Check your spam or junk folder if it does not arrive." />
                  <Hint text="The link is single-use and expires after 30 minutes." />
                </ul>

                <div className="mt-7 space-y-3">
                  <Link to="/login" className={PRIMARY_BUTTON}>
                    <span aria-hidden className={PRIMARY_SHEEN} />
                    Back to sign in
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSuccessMessage('')
                      setSubmittedEmail('')
                    }}
                    className={SECONDARY_BUTTON}
                  >
                    Send another link
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Way back ──────────────────────────────────────────────── */}
          <div aria-hidden className={`mt-7 ${FADE_RULE}`} />

          <p className="pt-5 text-center text-sm text-slate-500">
            <Link to="/login" className={`inline-flex items-center gap-1.5 ${LINK_CLASS}`}>
              <ArrowLeft size={15} aria-hidden />
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

/** One reassurance line in the sent state. */
function Hint({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0">{text}</span>
    </li>
  )
}
