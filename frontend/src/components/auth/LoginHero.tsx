

import {
  BarChart3,
  Boxes,
  CreditCard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react'


const stats = [
  { label: 'Today Sales', value: '₹24,580', sub: '+12.4%', tone: 'text-emerald-300' },
  { label: 'Orders', value: '148', sub: 'Live counter', tone: 'text-indigo-100' },
  { label: 'Low Stock', value: '06', sub: 'Needs attention', tone: 'text-amber-300' },
]


const features = [
  { label: 'Fast Billing', icon: CreditCard },
  { label: 'Inventory Control', icon: Boxes },
  { label: 'Sales Insights', icon: TrendingUp },
]


const weeklyBars = [42, 65, 54, 78, 70, 92, 88]
const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']


const ops = [
  { cat: 'Billing', text: 'Generate invoice in seconds' },
  { cat: 'Inventory', text: 'Auto stock deduction after sale' },
  { cat: 'Reports', text: 'Daily insights with low-stock alerts' },
]


const footerStats = [
  { num: '10k+', label: 'Retail actions processed' },
  { num: '99.9%', label: 'Operational reliability' },
  { num: '24/7', label: 'Access to store data' },
]


export function LoginHero() {
  return (
    <div className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.30),transparent_24%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.28),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.24),transparent_28%),linear-gradient(135deg,#4f46e5_0%,#5b4ff1_20%,#6d3df5_45%,#5b21b6_72%,#312e81_100%)] p-5 sm:p-6 lg:min-h-screen lg:p-8 flex flex-col justify-between gap-6">


      {/* Soft glows */}
      <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-violet-300/25 blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-12 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-8 right-10 h-56 w-56 rounded-full bg-blue-300/10 blur-3xl pointer-events-none" />


      {/* Mesh grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20 pointer-events-none" />


      {/* Depth overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.12))] pointer-events-none" />


      <div className="relative z-10 flex w-full flex-col gap-5">


        {/* Logo */}
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/20 via-white/10 to-transparent text-white shadow-[0_8px_20px_rgba(99,102,241,0.30)] ring-1 ring-white/15">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
                StoreMitraa Retail
              </h2>
              <p className="text-[11px] text-white/70">Next-gen retail management</p>
            </div>
          </div>
        </div>


        {/* Hero content */}
        <div className="flex flex-col items-start gap-0">


          {/* Badge */}
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/90 backdrop-blur-sm">
            <ShieldCheck size={12} />
            Smart Retail Operations
          </p>


          {/* Headline */}
          <h1 className="text-xl font-bold leading-[1.15] tracking-[-0.03em] text-white sm:text-2xl md:text-3xl lg:text-[2rem] xl:text-4xl">
            Run billing, stock, and store performance from one command center.
          </h1>


          {/* Description */}
          <p className="mt-3 text-xs leading-6 text-white/80 sm:text-sm">
            StoreMitraa gives your retail team a single, premium workspace to manage
            inventory, generate bills, monitor sales, and keep operations moving
            without friction.
          </p>


          {/* Feature chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {features.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="group flex items-center gap-2 rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-white/90 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/14"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/12 text-white transition group-hover:bg-white/18">
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
              )
            })}
          </div>


          {/* Dashboard card */}
          <div className="relative mt-6 w-full">
            <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/10 p-3 sm:p-4 backdrop-blur-xl shadow-[0_20px_60px_rgba(29,16,84,0.28)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_25%)] pointer-events-none" />


              <div className="relative">
                {/* Card header */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                      Live overview
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-white">
                      Retail command center
                    </h3>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    System Active
                  </div>
                </div>


                {/* Stats — 2 cols on xs, 3 cols on sm+ */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 mb-3">
                  {stats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-slate-950/12 p-2.5 sm:p-3"
                    >
                      <p className="text-[9px] uppercase tracking-[0.16em] text-white/50">
                        {item.label}
                      </p>
                      <p className="mt-1.5 text-lg font-bold text-white sm:text-xl">{item.value}</p>
                      <p className={`mt-0.5 text-[11px] ${item.tone}`}>{item.sub}</p>
                    </div>
                  ))}
                </div>


                {/* Charts — stacked on xs/sm, side-by-side on md+ */}
                <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  {/* Bar chart */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/12 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-white/85">
                        Weekly Performance
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                        <BarChart3 size={12} />
                        Last 7 Days
                      </div>
                    </div>
                    <div className="flex h-20 items-end gap-1 sm:h-24 sm:gap-1.5">
                      {weeklyBars.map((value, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              index === 6
                                ? 'bg-gradient-to-t from-fuchsia-500 via-violet-500 to-indigo-300 shadow-[0_6px_18px_rgba(147,51,234,0.32)]'
                                : index >= 4
                                  ? 'bg-white/30'
                                  : 'bg-white/18'
                            }`}
                            style={{ height: `${value}%` }}
                          />
                          <span className="text-[8px] uppercase tracking-[0.14em] text-white/40">
                            {weekLabels[index]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* Operations flow */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/12 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-white/85">Operations Flow</p>
                      <WalletCards size={13} className="text-white/50" />
                    </div>
                    <div className="space-y-2">
                      {ops.map((row) => (
                        <div
                          key={row.cat}
                          className="rounded-xl border border-white/10 bg-white/8 px-3 py-2"
                        >
                          <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">
                            {row.cat}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-white">{row.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Footer stats */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-5 sm:gap-7">
            {footerStats.map((s) => (
              <div key={s.label}>
                <p className="text-lg font-bold text-white sm:text-xl">{s.num}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">
            Built for modern retail teams
          </p>
        </div>


      </div>
    </div>
  )
}

