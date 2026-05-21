import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  PlusCircle,
  ChevronLeft,
  Menu,
  X,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', to: '/products', icon: Package },
  { name: 'Vendors', to: '/vendors', icon: Handshake },
  { name: 'Billing', to: '/billing', icon: ReceiptText },
  { name: 'Customers', to: '/customers', icon: Users },
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

interface AppSidebarProps {
  collapsed: boolean
  onCollapsedChange: (value: boolean) => void
  mobileOpen: boolean
  onMobileOpenChange: (value: boolean) => void
}

export function AppSidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const { user, shop } = useAuth()

  const shopName = shop?.name || user?.shop_name || 'Editorial Merchant'

  const shopLogoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null

  const bottomCardSubtitle = user?.full_name || user?.role || 'owner'

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) onMobileOpenChange(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onMobileOpenChange])

  const sidebarContent = (
    <aside
      className={[
        'relative flex h-full flex-col bg-[#f3f5f9] py-6 transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px] px-2' : 'w-[260px] px-5',
      ].join(' ')}
    >
      {/* ── Desktop collapse toggle ── */}
      <button
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute right-0 top-6 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 md:flex"
      >
        <ChevronLeft
          size={14}
          className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Brand header ── */}
      <div className="flex items-start gap-3 overflow-hidden px-2">
        {shopLogoUrl ? (
          <img
            src={shopLogoUrl}
            alt={shopName}
            className="h-11 w-11 min-w-[44px] rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <span className="text-lg font-bold">{getInitial(shopName)}</span>
          </div>
        )}

        <div
          className={`min-w-0 overflow-hidden transition-all duration-300 ${
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          <h2 className="truncate text-[17px] font-semibold leading-6 text-indigo-600">
            {shopName}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Premium Retail Admin
          </p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="mt-8 flex-1 space-y-1 overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <div key={item.name} className="group relative">
              <NavLink
                to={item.to}
                onClick={() => onMobileOpenChange(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-2xl py-3 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0' : 'px-4',
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900',
                  ].join(' ')
                }
              >
                <Icon size={20} className="min-w-[20px]" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                  }`}
                >
                  {item.name}
                </span>
              </NavLink>

              {/* Tooltip shown only when collapsed on desktop */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white group-hover:block">
                  {item.name}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Bottom area ── */}
      <div className="mt-auto space-y-3">
        <Link
          to="/billing"
          onClick={() => onMobileOpenChange(false)}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700',
            collapsed ? 'px-0' : 'px-4',
          ].join(' ')}
        >
          <PlusCircle size={18} className="min-w-[18px]" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            New Transaction
          </span>
        </Link>

        <Link
          to="/profile"
          onClick={() => onMobileOpenChange(false)}
          className={[
            'group/card flex items-center gap-3 overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-px hover:bg-slate-50 hover:shadow-md',
            collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3',
          ].join(' ')}
        >
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={shopName}
              className="h-10 w-10 min-w-[40px] rounded-xl border border-slate-200 object-cover transition duration-300 group-hover/card:scale-105"
            />
          ) : (
            <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700 transition duration-300 group-hover/card:scale-105">
              {getInitial(shopName)}
            </div>
          )}

          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            <p className="truncate text-sm font-semibold text-slate-900">
              {shopName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {bottomCardSubtitle}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )

  return (
    <>
      {/* ── Mobile hamburger trigger ── */}
      <button
        onClick={() => onMobileOpenChange(true)}
        aria-label="Open menu"
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-md md:hidden"
      >
        <Menu size={20} className="text-slate-700" />
      </button>

      {/* ── Desktop sidebar ── */}
      <div className="hidden h-full md:flex">
        {sidebarContent}
      </div>

      {/* ── Mobile overlay + drawer ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => onMobileOpenChange(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-[#f3f5f9] transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ width: 260 }}
      >
        {/* Close button inside drawer */}
        <button
          onClick={() => onMobileOpenChange(false)}
          aria-label="Close menu"
          className="absolute right-4 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"
        >
          <X size={16} />
        </button>

        {/* Render full (non-collapsed) sidebar inside drawer */}
        <aside className="flex h-full w-[260px] flex-col px-5 py-6">
          <div className="flex items-start gap-3 px-2">
            {shopLogoUrl ? (
              <img
                src={shopLogoUrl}
                alt={shopName}
                className="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <span className="text-lg font-bold">{getInitial(shopName)}</span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold leading-6 text-indigo-600">
                {shopName}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Premium Retail Admin
              </p>
            </div>
          </div>

          <nav className="mt-8 flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.to}
                  onClick={() => onMobileOpenChange(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`
                  }
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <Link
              to="/billing"
              onClick={() => onMobileOpenChange(false)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              <PlusCircle size={18} />
              New Transaction
            </Link>

            <Link
              to="/profile"
              onClick={() => onMobileOpenChange(false)}
              className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-px hover:bg-slate-50 hover:shadow-md"
            >
              {shopLogoUrl ? (
                <img
                  src={shopLogoUrl}
                  alt={shopName}
                  className="h-10 w-10 rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700 transition duration-300 group-hover:scale-105">
                  {getInitial(shopName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{shopName}</p>
                <p className="truncate text-xs text-slate-500">{bottomCardSubtitle}</p>
              </div>
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}