/**
 * LoginHero — the brand panel shared by /login, /forgot-password, /reset-password.
 *
 * Responsive strategy
 * -------------------
 * This panel only exists at `lg` and up. Below that it is `display:none` and
 * the form column renders its own compact brand band instead — on a phone the
 * sign-in fields must be the first thing on screen, not a 100vh marketing
 * scroll.
 *
 * Width is not the only axis that matters here. A 1366x768 laptop is *wide
 * enough* for the split but only 768px tall, and this panel is full-height
 * with a lot stacked in it. So the optional blocks are opt-in by height —
 * each is `hidden` by default with an arbitrary min-height variant that
 * switches it back on — and they appear in priority order as the viewport
 * gets taller:
 *
 * (Do not write an example class name in this comment: Tailwind v4 scans
 * source files as plain text and would emit a dead rule for it.)
 *
 *   >= 760px   trust footer
 *   >= 840px   capability pills
 *   >= 900px   floating activity chip
 *
 * The brand, headline, subcopy and proof card are unconditional — they are
 * the panel's job. Below 760px only those four render, which measures well
 * inside a 768px viewport. Shorter than that the panel keeps `min-h-screen`
 * and the page scrolls rather than clipping; the form column is centred in
 * its own `min-h-screen` track, so the sign-in fields stay reachable either
 * way.
 *
 * Performance
 * -----------
 * /login is the app's LCP route: one small SVG brand mark and no other
 * images, no icon font, no `blur()` or `backdrop-filter` (each forces its own
 * composited layer), no imperative DOM injection. Depth comes from layered CSS gradients — one paint. Every
 * animation touches only `opacity`/`transform` and is disabled under
 * prefers-reduced-motion (see index.css).
 *
 * Typography inherits Poppins from `body`.
 */

import { memo } from 'react'
import { BarChart3, CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react'

import { BrandLogo } from './BrandLogo'
import { BRAND, FEATURES, KPIS, TRUST, WEEK, WEEK_SUMMARY } from './authContent'

/* ------------------------------------------------------------------ *
 * Decorative background
 * ------------------------------------------------------------------ */

/**
 * Five layers, all pure CSS gradients:
 *   1. aurora bloom      — slowly drifting colour, the only moving layer
 *   2. static corner wash — anchors the corners so the drift never bares them
 *   3. hairline mesh      — reads as "product surface", not "poster"
 *   4. depth veil         — darkens toward the base so the card can sit on top
 *   5. top sheen          — one highlight, so the panel has a light source
 */
const Backdrop = memo(() => (
  <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <div
      className="auth-drift absolute inset-[-15%]"
      style={{
        background:
          'radial-gradient(ellipse 46% 34% at 18% 12%, rgba(167,139,250,0.42) 0%, transparent 100%),' +
          'radial-gradient(ellipse 40% 30% at 82% 22%, rgba(99,102,241,0.34) 0%, transparent 100%),' +
          'radial-gradient(ellipse 44% 28% at 30% 88%, rgba(139,92,246,0.30) 0%, transparent 100%)',
      }}
    />

    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 58% 40% at 2% -6%, rgba(129,140,248,0.28) 0%, transparent 100%),' +
          'radial-gradient(ellipse 46% 30% at 100% 96%, rgba(217,70,239,0.20) 0%, transparent 100%)',
      }}
    />

    <div
      className="absolute inset-0 opacity-[0.13]"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px),' +
          'linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
        backgroundSize: '38px 38px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 42%, #000 38%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 42%, #000 38%, transparent 100%)',
      }}
    />

    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 32%, rgba(2,2,20,0.34) 100%)',
      }}
    />

    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
  </div>
))
Backdrop.displayName = 'Backdrop'

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

const Brand = memo(() => (
  <div className="auth-rise flex items-center gap-3">
    {/* LOGO PLACEHOLDER (desktop hero) — the PNG/SVG path is set by
        BRAND.logoSrc in ./authContent.ts. Change it there, not here.
        tone="plate" keeps the tile white so a dark/coloured mark stays
        legible against the purple panel; `fill` + p-1.5 lets a wide logo
        use the tile instead of being squeezed into a square. */}
    <BrandLogo
      tone="plate"
      fill
      className="h-12 w-12 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(2,2,30,0.35)]"
    />
    <div className="leading-tight">
      <p className="text-[15px] font-bold tracking-tight text-white">{BRAND.name}</p>
      <p className="text-[11px] font-medium text-white/60">{BRAND.tagline}</p>
    </div>
  </div>
))
Brand.displayName = 'Brand'

