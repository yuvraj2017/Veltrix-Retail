import { memo, type FC } from 'react'

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
const IconSparkles: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <path d="M12 3l1.912 5.813L20 9l-4.5 3.912L17 18l-5-3-5 3 1.5-5.088L4 9l6.088-.187z" />
  </svg>
)
const IconShield: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)
const IconCreditCard: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
)
const IconBoxes: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
  </svg>
)
const IconTrendingUp: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
)
const IconBarChart: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <rect x="2" y="2" width="20" height="20" rx="2" />
    <line x1="7" y1="22" x2="7" y2="13" /><line x1="12" y1="22" x2="12" y2="8" /><line x1="17" y1="22" x2="17" y2="18" />
  </svg>
)
const IconWallet: FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
)

// ─── Design tokens (inline rgba/hex — immune to Tailwind JIT purge) ───────────
const T = {
  white10:        'rgba(255,255,255,0.10)',
  white12:        'rgba(255,255,255,0.12)',
  white15:        'rgba(255,255,255,0.15)',
  white18:        'rgba(255,255,255,0.18)',
  white30:        'rgba(255,255,255,0.30)',
  emerald:        '#6ee7b7',
  emeraldBg:      'rgba(52,211,153,0.15)',
  emeraldBorder:  'rgba(110,231,183,0.25)',
  amber:          '#fcd34d',
  indigo100:      '#e0e7ff',
  darkCell:       'rgba(2,4,18,0.35)',
  sectionBg: [
    'radial-gradient(circle at top left,  rgba(167,139,250,0.35), transparent 28%)',
    'radial-gradient(circle at top right, rgba(99,102,241,0.30),  transparent 28%)',
    'radial-gradient(circle at bottom left, rgba(139,92,246,0.28), transparent 32%)',
    'linear-gradient(135deg, #4f46e5 0%, #5b4ff1 20%, #6d3df5 45%, #5b21b6 72%, #312e81 100%)',
  ].join(', '),
} as const

// Keyframes injected once — avoids Tailwind purge risk
const KEYFRAMES = `
  @keyframes sm-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:0.01ms!important; transition-duration:0.01ms!important; }
  }
`

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Stat { label: string; value: string; sub: string; subColor: string; ariaLabel?: string }
const stats: Stat[] = [
  { label: 'Today Sales', value: '₹24,580', sub: '+12.4%',         subColor: T.emerald,   ariaLabel: 'Up 12.4 percent' },
  { label: 'Orders',      value: '148',     sub: 'Live counter',    subColor: T.indigo100 },
  { label: 'Low Stock',   value: '06',      sub: 'Needs attention', subColor: T.amber,     ariaLabel: '6 items'         },
]

interface Feature { label: string; Icon: FC }
const features: Feature[] = [
  { label: 'Fast Billing',      Icon: IconCreditCard },
  { label: 'Inventory Control', Icon: IconBoxes      },
  { label: 'Sales Insights',    Icon: IconTrendingUp },
]

interface Bar { value: number; day: string; variant: 'default' | 'hi' | 'peak' }
const weeklyBars: Bar[] = [
  { value: 42, day: 'M', variant: 'default' },
  { value: 65, day: 'T', variant: 'default' },
  { value: 54, day: 'W', variant: 'default' },
  { value: 78, day: 'T', variant: 'default' },
  { value: 70, day: 'F', variant: 'hi'      },
  { value: 92, day: 'S', variant: 'hi'      },
  { value: 88, day: 'S', variant: 'peak'    },
]
const BAR_ARIA = 'Weekly sales chart: Mon 42%, Tue 65%, Wed 54%, Thu 78%, Fri 70%, Sat 92% (peak), Sun 88%'

interface Op { cat: string; text: string }
const ops: Op[] = [
  { cat: 'Billing',   text: 'Generate invoice in seconds'         },
  { cat: 'Inventory', text: 'Auto stock deduction after sale'     },
  { cat: 'Reports',   text: 'Daily insights with low-stock alerts'},
]

interface FooterStat { num: string; label: string }
const footerStats: FooterStat[] = [
  { num: '10k+',  label: 'Retail actions processed' },
  { num: '99.9%', label: 'Operational reliability'  },
  { num: '24/7',  label: 'Access to store data'     },
]

