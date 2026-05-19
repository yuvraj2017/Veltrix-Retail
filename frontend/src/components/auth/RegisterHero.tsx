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

// const quickStats = [
//   {
//     label: 'Stores',
//     value: '1,200+',
//     note: 'growing businesses',
//   },
//   {
//     label: 'Inventory',
//     value: '24k',
//     note: 'items tracked daily',
//   },
//   {
//     label: 'Billing',
//     value: '99.9%',
//     note: 'uptime confidence',
//   },
// ]

export function RegisterHero() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:min-h-screen">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#4f46e5_0%,#6d28d9_42%,#312e81_100%)]" />

      <div className="absolute inset-0">
        <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-64 w-64 rounded-full bg-fuchsia-300/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      </div>

      <div className="absolute inset-0 opacity-[0.08]">
        <div className="h-full w-full bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:54px_54px]" />
      </div>

      <div className="relative z-10 flex w-full flex-col justify-between px-10 py-10 xl:px-14 xl:py-12">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/14 text-white shadow-[0_12px_30px_rgba(0,0,0,0.12)] ring-1 ring-white/15 backdrop-blur-md">
            <Store size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              StoreMitraa Retail
            </h2>
            <p className="text-sm text-white/70">
              Next-gen retail management
            </p>
          </div>
        </div>

        <div className="max-w-xl py-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur-sm">
            <Sparkles size={14} />
            Setup your shop account
          </div>

          <h1 className="max-w-2xl text-5xl font-bold leading-[1.08] tracking-tight text-white xl:text-6xl">
            Start managing your store with a smarter, cleaner workflow.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/78">
            Register your business, create your owner account, and unlock a
            modern retail workspace built for products, billing, and daily
            operations.
          </p>

          <div className="mt-8 space-y-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 text-white/90"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/15 backdrop-blur-sm">
                  <BadgeCheck size={16} />
                </div>
                <span className="text-base">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
              <Boxes size={20} />
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
              Inventory
            </p>
            <p className="mt-2 text-3xl font-bold">2,482</p>
            <p className="mt-1 text-sm text-white/70">items tracked live</p>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
              <CreditCard size={20} />
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
              Billing
            </p>
            <p className="mt-2 text-3xl font-bold">148</p>
            <p className="mt-1 text-sm text-white/70">daily invoices handled</p>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
              <ShieldCheck size={20} />
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
              Security
            </p>
            <p className="mt-2 text-3xl font-bold">99.9%</p>
            <p className="mt-1 text-sm text-white/70">platform reliability</p>
          </div>
        </div>
      </div>
    </div>
  )
}