const WeeklyChart = memo(() => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 xl:p-3.5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold text-white/90 xl:text-xs">Weekly performance</p>
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-white/55"
      >
        <BarChart3 size={11} />
        Last 7 days
      </span>
    </div>

    {/* Bars and day labels are two parallel rows rather than seven stacked
        columns: it gives the bar track a *definite* height, which is what
        lets each bar's percentage height resolve at all. */}
    <div role="img" aria-label={WEEK_SUMMARY.srLabel}>
      <div aria-hidden className="flex h-[58px] items-end gap-1.5 xl:h-[66px]">
        {WEEK.map(({ pct, day, peak }, i) => (
          <div
            key={`bar-${day}-${i}`}
            className={[
              'auth-grow flex-1 rounded-t-[5px]',
              peak
                ? 'bg-gradient-to-t from-violet-500 via-indigo-400 to-indigo-200 shadow-[0_0_18px_rgba(139,92,246,0.55)]'
                : i >= WEEK.length - 3
                  ? 'bg-white/45'
                  : 'bg-white/20',
            ].join(' ')}
            style={{ height: `${pct}%`, animationDelay: `${380 + i * 55}ms` }}
          />
        ))}
      </div>

      <div aria-hidden className="mt-2 flex gap-1.5">
        {WEEK.map(({ day }, i) => (
          <span
            key={`day-${day}-${i}`}
            className="flex-1 text-center text-[9px] font-semibold uppercase tracking-wider text-white/45"
          >
            {day}
          </span>
        ))}
      </div>
    </div>

    {/* Summary strip — turns the chart from decoration into a readable fact */}
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
      <p className="truncate text-[10px] font-medium text-white/60">
        {WEEK_SUMMARY.peakLabel}{' '}
        <span className="font-bold text-white/90">{WEEK_SUMMARY.peakValue}</span>
      </p>
      <p className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-300">
        <TrendingUp size={11} aria-hidden />
        {WEEK_SUMMARY.delta}
        <span className="font-medium text-white/45">{WEEK_SUMMARY.deltaLabel}</span>
      </p>
    </div>
  </div>
))
WeeklyChart.displayName = 'WeeklyChart'

/**
 * The proof artefact. One card, three numbers, one chart — a believable slice
 * of the dashboard rather than an exhaustive replica of it.
 */
const CommandCenter = memo(() => (
  <div className="relative mb-5">
    {/* soft glow beneath the card; a gradient, not a blur filter */}
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-6 -bottom-6 -top-4"
      style={{
        background:
          'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(124,58,237,0.35) 0%, transparent 70%)',
      }}
    />

    <div
      className="auth-rise relative overflow-hidden rounded-[22px] border border-white/15 bg-[rgba(17,10,48,0.62)] p-3.5 shadow-[0_28px_70px_-20px_rgba(2,2,30,0.8)] xl:p-4"
      style={{ animationDelay: '260ms' }}
      role="region"
      aria-labelledby="hero-card-title"
    >
      {/* inner light source, keeps the glass from reading as flat plastic */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 88% -10%, rgba(255,255,255,0.11) 0%, transparent 60%)',
        }}
      />

      <div className="relative">
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Live overview
            </p>
            <p
              id="hero-card-title"
              className="mt-0.5 truncate text-[13px] font-semibold text-white xl:text-sm"
            >
              Retail command center
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
            <span aria-hidden className="auth-pulse h-1.5 w-1.5 rounded-full bg-emerald-300" />
            System active
          </span>
        </div>

        {/* KPI row */}
        <dl className="mb-2.5 grid grid-cols-3 gap-2">
          {KPIS.map(({ label, value, delta, tone, srLabel }) => (
            <div
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-2 xl:rounded-2xl xl:px-3 xl:py-2.5"
            >
              <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                {label}
              </dt>
              <dd
                className="mt-1 truncate text-[17px] font-bold leading-none tracking-tight text-white xl:text-[19px]"
                aria-label={srLabel}
              >
                {value}
              </dd>
              <dd aria-hidden className={`mt-1 truncate text-[10px] font-semibold ${tone}`}>
                {delta}
              </dd>
            </div>
          ))}
        </dl>

        <WeeklyChart />
      </div>
    </div>

    {/* Floating activity chip — overlaps the card corner to build depth.
        First thing to go on a short viewport. */}
    <div
      className="auth-rise absolute -bottom-3.5 right-4 hidden items-center gap-2 rounded-full border border-white/20 bg-[#241355] px-3 py-1.5 shadow-[0_12px_28px_rgba(2,2,30,0.55)] [@media(min-height:900px)]:flex"
      style={{ animationDelay: '640ms' }}
      role="status"
    >
      <CheckCircle2 size={13} className="shrink-0 text-emerald-300" aria-hidden />
      <span className="whitespace-nowrap text-[11px] font-semibold text-white">
        Invoice <span className="text-white/60">INV-2048</span> generated
      </span>
    </div>
  </div>
))
CommandCenter.displayName = 'CommandCenter'

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