// ─── Bar styles ───────────────────────────────────────────────────────────────
const barStyle: Record<Bar['variant'], React.CSSProperties> = {
  default: { background: 'rgba(255,255,255,0.22)' },
  hi:      { background: 'rgba(255,255,255,0.40)' },
  peak:    { background: 'linear-gradient(to top,#a855f7,#818cf8,#a5b4fc)', boxShadow: '0 6px 18px rgba(147,51,234,0.50)' },
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
const Logo = memo(() => (
  <div>
    <div style={{ display:'inline-flex', alignItems:'center', gap:'0.625rem',
      borderRadius:'1rem', border:`1px solid ${T.white15}`, background:T.white10,
      padding:'0.5rem 0.75rem', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      boxShadow:'0 12px 32px rgba(0,0,0,0.20)' }}
      aria-label="StoreMitraa Retail – Next-gen retail management">
      <div style={{ width:'2.25rem', height:'2.25rem', flexShrink:0,
        borderRadius:'0.625rem', display:'flex', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))',
        color:'#fff', boxShadow:'0 8px 20px rgba(99,102,241,0.38)',
        outline:`1px solid ${T.white15}` }}>
        <IconSparkles />
      </div>
      <div>
        <p style={{ fontSize:'0.9rem', fontWeight:700, letterSpacing:'-0.02em', color:'#fff', margin:0 }}>
          StoreMitraa Retail
        </p>
        <p style={{ fontSize:'0.6875rem', color:'rgba(255,255,255,0.70)', margin:0 }}>
          Next-gen retail management
        </p>
      </div>
    </div>
  </div>
))
Logo.displayName = 'Logo'

