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
  Wallet,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', to: '/products', icon: Package },
  { name: 'Vendors', to: '/vendors', icon: Handshake },
  { name: 'Billing', to: '/billing', icon: ReceiptText },
  { name: 'Expenses', to: '/expenses', icon: Wallet },
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

const MOBILE_BREAKPOINT = 768

interface AppSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function AppSidebar({ isOpen, onToggle, onClose }: AppSidebarProps) {
  const { user, shop } = useAuth()

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) onClose()
    const handleResize = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) onClose()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])

  const shopName = shop?.name || user?.shop_name || 'Editorial Merchant'
  const shopLogoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null
  const bottomCardSubtitle = user?.full_name || user?.role || 'owner'

  return (
    <aside className="relative flex h-full overflow-hidden flex-col bg-[#f3f5f9] dark:bg-slate-900">
      <button
        onClick={onToggle}
        className="absolute right-1 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors duration-200"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>

      <div className={`flex items-start gap-3 py-6 ${isOpen ? 'px-5' : 'justify-center px-3'}`}>
        {shopLogoUrl ? (
          <img
            src={shopLogoUrl}
            alt={shopName}
            className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-cover shadow-sm"
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
          <h2 className="truncate text-xl font-semibold leading-6 text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
            {shopName}
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Premium Retail Admin
          </p>
        </div>
      </div>

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
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
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

      <div className={`mt-auto space-y-4 pb-6 ${isOpen ? 'px-5' : 'px-2'}`}>
        <Link
          to="/billing"
          title={!isOpen ? 'New Transaction' : undefined}
          className={`flex w-full items-center gap-2 rounded-2xl bg-indigo-600 dark:bg-indigo-700 py-4 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:hover:bg-indigo-600 ${
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
          className={`group flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 py-3 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md ${
            isOpen ? 'px-4' : 'justify-center px-0'
          }`}
        >
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={shopName}
              className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900 text-sm font-bold text-emerald-700 dark:text-emerald-300 transition duration-300 group-hover:scale-105">
              {getInitial(shopName)}
            </div>
          )}

          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ${
              isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {shopName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {bottomCardSubtitle}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )
}