import {
  Ban,
  Clock3,
  IndianRupee,
  Receipt,
  ShieldAlert,
  Store,
  TrendingUp,
  UserRoundX,
  Users,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { formatCount, formatMoneyCompact, profitMargin } from '../../features/admin/format'
import type { AdminStats } from '../../features/admin/types'

/**
 * Overview tiles, split into two bands: how the platform is trading, and the
 * state of the shop-owner accounts on it.
 *
 * Reuses the ProductStats card treatment -- same radius, glow overlay, icon
 * chip and clamped value size -- so the admin screens read as part of the same
 * product. Every number comes from GET /api/v1/admin/stats.
 */

type Card = {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  to?: string
  valueClass: string
  iconWrapClass: string
  glowClass: string
  borderClass: string
}

const NEUTRAL_BORDER = 'border-slate-200 dark:border-slate-700'

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
      {cards.map((card) => {
        const body = (
          <>
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glowClass}`}
            />
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100/40 blur-2xl dark:bg-slate-700/40" />

            <div className="relative flex items-center justify-between gap-2">
              <div className="flex-1 text-[10px] font-bold uppercase leading-snug tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {card.title}
              </div>
              <div
                className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${card.iconWrapClass}`}
              >
                {card.icon}
              </div>
            </div>

            <div className="relative mt-4">
              <div
                className={`break-words text-[clamp(24px,4.5vw,34px)] font-bold leading-none tracking-[-0.03em] ${card.valueClass}`}
              >
                {card.value}
              </div>
            </div>

            <p className="relative mt-4 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
              {card.subtitle}
            </p>
          </>
        )

        const shell = `group relative block overflow-hidden rounded-[22px] border bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)] dark:bg-slate-800/60 dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_14px_40px_rgba(0,0,0,0.4)] ${card.borderClass}`

        return card.to ? (
          <Link key={card.title} to={card.to} className={shell}>
            {body}
          </Link>
        ) : (
          <div key={card.title} className={shell}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Trading performance across every shop on the platform. */
export function PlatformTradingCards({ stats }: { stats: AdminStats }) {
  const margin = profitMargin(stats.platform_revenue, stats.platform_profit)

  const cards: Card[] = [
    {
      title: 'PLATFORM REVENUE',
      value: formatMoneyCompact(stats.platform_revenue),
      subtitle: `Across ${formatCount(stats.total_shops)} shop${
        stats.total_shops === 1 ? '' : 's'
      }, all time`,
      icon: <IndianRupee size={18} />,
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900',
      glowClass: 'from-indigo-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
    {
      title: 'PLATFORM PROFIT',
      value: formatMoneyCompact(stats.platform_profit),
      subtitle:
        margin === null
          ? 'No sales recorded yet'
          : `${margin.toFixed(1)}% margin on revenue`,
      icon: <TrendingUp size={18} />,
      valueClass: 'text-emerald-600 dark:text-emerald-400',
      iconWrapClass:
        'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-900',
      glowClass: 'from-emerald-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
    {
      title: 'OUTSTANDING',
      value: formatMoneyCompact(stats.platform_outstanding),
      subtitle:
        Number(stats.platform_outstanding || 0) > 0
          ? 'Uncollected across all shops'
          : 'Everything collected',
      icon: <Wallet size={18} />,
      valueClass:
        Number(stats.platform_outstanding || 0) > 0
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 ring-1 ring-orange-100 dark:ring-orange-900',
      glowClass: 'from-orange-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
    {
      title: 'INVOICES BILLED',
      value: formatCount(stats.platform_invoice_count),
      subtitle: `${formatMoneyCompact(
        stats.platform_revenue_last_7_days,
      )} billed in the last 7 days`,
      icon: <Receipt size={18} />,
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 ring-1 ring-violet-100 dark:ring-violet-900',
      glowClass: 'from-violet-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
  ]

  return <CardGrid cards={cards} />
}

/** Account state of the shop owners on the platform. */
export function AccountStateCards({ stats }: { stats: AdminStats }) {
  const cards: Card[] = [
    {
      title: 'PENDING APPROVALS',
      value: formatCount(stats.pending_users),
      subtitle:
        stats.pending_users > 0
          ? 'Cannot sign in until reviewed'
          : 'Nothing waiting for review',
      icon: <Clock3 size={18} />,
      to: '/admin/users?status=pending',
      valueClass:
        stats.pending_users > 0
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 ring-1 ring-amber-100 dark:ring-amber-900',
      glowClass: 'from-amber-500/10 to-transparent',
      borderClass:
        stats.pending_users > 0
          ? 'border-amber-200 dark:border-amber-900'
          : NEUTRAL_BORDER,
    },
    {
      title: 'SHOP OWNERS',
      value: formatCount(stats.shop_owner_count),
      subtitle: `${formatCount(stats.active_users)} active · ${formatCount(
        stats.registrations_last_7_days,
      )} new this week`,
      icon: <Users size={18} />,
      to: '/admin/users',
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 ring-1 ring-sky-100 dark:ring-sky-900',
      glowClass: 'from-sky-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
    {
      title: 'SUSPENDED',
      value: formatCount(stats.suspended_users),
      subtitle:
        stats.suspended_users > 0
          ? 'Access withdrawn, reversible'
          : 'None suspended',
      icon: <ShieldAlert size={18} />,
      to: '/admin/users?status=suspended',
      valueClass:
        stats.suspended_users > 0
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 ring-1 ring-orange-100 dark:ring-orange-900',
      glowClass: 'from-orange-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
    {
      title: 'CLOSED ACCOUNTS',
      value: formatCount(stats.rejected_users + stats.disabled_users),
      subtitle: `${formatCount(stats.rejected_users)} rejected · ${formatCount(
        stats.disabled_users,
      )} disabled`,
      icon: stats.disabled_users > 0 ? <Ban size={18} /> : <UserRoundX size={18} />,
      to: '/admin/users?status=rejected',
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
      glowClass: 'from-slate-500/10 to-transparent',
      borderClass: NEUTRAL_BORDER,
    },
  ]

  return <CardGrid cards={cards} />
}

/** Shops ranked by revenue, each naming its owner. */
export function TopShopsCard({ stats }: { stats: AdminStats }) {
  const top = stats.top_shops

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.3)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Store size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Top performing shops
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ranked by lifetime revenue
          </p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 rounded-[1.25rem] border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No shop has recorded a sale yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {top.map((shop, index) => (
            <li key={shop.shop_id}>
              <Link
                to={
                  shop.owner_user_id
                    ? `/admin/users/${shop.owner_user_id}`
                    : '/admin/users'
                }
                className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-100 bg-white p-4 transition hover:-translate-y-[1px] hover:border-indigo-100 hover:shadow-[0_12px_30px_rgba(99,102,241,0.08)] dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-indigo-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                      {shop.shop_name || 'Unnamed shop'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {shop.owner_name || shop.owner_email || 'Owner unknown'}
                      {' · '}
                      {formatCount(shop.invoice_count)} invoice
                      {shop.invoice_count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4 sm:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Revenue
                    </p>
                    <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                      {formatMoneyCompact(shop.total_revenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Profit
                    </p>
                    <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoneyCompact(shop.total_profit)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
