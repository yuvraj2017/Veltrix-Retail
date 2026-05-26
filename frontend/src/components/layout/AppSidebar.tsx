import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', to: '/products', icon: Package },
  { name: 'Vendors', to: '/vendors', icon: Handshake },
  { name: 'Billing', to: '/billing', icon: ReceiptText },
  { name: 'Reports', to: '/reports', icon: BarChart3 },
  { name: 'Settings', to: '/settings', icon: Settings },
]

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function resolveImageUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path}`
}

function getInitial(name?: string | null) {
  if (!name) return 'E'
  return name.trim().charAt(0).toUpperCase()
}

const MOBILE_BREAKPOINT = 768 // px — same as Tailwind's `md`

interface AppSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void // <-- add this to your parent + pass it down
}

export function AppSidebar({ isOpen, onToggle, onClose }: AppSidebarProps) {
  const { user, shop } = useAuth()

  // ─── Auto-close on mobile ────────────────────────────────────────────────
  useEffect(() => {
    // Close immediately if already on a small screen
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      onClose()
    }

    const handleResize = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        onClose()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])
  // ─────────────────────────────────────────────────────────────────────────

  const shopName = shop?.name || user?.shop_name || 'Editorial Merchant'

  const shopLogoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null

  const bottomCardSubtitle = user?.full_name || user?.role || 'owner'

  return (
    <aside className="relative flex h-full overflow-hidden flex-col bg-[#f3f5f9]">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute right-1 top- z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors duration-200"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>

      {/* Header */}
      <div className={`flex items-start gap-3 py-6 ${isOpen ? 'px-5' : 'justify-center px-3'}`}>
        {shopLogoUrl ? (
          <img
            src={shopLogoUrl}
            alt={shopName}
            className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <span className="text-lg font-bold">{getInitial(shopName)}</span>
          </div>
        )}

        <div
          className={`min-w-0 overflow-hidden transition-all duration-300 ${
            isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          <h2 className="truncate text-xl font-semibold leading-6 text-indigo-600 whitespace-nowrap">
            {shopName}
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 whitespace-nowrap">
            Premium Retail Admin
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className={`mt-4 space-y-2 ${isOpen ? 'px-5' : 'px-2'}`}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.to}
              title={!isOpen ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl py-3 text-base font-medium transition-all duration-200 ${
                  isOpen ? 'px-4' : 'justify-center px-0'
                } ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                  isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                {item.name}
              </span>
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={`mt-auto space-y-4 pb-6 ${isOpen ? 'px-5' : 'px-2'}`}>
        <Link
          to="/billing"
          title={!isOpen ? 'New Transaction' : undefined}
          className={`flex w-full items-center gap-2 rounded-2xl bg-indigo-600 py-4 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 ${
            isOpen ? 'justify-center px-4' : 'justify-center px-0'
          }`}
        >
          <PlusCircle size={20} className="shrink-0" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            New Transaction
          </span>
        </Link>

        <Link
          to="/profile"
          title={!isOpen ? shopName : undefined}
          className={`group flex items-center gap-3 rounded-2xl bg-white py-3 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-md ${
            isOpen ? 'px-4' : 'justify-center px-0'
          }`}
        >
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={shopName}
              className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700 transition duration-300 group-hover:scale-105">
              {getInitial(shopName)}
            </div>
          )}

          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ${
              isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            <p className="truncate text-sm font-semibold text-slate-900 whitespace-nowrap">
              {shopName}
            </p>
            <p className="truncate text-xs text-slate-500 whitespace-nowrap">
              {bottomCardSubtitle}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )
}