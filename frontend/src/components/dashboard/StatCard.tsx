import {
  Banknote,
  BriefcaseBusiness,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type StatItem = {
  title: string
  value: string
  change: string
  positive: boolean
  highlight?: boolean
  warning_label?: string
}

type StatGridProps = {
  items: StatItem[]
}

type StatCardProps = {
  item: StatItem
  index: number
}

const icons: LucideIcon[] = [
  BriefcaseBusiness,
  CreditCard,
  Wallet,
  Banknote,
  TrendingUp,
]

const ACCENTS = ['#534AB7', '#7F77DD', '#185FA5', '#0F6E56', '#BA7517']

const ICON_STYLES = [
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#EEEDFE', color: '#7F77DD' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#BA7517' },
]

export function StatGrid({ items }: StatGridProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
      {items.map((item: StatItem, index: number) => (
        <StatCard key={item.title} item={item} index={index} />
      ))}
    </div>
  )
}

export function StatCard({ item, index }: StatCardProps) {
  const Icon = icons[index % icons.length] || TrendingUp
  const TrendIcon = item.positive ? TrendingUp : TrendingDown

  const isWarning = Boolean(item.highlight)

  const accent = isWarning
    ? '#BA7517'
    : ACCENTS[index % ACCENTS.length]

  const iconStyle = isWarning
    ? { bg: '#FAEEDA', color: '#BA7517' }
    : ICON_STYLES[index % ICON_STYLES.length]

  const badgeStyle = isWarning
    ? { background: '#FCEBEB', color: '#A32D2D' }
    : item.positive
      ? { background: '#EAF3DE', color: '#3B6D11' }
      : { background: '#FCEBEB', color: '#A32D2D' }

  const trendColor = isWarning
    ? '#A32D2D'
    : item.positive
      ? '#1D9E75'
      : '#A32D2D'

  return (
    <div
      className="group"
      style={{
        flex: '1 1 160px',
        minWidth: 0,
        background: '#ffffff',
        border: '0.5px solid rgba(15,23,42,0.08)',
        borderRadius: '14px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(-2px)'

        const accentBar =
          e.currentTarget.querySelector('.accent-bar') as HTMLElement | null

        if (accentBar) {
          accentBar.style.transform = 'scaleX(1)'
        }
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(0)'

        const accentBar =
          e.currentTarget.querySelector('.accent-bar') as HTMLElement | null

        if (accentBar) {
          accentBar.style.transform = 'scaleX(0)'
        }
      }}
    >
      {/* Hover accent bar */}
      <div
        className="accent-bar"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: accent,
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 0.35s ease',
        }}
      />

      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: iconStyle.bg,
            color: iconStyle.color,
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>

        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: '99px',
            whiteSpace: 'nowrap',
            ...badgeStyle,
          }}
        >
          {isWarning
            ? item.warning_label ?? 'Warning'
            : item.positive
              ? 'Growth'
              : 'Drop'}
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#94a3b8',
          margin: 0,
        }}
      >
        {item.title}
      </p>

      {/* Value */}
      <p
        style={{
          fontSize: '26px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: '4px 0 12px',
          color: '#0f172a',
        }}
      >
        {item.value}
      </p>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          borderRadius: '10px',
          padding: '7px 10px',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontWeight: 700,
            color: trendColor,
          }}
        >
          <TrendIcon size={14} strokeWidth={2.5} />
          <span>{item.change}</span>
        </div>

        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: accent,
          }}
        />
      </div>
    </div>
  )
}