// ─── Feature chips ────────────────────────────────────────────────────────────
const FeatureChips = memo(() => (
  <ul style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'1.25rem', listStyle:'none', padding:0 }}
    aria-label="Key features">
    {features.map(({ label, Icon }) => (
      <li key={label}
        style={{ display:'flex', alignItems:'center', gap:'0.5rem',
          borderRadius:'0.75rem', border:`1px solid ${T.white12}`, background:T.white10,
          padding:'0.5rem 0.75rem', color:'rgba(255,255,255,0.90)',
          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          fontSize:'0.75rem', fontWeight:500, cursor:'default',
          transition:'transform 0.25s ease, background 0.25s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.background=T.white18 }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='translateY(0)'; (e.currentTarget as HTMLElement).style.background=T.white10 }}>
        <span style={{ display:'flex', width:'1.75rem', height:'1.75rem', flexShrink:0,
          alignItems:'center', justifyContent:'center',
          borderRadius:'0.5rem', background:T.white12, color:'#fff' }}>
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
  <dl style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.625rem', marginBottom:'0.75rem' }}>
    {stats.map(({ label, value, sub, subColor, ariaLabel }) => (
      <div key={label} style={{ borderRadius:'0.75rem', border:`1px solid ${T.white12}`,
        background:T.darkCell, padding:'0.625rem 0.75rem' }}>
        <dt style={{ fontSize:'0.5625rem', textTransform:'uppercase', letterSpacing:'0.16em',
          color:'rgba(255,255,255,0.50)', margin:0 }}>{label}</dt>
        <dd style={{ fontSize:'1.25rem', fontWeight:700, color:'#fff', margin:'0.375rem 0 0' }}
          aria-label={ariaLabel}>{value}</dd>
        <dd style={{ fontSize:'0.6875rem', color:subColor, margin:'0.125rem 0 0' }}>{sub}</dd>
      </div>
    ))}
  </dl>
))
StatsGrid.displayName = 'StatsGrid'

// ─── Bar chart (pure CSS, zero chart lib) ────────────────────────────────────
const WeeklyBarChart = memo(() => (
  <div style={{ borderRadius:'0.75rem', border:`1px solid ${T.white12}`, background:T.darkCell, padding:'0.75rem' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
      <p style={{ fontSize:'0.75rem', fontWeight:500, color:'rgba(255,255,255,0.85)', margin:0 }}>Weekly Performance</p>
      <span style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.625rem', color:'rgba(255,255,255,0.50)' }}>
        <IconBarChart /> Last 7 Days
      </span>
    </div>
    <div style={{ display:'flex', alignItems:'flex-end', gap:'0.25rem', height:'5.5rem' }}
      role="img" aria-label={BAR_ARIA}>
      {weeklyBars.map(({ value, day, variant }, idx) => (
        <div key={idx} style={{ display:'flex', flex:1, flexDirection:'column', alignItems:'center', gap:'0.375rem' }}>
          <div style={{ width:'100%', height:`${value}%`, borderRadius:'0.25rem 0.25rem 0 0',
            transition:'height 0.5s ease', ...barStyle[variant] }} />
          <span style={{ fontSize:'0.5rem', textTransform:'uppercase', letterSpacing:'0.12em',
            color:'rgba(255,255,255,0.50)' }} aria-hidden="true">{day}</span>
        </div>
      ))}
    </div>
  </div>
))
WeeklyBarChart.displayName = 'WeeklyBarChart'

// ─── Ops flow ─────────────────────────────────────────────────────────────────
const OpsFlow = memo(() => (
  <div style={{ borderRadius:'0.75rem', border:`1px solid ${T.white12}`, background:T.darkCell, padding:'0.75rem' }}
    role="region" aria-label="Operations flow">
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
      <p style={{ fontSize:'0.75rem', fontWeight:500, color:'rgba(255,255,255,0.85)', margin:0 }}>Operations Flow</p>
      <span style={{ color:'rgba(255,255,255,0.50)' }}><IconWallet /></span>
    </div>
    <ul style={{ display:'flex', flexDirection:'column', gap:'0.5rem', listStyle:'none', padding:0, margin:0 }}
      aria-label="Core operations">
      {ops.map(({ cat, text }) => (
        <li key={cat} style={{ borderRadius:'0.75rem', border:`1px solid ${T.white12}`,
          background:'rgba(255,255,255,0.09)', padding:'0.5rem 0.75rem' }}>
          <p style={{ fontSize:'0.5625rem', textTransform:'uppercase', letterSpacing:'0.14em',
            color:'rgba(255,255,255,0.42)', margin:0 }}>{cat}</p>
          <p style={{ fontSize:'0.75rem', fontWeight:500, color:'#fff', margin:'0.125rem 0 0' }}>{text}</p>
        </li>
      ))}
    </ul>
  </div>
))
OpsFlow.displayName = 'OpsFlow'

// ─── Dashboard card ───────────────────────────────────────────────────────────
const DashboardCard = memo(() => (
  <div style={{ position:'relative', marginTop:'1.5rem', width:'100%' }}>
    <div style={{ position:'relative', overflow:'hidden',
      borderRadius:'1.25rem', border:`1px solid ${T.white12}`,
      background:'rgba(255,255,255,0.11)', padding:'1rem',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      boxShadow:'0 20px 60px rgba(29,16,84,0.40)' }}
      role="region" aria-label="Retail command center – Live overview">
      {/* Inner highlight */}
      <div aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(circle at top right,rgba(255,255,255,0.14),transparent 28%)' }} />

      <div style={{ position:'relative' }}>
        {/* Header */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between',
          gap:'0.5rem', marginBottom:'1rem' }}>
          <div>
            <p style={{ fontSize:'0.625rem', fontWeight:600, textTransform:'uppercase',
              letterSpacing:'0.22em', color:'rgba(255,255,255,0.50)', margin:0 }}>Live overview</p>
            <p style={{ fontSize:'0.875rem', fontWeight:600, color:'#fff', margin:'0.125rem 0 0' }}>
              Retail command center</p>
          </div>
          <div style={{ display:'inline-flex', flexShrink:0, alignItems:'center', gap:'0.375rem',
            borderRadius:'9999px', border:`1px solid ${T.emeraldBorder}`,
            background:T.emeraldBg, padding:'0.25rem 0.625rem',
            fontSize:'0.625rem', fontWeight:500, color:'#d1fae5' }}
            role="status" aria-live="polite" aria-label="System is active">
            <span aria-hidden="true" style={{ display:'inline-block', width:'0.375rem', height:'0.375rem',
              borderRadius:'50%', background:T.emerald,
              animation:'sm-pulse 2s ease-in-out infinite' }} />
            System Active
          </div>
        </div>

        <StatsGrid />

        <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:'0.625rem' }}>
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
  <footer style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end',
    justifyContent:'space-between', gap:'1rem' }}>
    <dl style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'1.75rem', margin:0 }}>
      {footerStats.map(({ num, label }) => (
        <div key={label}>
          <dd style={{ fontSize:'1.25rem', fontWeight:700, color:'#fff', margin:0 }}>{num}</dd>
          <dt style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.50)', margin:0 }}>{label}</dt>
        </div>
      ))}
    </dl>
    <p style={{ fontSize:'0.5625rem', textTransform:'uppercase', letterSpacing:'0.22em',
      color:'rgba(255,255,255,0.35)', margin:0 }}>Built for modern retail teams</p>
  </footer>
))
FooterStats.displayName = 'FooterStats'

