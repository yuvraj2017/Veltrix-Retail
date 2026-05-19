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

export function LoginHero() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.30),transparent_24%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.28),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.24),transparent_28%),linear-gradient(135deg,#4f46e5_0%,#5b4ff1_20%,#6d3df5_45%,#5b21b6_72%,#312e81_100%)] px-5 py-8 sm:px-8 lg:flex lg:min-h-screen lg:px-10 lg:py-10 xl:px-14 xl:py-12">
      {/* soft glows */}
      <div className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-violet-300/25 blur-3xl" />
      <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="absolute bottom-10 right-12 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl" />

      {/* mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

      {/* overlay for depth */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.12))]" />

      <div className="relative z-10 flex w-full flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-transparent text-white shadow-[0_12px_30px_rgba(99,102,241,0.35)] ring-1 ring-white/15">
              <Sparkles size={20} />
            </div>

            <div>
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                StoreMitraa Retail
              </h2>
              <p className="text-sm text-white/75">Next-gen retail management</p>
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-3xl lg:mt-14">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/90 backdrop-blur-sm">
            <ShieldCheck size={14} />
            Smart Retail Operations
          </p>

          <h1 className="max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-4xl xl:text-6xl">
            Run billing, stock, and store performance from one command center.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
            StoreMitraa gives your retail team a single, premium workspace to manage
            inventory, generate bills, monitor sales, and keep operations moving
            without friction.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {features.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="group flex items-center gap-2 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-white/90 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/14 hover:shadow-[0_12px_28px_rgba(15,23,42,0.22)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-white transition group-hover:bg-white/18">
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              )
            })}
          </div>

          <div className="relative mt-10 max-w-3xl">
            <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-white/10 p-4 backdrop-blur-xl shadow-[0_28px_80px_rgba(29,16,84,0.30)] sm:p-5 xl:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_25%)]" />

              <div className="relative">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                      Live overview
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                      Retail command center
                    </h3>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-3 py-1 text-xs font-medium text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    System Active
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {stats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-slate-950/12 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                        {item.label}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
                      <p className={`mt-1 text-sm ${item.tone}`}>{item.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/12 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-white/85">
                        Weekly Performance
                      </p>
                      <div className="flex items-center gap-2 text-xs text-white/55">
                        <BarChart3 size={14} />
                        Last 7 Days
                      </div>
                    </div>

                    <div className="flex h-32 items-end gap-2 sm:h-36 sm:gap-3">
                      {weeklyBars.map((value, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center gap-2">
                          <div
                            className={`w-full rounded-t-2xl transition-all duration-500 ${
                              index === 6
                                ? 'bg-gradient-to-t from-fuchsia-500 via-violet-500 to-indigo-300 shadow-[0_10px_28px_rgba(147,51,234,0.35)]'
                                : index >= 4
                                  ? 'bg-white/30'
                                  : 'bg-white/18'
                            }`}
                            style={{ height: `${value}%` }}
                          />
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                            {weekLabels[index]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/12 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-white/85">Operations Flow</p>
                      <WalletCards size={16} className="text-white/55" />
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                          Billing
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          Generate invoice in seconds
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                          Inventory
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          Auto stock deduction after sale
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                          Reports
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          Daily insights with low-stock alerts
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-8 top-8 hidden w-52 rounded-2xl border border-white/12 bg-white/12 p-4 backdrop-blur-xl shadow-[0_18px_45px_rgba(55,48,163,0.28)] xl:block">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                Inventory
              </p>
              <p className="mt-2 text-2xl font-bold text-white">2,482</p>
              <p className="mt-1 text-sm text-white/75">items tracked live</p>
            </div>

            <div className="absolute -bottom-8 left-8 hidden w-56 rounded-2xl border border-white/12 bg-white/12 p-4 backdrop-blur-xl shadow-[0_18px_45px_rgba(55,48,163,0.28)] xl:block">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                Billing Sync
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Sale → Bill → Inventory updated
              </p>
              <p className="mt-1 text-sm text-emerald-100">
                Real-time retail workflow
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-6 text-sm text-white/65 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-6 sm:gap-8">
            <div>
              <p className="text-2xl font-bold text-white">10k+</p>
              <p className="text-white/55">Retail actions processed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-white/55">Operational reliability</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-white/55">Access to store data</p>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Built for modern retail teams
          </p>
        </div>
      </div>
    </div>
  )
}