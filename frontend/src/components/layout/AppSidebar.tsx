import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  Package,
  ReceiptText,
  Users,
  Settings,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  ShieldCheck,
  UserCheck,
  ScrollText,
  CreditCard,
  ClipboardList,
  Warehouse,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { PERMISSIONS } from '../../features/staff/constants'

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.dashboardView },
  { name: 'Products', to: '/products', icon: Package, permission: PERMISSIONS.productsView },
  { name: 'Inventory', to: '/inventory', icon: Warehouse, permission: PERMISSIONS.inventoryView },
  { name: 'Vendors', to: '/vendors', icon: Handshake, permission: PERMISSIONS.vendorsView },
  { name: 'Purchasing', to: '/purchase-orders', icon: ClipboardList, permission: PERMISSIONS.purchasingView },
  { name: 'Billing', to: '/billing', icon: ReceiptText, permission: PERMISSIONS.salesView },
  { name: 'Customers', to: '/customers', icon: Users, permission: PERMISSIONS.customersView },
  { name: 'Expenses', to: '/expenses', icon: Wallet, permission: PERMISSIONS.expensesView },
  { name: 'Reports', to: '/reports', icon: BarChart3, permission: PERMISSIONS.reportsView },
  { name: 'Staff', to: '/staff', icon: UserCheck, permission: PERMISSIONS.staffView },
  { name: 'Subscription', to: '/subscription', icon: CreditCard, permission: PERMISSIONS.subscriptionView },
  { name: 'Settings', to: '/settings', icon: Settings, permission: PERMISSIONS.settingsView },
]

// Rendered only for super admins. A regular user sees no trace of this
// section; if one navigated to /admin directly, AdminRoute redirects and
// every underlying request would be refused server-side anyway.
const adminNavItems = [
  { name: 'Overview', to: '/admin', icon: ShieldCheck, end: true },
  { name: 'Users', to: '/admin/users', icon: UserCheck, end: false },
  { name: 'Plans', to: '/admin/plans', icon: CreditCard, end: false },
  { name: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText, end: false },
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
  const { user, shop, isSuperAdmin, hasPermission } = useAuth()
  const { selectedBranch, activeShop } = useBranch()

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) onClose()
    const handleResize = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) onClose()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])

  // Platform administrators are not a shop, so they are labelled as what
  // they are rather than borrowing a shop identity.
  const shopName = isSuperAdmin
    ? 'Platform Admin'
    : selectedBranch?.name || shop?.name || user?.shop_name || 'Editorial Merchant'
  const shopLogoUrl =
    resolveImageUrl(activeShop?.logo_url) ||
    resolveImageUrl(selectedBranch?.id === shop?.id ? shop?.logo_url || user?.shop_logo_url : null) ||
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

      <div className={`flex shrink-0 items-start gap-3 py-4 ${isOpen ? 'px-5' : 'justify-center px-3'}`}>
        {shopLogoUrl ? (
          <img
            src={shopLogoUrl}
            alt={shopName}
            className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-cover shadow-sm"
            decoding="async"
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
            {isSuperAdmin ? 'Platform Control' : 'Premium Retail Admin'}
          </p>
        </div>
      </div>

      {/* Shop navigation. A super admin owns no shop, so none of this
          applies to them -- they get the Administration group below. */}
      <nav
        className={`min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-2 ${isOpen ? 'px-5' : 'px-2'} ${
          isSuperAdmin ? 'hidden' : ''
        }`}
      >
        {navItems.filter((item) => hasPermission(item.permission)).map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.to}
              title={!isOpen ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl py-2.5 text-base font-medium transition-all duration-200 ${
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

      {isSuperAdmin && (
        <nav
          aria-label="Administration"
          className={`min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-2 ${isOpen ? 'px-5' : 'px-2'}`}
        >
          <p
            className={`mb-1 overflow-hidden text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap text-slate-400 transition-all duration-300 dark:text-slate-500 ${
              isOpen ? 'max-w-[160px] px-4 opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            Administration
          </p>

          {adminNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.to}
                end={item.end}
                title={!isOpen ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl py-2.5 text-base font-medium transition-all duration-200 ${
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
      )}

      <div className={`mt-auto shrink-0 space-y-3 pb-4 pt-2 ${isOpen ? 'px-5' : 'px-2'}`}>
        {hasPermission(PERMISSIONS.salesCreate) && <Link
          to="/billing/new"
          title={!isOpen ? 'New Transaction' : undefined}
          className={`flex w-full items-center gap-2 rounded-2xl bg-indigo-600 dark:bg-indigo-700 py-3 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:hover:bg-indigo-600 ${
            isOpen ? 'justify-center px-4' : 'justify-center px-0'
          } ${isSuperAdmin ? 'hidden' : ''}`}
        >
          <PlusCircle size={20} className="shrink-0" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            New Transaction
          </span>
        </Link>}

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
              decoding="async"
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

