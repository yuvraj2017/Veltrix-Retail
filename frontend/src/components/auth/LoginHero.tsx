/**
 * LoginHero.tsx — StoreMitraa Retail
 * ─────────────────────────────────────────────────────────────────────────────
 * TARGET: FCP < 0.4s | LCP < 0.4s | Speed Index < 1.0s
 *
 * FIXES APPLIED:
 * ✅ Zero Google Fonts — pure system font stack, no network requests
 * ✅ Zero @import anywhere — KF string is @keyframes + @media only
 * ✅ All animations via inline `style` prop — zero dependency on index.css
 * ✅ contain:'layout paint' — no iOS scroll breakage
 * ✅ BgLayers via requestIdleCallback — runs after LCP, never blocks FCP
 */

import { memo, type FC, useEffect, useLayoutEffect, useRef } from 'react'

// ─── System font stack ────────────────────────────────────────────────────────
// Zero network cost. Renders in the very first paint.
const F = 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif'

// ─── Animation helpers ────────────────────────────────────────────────────────
const SPRING = 'cubic-bezier(0.22,1,0.36,1)'

const fadeUp = (delayS: number, durationS = 0.45): React.CSSProperties => ({
  animation: `sm-fade ${durationS}s ${SPRING} ${delayS}s both`,
})