// ─── Root export ──────────────────────────────────────────────────────────────
/**
 * PERFORMANCE
 * • lucide-react removed → inline SVGs, zero bundle cost on critical path
 * • All colors use inline rgba/hex → immune to Tailwind JIT purge
 * • Keyframes injected via <style> once per mount
 * • Animations target only opacity (compositor layer)
 *
 * FONT (add to <head>, non-blocking):
 *   <link rel="preconnect" href="https://fonts.googleapis.com" />
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
 *   <link rel="stylesheet"
 *     href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&display=swap"
 *     media="print" onLoad="this.media='all'" />
 *
 * ACCESSIBILITY
 * • <main> + aria-labelledby="hero-headline"
 * • <ul>/<li> for chips and ops
 * • <dl>/<dt>/<dd> for stats and footer
 * • role="img" + aria-label on bar chart
 * • role="status" + aria-live="polite" on status pill
 * • aria-hidden on all decorative elements
 * • prefers-reduced-motion via injected @media rule
 */
export function LoginHero() {
  return (
    <main aria-labelledby="hero-headline">
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <section
        aria-label="StoreMitraa Retail hero"
        style={{ position:'relative', width:'100%', overflow:'hidden',
          background: T.sectionBg,
          padding:'1.5rem', minHeight:'100vh',
          display:'flex', flexDirection:'column', justifyContent:'space-between',
          gap:'1.5rem', boxSizing:'border-box' }}
      >
        {/* Decorative glows */}
        {([
          { top:'-3rem',   left:'-4rem',  width:'18rem', height:'18rem', background:'rgba(167,139,250,0.32)' },
          { top:'2rem',    right:'-2rem', width:'20rem', height:'20rem', background:'rgba(99,102,241,0.26)'  },
          { bottom:'-3rem',left:'30%',    width:'18rem', height:'18rem', background:'rgba(139,92,246,0.28)'  },
          { bottom:'2rem', right:'2rem',  width:'16rem', height:'16rem', background:'rgba(167,139,250,0.20)' },
        ] as React.CSSProperties[]).map((g, i) => (
          <div key={i} aria-hidden="true" style={{ position:'absolute', pointerEvents:'none',
            borderRadius:'50%', filter:'blur(60px)', ...g }} />
        ))}

        {/* Mesh grid */}
        <div aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.18,
          backgroundImage:'linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px)',
          backgroundSize:'36px 36px' }} />

        {/* Depth overlay */}
        <div aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:'linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.14))' }} />

        {/* Content */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:'1.25rem', width:'100%' }}>
          <Logo />

          <div style={{ display:'flex', flexDirection:'column' }}>
            {/* Badge */}
            <p aria-hidden="true" style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem',
              borderRadius:'9999px', border:`1px solid ${T.white15}`, background:T.white10,
              padding:'0.375rem 0.75rem', fontSize:'0.625rem', fontWeight:600,
              letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.90)',
              backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
              marginBottom:'0.75rem', width:'fit-content' }}>
              <IconShield /> Smart Retail Operations
            </p>

            <h1 id="hero-headline" style={{ fontSize:'clamp(1.35rem,4vw,2.1rem)',
              fontWeight:700, lineHeight:1.15, letterSpacing:'-0.03em', color:'#fff', margin:0 }}>
              Run billing, stock, and store performance from one command center.
            </h1>

            <p style={{ marginTop:'0.75rem', fontSize:'clamp(0.8rem,2vw,0.9rem)',
              lineHeight:1.65, color:'rgba(255,255,255,0.80)' }}>
              StoreMitraa gives your retail team a single, premium workspace to manage
              inventory, generate bills, monitor sales, and keep operations moving without friction.
            </p>

            <FeatureChips />
            <DashboardCard />
          </div>

          <FooterStats />
        </div>
      </section>
    </main>
  )
}