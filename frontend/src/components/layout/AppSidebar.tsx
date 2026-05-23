import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  PlusCircle,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
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

export function AppSidebar() {
  const { user, shop } = useAuth()

  const shopName = shop?.name || user?.shop_name || 'Editorial Merchant'

  const shopLogoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null

  const bottomCardSubtitle = user?.full_name || user?.role || 'owner'

  return (
    <aside className="flex h-full w-[260px] flex-col bg-[#f3f5f9] px-5 py-6">
      <div className="flex items-start gap-3 px-2">
        {shopLogoUrl ? (
          <img
            src={shopLogoUrl}
            alt={shopName}
            className="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <span className="text-lg font-bold">{getInitial(shopName)}</span>
          </div>
        )}

        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold leading-6 text-indigo-600">
            {shopName}
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Premium Retail Admin
          </p>
        </div>
      </div>

      <nav className="mt-10 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition ${
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

      <div className="mt-auto space-y-4">
        <Link
          to="/billing"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700"
        >
          <PlusCircle size={20} />
          New Transaction
        </Link>

        <Link
          to="/profile"
          className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-md"
        >
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={shopName}
              className="h-12 w-12 rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700 transition duration-300 group-hover:scale-105">
              {getInitial(shopName)}
            </div>
          )}

          <div className="min-w-0">
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
}