// ─── Keyframes ────────────────────────────────────────────────────────────────
// NO @import. Only @keyframes and @media. Nothing causes a network request.
const KF = `
@keyframes sm-fade {
  from { opacity: 0; transform: translateY(12px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes sm-bar-in {
  from { transform: scaleY(0) }
  to   { transform: scaleY(1) }
}
@keyframes sm-pulse {
  0%, 100% { opacity: 1 }
  50%       { opacity: 0.28 }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
const Ico = (d: string, size = 16, sw = 2) => () => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false"
    style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
)

const IconSparkles = Ico('M12 3l1.912 5.813L20 9l-4.5 3.912L17 18l-5-3-5 3 1.5-5.088L4 9l6.088-.187z')
const IconShield   = Ico('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 12, 2)

const IconCreditCard: FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
)
const IconBoxes = Ico('M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', 14)

const IconTrendingUp: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)
const IconBarChart: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <rect x="2" y="2" width="20" height="20" rx="2" />
    <line x1="7" y1="22" x2="7" y2="13" />
    <line x1="12" y1="22" x2="12" y2="8" />
    <line x1="17" y1="22" x2="17" y2="18" />
  </svg>
)
const IconWallet: FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
)

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  w08: 'rgba(255,255,255,0.08)',
  w10: 'rgba(255,255,255,0.10)',
  w12: 'rgba(255,255,255,0.12)',
  w15: 'rgba(255,255,255,0.15)',
  w18: 'rgba(255,255,255,0.18)',
  emerald:       '#6ee7b7',
  emeraldBg:     'rgba(52,211,153,0.14)',
  emeraldBorder: 'rgba(110,231,183,0.28)',
  amber:         '#fcd34d',
  indigo100:     '#e0e7ff',
  muted:         'rgba(255,255,255,0.68)',
  mutedSub:      'rgba(255,255,255,0.56)',
  cell:          'rgba(2,4,18,0.38)',
  focus:         '#a5b4fc',
  base:          '#3730a3',
} as const

// ─── Static data ──────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Today Sales', value: '₹24,580', sub: '+12.4%',         color: T.emerald,   aria: 'Today sales ₹24,580, up 12.4%' },
  { label: 'Orders',      value: '148',     sub: 'Live counter',    color: T.indigo100, aria: '148 orders, live counter' },
  { label: 'Low Stock',   value: '06',      sub: 'Needs attention', color: T.amber,     aria: '6 items low on stock, needs attention' },
] as const

const FEATURES: { label: string; Icon: FC }[] = [
  { label: 'Fast Billing',      Icon: IconCreditCard },
  { label: 'Inventory Control', Icon: IconBoxes },
  { label: 'Sales Insights',    Icon: IconTrendingUp },
]

const BARS = [
  { v: 42, d: 'M', hi: false, peak: false },
  { v: 65, d: 'T', hi: false, peak: false },
  { v: 54, d: 'W', hi: false, peak: false },
  { v: 78, d: 'T', hi: false, peak: false },
  { v: 70, d: 'F', hi: true,  peak: false },
  { v: 92, d: 'S', hi: true,  peak: false },
  { v: 88, d: 'S', hi: false, peak: true  },
] as const

const BAR_ARIA = 'Weekly sales: Mon 42%, Tue 65%, Wed 54%, Thu 78%, Fri 70%, Sat 92%, Sun 88%'

const OPS = [
  { cat: 'Billing',   text: 'Generate invoice in seconds' },
  { cat: 'Inventory', text: 'Auto stock deduction after sale' },
  { cat: 'Reports',   text: 'Daily insights with low-stock alerts' },
] as const

const FOOTER_STATS = [
  { num: '10k+',  label: 'Retail actions processed' },
  { num: '99.9%', label: 'Operational reliability' },
  { num: '24/7',  label: 'Access to store data' },
] as const

const BAR_FILL = {
  default: 'rgba(255,255,255,0.20)',
  hi:      'rgba(255,255,255,0.40)',
  peak:    'linear-gradient(to top,#a855f7,#818cf8,#a5b4fc)',
} as const

const FOCUS_ON:  React.CSSProperties = { outline: `2px solid ${T.focus}`, outlineOffset: '2px' }
const FOCUS_OFF: React.CSSProperties = { outline: 'none' }

// ─── Logo ─────────────────────────────────────────────────────────────────────
const Logo = memo(() => (
  <div style={fadeUp(0.05)}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.625rem',
      borderRadius: '1rem', border: `1px solid ${T.w15}`,
      background: 'rgba(255,255,255,0.12)',
      padding: '0.5rem 0.75rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      <div aria-hidden="true" style={{
        width: '2.25rem', height: '2.25rem', flexShrink: 0,
        borderRadius: '0.625rem', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,rgba(255,255,255,0.26),rgba(255,255,255,0.09))',
        color: '#fff', outline: `1px solid ${T.w15}`,
      }}>
        <IconSparkles />
      </div>
      <div>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', margin: 0, fontFamily: F }}>
          StoreMitraa Retail
        </p>
        <p style={{ fontSize: '0.6875rem', color: T.mutedSub, margin: 0, fontFamily: F }}>
          Next-gen retail management
        </p>
      </div>
    </div>
  </div>
))
Logo.displayName = 'Logo'

// ─── Feature chips ────────────────────────────────────────────────────────────
const FeatureChips = memo(() => (
  <ul
    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1.25rem 0 0', listStyle: 'none', padding: 0, ...fadeUp(0.30) }}
    aria-label="Key features"
  >
    {FEATURES.map(({ label, Icon }) => (
      <li
        key={label}
        tabIndex={0}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          borderRadius: '0.75rem', border: `1px solid ${T.w12}`, background: T.w10,
          padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.92)',
          fontSize: '0.75rem', fontWeight: 500, cursor: 'default',
          transition: 'background 0.15s ease', fontFamily: F,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.w18 }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.w10 }}
        onFocus={e    => Object.assign((e.currentTarget as HTMLElement).style, FOCUS_ON)}
        onBlur={e     => Object.assign((e.currentTarget as HTMLElement).style, FOCUS_OFF)}
      >
        <span aria-hidden="true" style={{
          display: 'flex', width: '1.75rem', height: '1.75rem', flexShrink: 0,
          alignItems: 'center', justifyContent: 'center',
          borderRadius: '0.5rem', background: T.w12, color: '#fff',
        }}>
          <Icon />
        </span>
        {label}
      </li>
    ))}
  </ul>
))
FeatureChips.displayName = 'FeatureChips'

// ─── Stats grid ───────────────────────────────────────────────────────────────
const StatsGrid = memo(() => (
  <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.625rem', marginBottom: '0.75rem' }}>
    {STATS.map(({ label, value, sub, color, aria }) => (
      <div key={label} style={{
        borderRadius: '0.75rem', border: `1px solid ${T.w12}`,
        background: T.cell, padding: '0.625rem 0.75rem',
      }}>
        <dt style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted, margin: 0, fontFamily: F }}>
          {label}
        </dt>
        <dd style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0.375rem 0 0', fontFamily: F }}
          aria-label={aria}>{value}</dd>
        <dd aria-hidden="true" style={{ fontSize: '0.6875rem', color, margin: '0.125rem 0 0', fontFamily: F }}>
          {sub}
        </dd>
      </div>
    ))}
  </dl>
))
StatsGrid.displayName = 'StatsGrid'

// ─── Bar chart ────────────────────────────────────────────────────────────────
const WeeklyBarChart = memo(() => (
  <div style={{ borderRadius: '0.75rem', border: `1px solid ${T.w12}`, background: T.cell, padding: '0.75rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255,255,255,0.92)', margin: 0, fontFamily: F }}>
        Weekly Performance
      </p>
      <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.625rem', color: T.muted, fontFamily: F }}>
        <IconBarChart /> Last 7 Days
      </span>
    </div>
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', height: '5.5rem' }}
      role="img" aria-label={BAR_ARIA}
    >
      {BARS.map(({ v, d, hi, peak }, i) => (
        <div key={i} aria-hidden="true"
          style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{
            width: '100%',
            height: `${v}%`,
            borderRadius: '0.25rem 0.25rem 0 0',
            background: peak ? BAR_FILL.peak : hi ? BAR_FILL.hi : BAR_FILL.default,
            transformOrigin: 'bottom',
            animation: `sm-bar-in 0.55s ${SPRING} ${0.38 + i * 0.055}s both`,
            ...(peak ? { boxShadow: '0 4px 14px rgba(147,51,234,0.45)' } : {}),
          }} />
          <span style={{ fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: T.muted, fontFamily: F }}>
            {d}
          </span>
        </div>
      ))}
    </div>
  </div>
))
WeeklyBarChart.displayName = 'WeeklyBarChart'

// ─── Ops flow ─────────────────────────────────────────────────────────────────
const OpsFlow = memo(() => (
  <div
    style={{ borderRadius: '0.75rem', border: `1px solid ${T.w12}`, background: T.cell, padding: '0.75rem' }}
    role="region" aria-label="Operations flow"
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255,255,255,0.92)', margin: 0, fontFamily: F }}>
        Operations Flow
      </p>
      <span aria-hidden="true" style={{ color: T.muted }}><IconWallet /></span>
    </div>
    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}
      aria-label="Core operations">
      {OPS.map(({ cat, text }) => (
        <li
          key={cat}
          style={{
            borderRadius: '0.75rem', border: `1px solid ${T.w12}`,
            background: T.w08, padding: '0.5rem 0.75rem',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.w15 }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.w08 }}
        >
          <p style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, margin: 0, fontFamily: F }}>{cat}</p>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#fff', margin: '0.125rem 0 0', fontFamily: F }}>{text}</p>
        </li>
      ))}
    </ul>
  </div>
))
OpsFlow.displayName = 'OpsFlow'

// ─── Dashboard card ───────────────────────────────────────────────────────────
const DashboardCard = memo(() => (
  <div style={{
    position: 'relative', marginTop: '1.5rem', width: '100%',
    contentVisibility: 'auto',
    containIntrinsicSize: '0 420px',
    ...fadeUp(0.36, 0.56),
  }}>
    <div
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: '1.25rem', border: `1px solid ${T.w12}`,
        background: 'rgba(15,10,45,0.94)',
        padding: '1rem',
        boxShadow: '0 12px 40px rgba(20,10,70,0.50)',
      }}
      role="region" aria-labelledby="sm-cmd-title"
    >
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 85% 0%,rgba(255,255,255,0.06) 0%,transparent 52%)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <p aria-hidden="true" style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.22em', color: T.muted, margin: 0, fontFamily: F }}>
              Live overview
            </p>
            <p id="sm-cmd-title" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', margin: '0.125rem 0 0', fontFamily: F }}>
              Retail command center
            </p>
          </div>
          <div
            style={{
              display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: '0.375rem',
              borderRadius: '9999px', border: `1px solid ${T.emeraldBorder}`,
              background: T.emeraldBg, padding: '0.25rem 0.625rem',
              fontSize: '0.625rem', fontWeight: 500, color: '#d1fae5', fontFamily: F,
            }}
            role="status" aria-live="polite" aria-label="System is active"
          >
            <span aria-hidden="true" style={{
              display: 'inline-block', width: '0.375rem', height: '0.375rem',
              borderRadius: '50%', background: T.emerald,
              animation: 'sm-pulse 2.4s ease-in-out infinite',
              willChange: 'opacity',
            }} />
            System Active
          </div>
        </div>
        <StatsGrid />
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.625rem' }}>
          <WeeklyBarChart />
          <OpsFlow />
        </div>
      </div>
    </div>
  </div>
))
DashboardCard.displayName = 'DashboardCard'

// ─── Footer stats ─────────────────────────────────────────────────────────────
const FooterStats = memo(() => (
  <footer style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px', ...fadeUp(0.42) }}>
    <dl style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.75rem', margin: '0 0 0.75rem' }}>
      {FOOTER_STATS.map(({ num, label }) => (
        <div key={label}>
          <dd style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0, fontFamily: F }}>{num}</dd>
          <dt style={{ fontSize: '0.75rem', color: T.muted, margin: 0, fontFamily: F }}>{label}</dt>
        </div>
      ))}
    </dl>
    <p style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.50)', margin: 0, fontFamily: F }}>
      Built for modern retail teams
    </p>
  </footer>
))
FooterStats.displayName = 'FooterStats'

// ─── Background layers ────────────────────────────────────────────────────────
// Injected only on idle — never touches FCP or LCP.
const BgLayers = memo(({ ref: sectionRef }: { ref: React.RefObject<HTMLElement | null> }) => {
  useLayoutEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const inject = () => {
      if (el.querySelector('[data-bg-layers]')) return
      const wrap = document.createElement('div')
      wrap.setAttribute('data-bg-layers', '')
      wrap.setAttribute('aria-hidden', 'true')
      wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0'
      const mesh = document.createElement('div')
      mesh.style.cssText = 'position:absolute;inset:0;opacity:.12;background-image:linear-gradient(to right,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.06) 1px,transparent 1px);background-size:40px 40px'
      const depth = document.createElement('div')
      depth.style.cssText = 'position:absolute;inset:0;background:linear-gradient(175deg,rgba(255,255,255,.03) 0%,transparent 38%,rgba(0,0,0,.22) 100%)'
      const corners = document.createElement('div')
      corners.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse 58% 38% at 4% 0%,rgba(167,139,250,.24) 0%,transparent 100%),radial-gradient(ellipse 52% 32% at 96% 4%,rgba(99,102,241,.20) 0%,transparent 100%),radial-gradient(ellipse 48% 28% at 8% 96%,rgba(139,92,246,.18) 0%,transparent 100%),radial-gradient(ellipse 42% 26% at 92% 92%,rgba(167,139,250,.14) 0%,transparent 100%)'
      wrap.append(mesh, depth, corners)
      el.appendChild(wrap)
    }
    if ('requestIdleCallback' in window) {
      requestIdleCallback(inject, { timeout: 2000 })
    } else {
      setTimeout(inject, 200)
    }
  }, [sectionRef])
  return null
})
BgLayers.displayName = 'BgLayers'

// ─── Root component ────────────────────────────────────────────────────────────
export function LoginHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const kfInjected = useRef(false)

  // Inject keyframes after first paint.
  // KF has zero @import — no network fetch triggered.
  useEffect(() => {
    if (kfInjected.current || document.getElementById('sm-kf')) return
    kfInjected.current = true
    const s = document.createElement('style')
    s.id = 'sm-kf'
    s.textContent = KF
    document.head.appendChild(s)
  }, [])

  return (
    <main aria-labelledby="hero-headline" style={{ fontFamily: F }}>
      <section
        ref={sectionRef}
        aria-label="StoreMitraa Retail hero"
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          background: T.base,
          padding: '1.5rem',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.5rem',
          boxSizing: 'border-box',
          // 'layout paint' instead of 'strict' — avoids iOS scroll bug
          contain: 'layout paint',
          fontFamily: F,
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
          <Logo />

          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Badge */}
            <p style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              borderRadius: '9999px', border: `1px solid ${T.w15}`,
              background: 'rgba(255,255,255,0.13)',
              padding: '0.375rem 0.75rem',
              fontSize: '0.625rem', fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.92)',
              marginBottom: '0.75rem', width: 'fit-content',
              fontFamily: F,
              ...fadeUp(0.10),
            }} aria-hidden="true">
              <IconShield /> Smart Retail Operations
            </p>

            {/* ── LCP CANDIDATE ─────────────────────────────────────────────
                System fonts = renders in the FIRST paint, no network wait.
            ──────────────────────────────────────────────────────────────── */}
            <h1 id="hero-headline" style={{
              fontSize: 'clamp(1.35rem,4vw,2.1rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#fff',
              margin: 0,
              fontFamily: F,
              ...fadeUp(0.16, 0.52),
            }}>
              Run billing, stock, and store performance from one command center.
            </h1>

            <p style={{
              marginTop: '0.75rem',
              fontSize: 'clamp(0.8rem,2vw,0.9rem)',
              lineHeight: 1.65,
              color: 'rgba(255,255,255,0.88)',
              fontFamily: F,
              ...fadeUp(0.24),
            }}>
              StoreMitraa gives your retail team a single, premium workspace to manage
              inventory, generate bills, monitor sales, and keep operations moving without friction.
            </p>

            <FeatureChips />
            <DashboardCard />
          </div>

          <FooterStats />
        </div>

        {/* BgLayers fires only on idle — never touches FCP or LCP */}
        <BgLayers ref={sectionRef} />
      </section>
    </main>
  )
}