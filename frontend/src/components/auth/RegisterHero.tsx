import {
  BadgeCheck,
  Boxes,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react'


const features = [
  'Simple onboarding for shop owners',
  'Ready for billing and inventory modules',
  'Professional setup for multi-feature retail operations',
]


const statCards = [
  {
    icon: Boxes,
    label: 'Inventory',
    value: '2,482',
    note: 'items tracked live',
  },
  {
    icon: CreditCard,
    label: 'Billing',
    value: '148',
    note: 'daily invoices handled',
  },
  {
    icon: ShieldCheck,
    label: 'Security',
    value: '99.9%',
    note: 'platform reliability',
  },
]


export function RegisterHero() {
  return (
    <div className="relative overflow-hidden flex h-[100%]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#4f46e5_0%,#6d28d9_42%,#312e81_100%)]" />


      {/* Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-12 top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-16 right-8 h-56 w-56 rounded-full bg-fuchsia-300/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-60 w-60 rounded-full bg-cyan-300/10 blur-3xl" />
      </div>


      {/* Mesh grid */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
        <div className="h-full w-full bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>


      <div className="relative z-10 flex w-full flex-col justify-between px-5 py-8 sm:px-8 xl:px-12 xl:py-10 gap-8 sm:gap-10">


        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/14 text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] ring-1 ring-white/15 backdrop-blur-md shrink-0">
            <Store size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
              StoreMitraa Retail
            </h2>
            <p className="text-[11px] sm:text-xs text-white/70">Next-gen retail management</p>
          </div>
        </div>


        {/* Hero copy */}
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-sm">
            <Sparkles size={12} />
            Professional dashboard for growing businesses 
          </div>


          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold leading-[1.15] tracking-tight text-white">
            Start managing your store with a smarter, cleaner workflow.
          </h1>


          <p className="mt-4 text-sm leading-7 text-white/78">
            Register your business, create your owner account, and unlock a
            modern retail workspace built for products, billing, and daily
            operations.
          </p>


          <div className="mt-5 space-y-3">
            {features.map((feature) => (
              <div key={feature} className="flex items-start sm:items-center gap-2.5 text-white/90">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/15 backdrop-blur-sm mt-0.5 sm:mt-0">
                  <BadgeCheck size={14} />
                </div>
                <span className="text-sm leading-snug">{feature}</span>
              </div>
            ))}
          </div>
        </div>


        {/* Stat cards */}
        <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3">
          {statCards.map(({ icon: Icon, label, value, note }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/12 bg-white/10 p-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.12)] backdrop-blur-xl flex sm:block items-center gap-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 sm:mb-3">
                <Icon size={17} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-white/55">
                  {label}
                </p>
                <p className="mt-1 sm:mt-1.5 text-2xl font-bold leading-none">{value}</p>
                <p className="mt-0.5 text-xs text-white/65">{note}</p>
              </div>
            </div>
          ))}
        </div>


      </div>
    </div>
  )
}

