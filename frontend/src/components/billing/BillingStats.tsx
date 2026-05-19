import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  CalendarDays,
  FileText,
  ReceiptText,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react'

import type { InvoiceStats } from '../../features/billing/types'

type BillingStatsProps = {
  stats: InvoiceStats
  loading?: boolean
}

const money = (value: string | number) => {
  const amount = Number(value || 0)

  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
}

const shortMoney = (value: string | number) => {
  const amount = Number(value || 0)

  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`

  return money(amount)
}

export default function BillingStats({ stats, loading = false }: BillingStatsProps) {
  const cards = [
    {
      label: 'Total Invoices',
      value: stats.total_invoices,
      helper: 'Invoices generated',
      icon: FileText,
      tone: 'from-white via-indigo-50/40 to-white',
      iconTone: 'from-indigo-500 to-violet-600',
      accent: 'text-indigo-600',
      visual: 'spark',
    },
    {
      label: 'Total Sales',
      value: shortMoney(stats.total_sales_amount),
      helper: 'Lifetime invoice value',
      icon: BadgeIndianRupee,
      tone: 'from-white via-violet-50/40 to-white',
      iconTone: 'from-violet-500 to-indigo-600',
      accent: 'text-emerald-600',
      visual: 'progress',
    },
    {
      label: 'Today Sales',
      value: shortMoney(stats.today_sales),
      helper: 'Current business day',
      icon: CalendarDays,
      tone: 'from-white via-cyan-50/40 to-white',
      iconTone: 'from-cyan-500 to-indigo-600',
      accent: 'text-cyan-700',
      visual: 'growth',
    },
    {
      label: 'Total Profit',
      value: shortMoney(stats.total_profit),
      helper: 'Analytics-ready margin',
      icon: TrendingUp,
      tone: 'from-white via-emerald-50/45 to-white',
      iconTone: 'from-emerald-500 to-teal-600',
      accent: 'text-emerald-600',
      visual: 'profit',
    },
    {
      label: 'Discount Given',
      value: shortMoney(stats.total_discount_given),
      helper: 'Customer savings',
      icon: ReceiptText,
      tone: 'from-white via-orange-50/45 to-white',
      iconTone: 'from-orange-400 to-rose-500',
      accent: 'text-orange-600',
      visual: 'discount',
    },
    {
      label: 'Pending Amount',
      value: shortMoney(stats.pending_amount),
      helper: `${stats.pending_invoices} pending • ${stats.partial_invoices} partial`,
      icon: WalletCards,
      tone: 'from-white via-rose-50/40 to-white',
      iconTone: 'from-rose-500 to-red-500',
      accent: 'text-rose-600',
      visual: 'pending',
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="h-[190px] animate-pulse rounded-[32px] bg-white/70 shadow-[0_22px_60px_rgba(15,23,42,0.05)]"
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.07,
          },
        },
      }}
      className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <motion.div
            key={card.label}
            variants={{
              hidden: { opacity: 0, y: 18 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`group relative min-h-[190px] overflow-hidden rounded-[32px] bg-gradient-to-br ${card.tone} p-7 shadow-[0_22px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl`}
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {card.label}
                  </p>

                  <h3 className="mt-5 text-[40px] font-black leading-none tracking-[-0.055em] text-slate-950">
                    {card.value}
                  </h3>
                </div>

                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br ${card.iconTone} text-white shadow-[0_18px_38px_rgba(79,70,229,0.22)] transition duration-300 group-hover:scale-105 group-hover:rotate-3`}
                >
                  <Icon size={24} />
                </div>
              </div>

              <div className="mt-6">
                {card.visual === 'progress' && (
                  <>
                    <div className="flex items-center gap-2 text-sm font-black text-emerald-600">
                      <ArrowUpRight size={15} />
                      {card.helper}
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '76%' }}
                        transition={{ duration: 0.85, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4]"
                      />
                    </div>
                  </>
                )}

                {card.visual === 'discount' && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-600">
                    <ArrowDownRight size={15} />
                    {card.helper}
                  </div>
                )}

                {card.visual === 'pending' && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-black text-rose-600">
                    <Sparkles size={15} />
                    {card.helper}
                  </div>
                )}

                {card.visual !== 'progress' &&
                  card.visual !== 'discount' &&
                  card.visual !== 'pending' && (
                    <p className={`text-sm font-black ${card.accent}`}>
                      {card.helper}
                    </p>
                  )}
              </div>
            </div>

            <Icon
              size={128}
              className="absolute -bottom-8 -right-5 text-slate-950/[0.035] transition duration-300 group-hover:-translate-y-2 group-hover:translate-x-2"
            />

            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/80 blur-3xl" />
          </motion.div>
        )
      })}
    </motion.div>
  )
}