export function LoginHero() {
  return (
    <aside
      aria-label={`About ${BRAND.name}`}
      className="relative hidden overflow-hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:gap-6 lg:px-9 lg:py-7 xl:gap-8 xl:px-14 xl:py-10 2xl:px-20"
      style={{
        background: 'linear-gradient(152deg, #4f46e5 0%, #4c1d95 52%, #2a1065 100%)',
        contain: 'layout paint',
      }}
    >
      <Backdrop />

      {/* ── Top: brand ─────────────────────────────────────────────── */}
      <div className="relative z-10">
        <Brand />
      </div>

      {/* ── Middle: the message, then the proof ────────────────────── */}
      <div className="relative z-10 w-full max-w-[520px] xl:max-w-[560px]">
        <p
          className="auth-rise mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 xl:mb-5 xl:tracking-[0.18em]"
          style={{ animationDelay: '60ms' }}
        >
          <ShieldCheck size={12} strokeWidth={2.6} />
          Smart retail operations
        </p>

        <h1
          className="auth-rise text-[clamp(1.5rem,2.1vw,2.25rem)] font-extrabold leading-[1.13] tracking-[-0.03em] text-white"
          style={{ animationDelay: '110ms' }}
        >
          Billing, stock and store performance —{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(92deg,#e9d5ff 0%,#c4b5fd 46%,#a5f3fc 100%)',
            }}
          >
            one command center.
          </span>
        </h1>

        <p
          className="auth-rise mt-3 max-w-[50ch] text-[13px] leading-relaxed text-white/70 xl:mt-4 xl:text-sm"
          style={{ animationDelay: '160ms' }}
        >
          One workspace to move inventory, raise invoices and read the
          day&apos;s numbers — without switching tools.
        </p>

        {/* Capability pills — second to go on a short viewport */}
        <ul
          className="auth-rise mt-4 hidden flex-wrap gap-2 xl:mt-5 [@media(min-height:840px)]:flex"
          style={{ animationDelay: '210ms' }}
          aria-label="Core capabilities"
        >
          {FEATURES.map(({ label, Icon }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.08] py-1.5 pl-1.5 pr-3 text-[11px] font-semibold text-white/90 xl:text-xs"
            >
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/12 text-white"
              >
                <Icon size={12} strokeWidth={2.4} />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <CommandCenter />
        </div>
      </div>

      {/* ── Bottom: proof numbers. Last to go on a short viewport. ─── */}
      <div
        className="auth-rise relative z-10 hidden [@media(min-height:760px)]:block"
        style={{ animationDelay: '320ms' }}
      >
        <dl className="flex flex-wrap items-start gap-x-7 gap-y-4 border-t border-white/12 pt-5 xl:gap-x-9 xl:pt-6">
          {TRUST.map(({ value, label }) => (
            <div key={label}>
              <dd className="text-lg font-extrabold tracking-tight text-white xl:text-xl">
                {value}
              </dd>
              <dt className="mt-0.5 text-[11px] font-medium text-white/55">{label}</dt>
            </div>
          ))}

          <p className="ml-auto hidden self-end text-[11px] font-medium text-white/45 2xl:block">
            Built for modern retail teams
          </p>
        </dl>
      </div>
    </aside>
  )
}
