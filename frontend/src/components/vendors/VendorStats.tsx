import { motion } from 'framer-motion'
import {
  Handshake,
  ReceiptText,
  TimerReset,
  TrendingUp,
} from 'lucide-react'

type VendorStatsProps = {
  activeVendors: number
  totalBillsAmount: number
  pendingBills: number
}

const formatCurrencyShort = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`
  return `₹${amount.toFixed(0)}`
}

export default function VendorStats({
  activeVendors,
  totalBillsAmount,
  pendingBills,
}: VendorStatsProps) {
  const stats = [
    {
      label: 'Active Partners',
      value: activeVendors,
      helper: '+12% from last quarter',
      icon: Handshake,
      iconTone: 'from-indigo-500 to-violet-600',
      cardTone:
        'from-white via-indigo-50/35 to-white shadow-[0_22px_60px_rgba(99,102,241,0.10)]',
      helperClass: 'text-emerald-600',
      type: 'growth',
    },
    {
      label: 'Total Bills',
      value: formatCurrencyShort(totalBillsAmount),
      helper: 'Vendor payable value',
      icon: ReceiptText,
      iconTone: 'from-violet-500 to-indigo-600',
      cardTone:
        'from-white via-violet-50/45 to-white shadow-[0_22px_60px_rgba(124,58,237,0.10)]',
      helperClass: 'text-slate-500',
      type: 'progress',
    },
    {
      label: 'Pending Bills',
      value: pendingBills,
      helper: 'Need payment attention',
      icon: TimerReset,
      iconTone: 'from-orange-400 to-rose-500',
      cardTone:
        'from-white via-orange-50/55 to-white shadow-[0_22px_60px_rgba(249,115,22,0.10)]',
      helperClass: 'text-slate-500',
      type: 'avatars',
    },
  ]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
      className="grid grid-cols-1 gap-5 lg:grid-cols-3"
    >
      {stats.map((stat) => {
        const Icon = stat.icon

        return (
          <motion.div
            key={stat.label}
            variants={{
              hidden: { opacity: 0, y: 18 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className={`group relative min-h-[190px] overflow-hidden rounded-[32px] bg-gradient-to-br ${stat.cardTone} p-7 backdrop-blur-xl transition-all duration-300`}
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {stat.label}
                  </p>

                  <h3 className="mt-5 text-[42px] font-black leading-none tracking-[-0.055em] text-slate-950">
                    {stat.value}
                  </h3>
                </div>

                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br ${stat.iconTone} text-white shadow-[0_18px_38px_rgba(79,70,229,0.22)] transition duration-300 group-hover:scale-105 group-hover:rotate-3`}
                >
                  <Icon size={24} />
                </div>
              </div>

              <div className="mt-6">
                {stat.type === 'growth' && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-600">
                    <TrendingUp size={15} />
                    {stat.helper}
                  </div>
                )}

                {stat.type === 'progress' && (
                  <>
                    <p className={`text-sm font-semibold ${stat.helperClass}`}>
                      {stat.helper}
                    </p>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '68%' }}
                        transition={{ duration: 0.85, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4]"
                      />
                    </div>
                  </>
                )}

                {stat.type === 'avatars' && (
                  <>
                    <p className={`text-sm font-semibold ${stat.helperClass}`}>
                      {stat.helper}
                    </p>

                    <div className="mt-4 flex items-center">
                      {[0, 1, 2, 3].map((item) => (
                        <div
                          key={item}
                          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 shadow-[0_0_0_4px_rgba(255,255,255,0.9)] first:ml-0"
                        />
                      ))}

                      <div className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-[10px] font-black text-indigo-700 shadow-[0_0_0_4px_rgba(255,255,255,0.9)]">
                        +{Math.max(1, pendingBills)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>


            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/80 blur-3xl" />
          </motion.div>
        )
      })}
    </motion.div>
  )
}