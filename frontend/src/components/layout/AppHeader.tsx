import { Bell, CircleHelp, Plus, Search } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function resolveImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

function getInitial(name?: string | null) {
  if (!name) return "U";
  return name.trim().charAt(0).toUpperCase();
}

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, shop } = useAuth();

  const shopName = shop?.name || user?.shop_name || "Veltrix Retail";
  const logoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null;

  const userLabel = user?.full_name || user?.role || "Store Admin";

  const searchPlaceholder = useMemo(() => {
    if (location.pathname.startsWith("/vendors")) {
      return "Search vendors, bills or payments...";
    }
    if (location.pathname.startsWith("/products")) {
      return "Search inventory products...";
    }
    if (location.pathname.startsWith("/billing")) {
      return "Search invoices or transactions...";
    }
    return "Search dashboard...";
  }, [location.pathname]);

  const quickAddRoute = useMemo(() => {
    if (location.pathname.startsWith("/vendors")) return "/vendors/new";
    if (location.pathname.startsWith("/products")) return "/products/new";
    return "/products/new";
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-[#f7f9ff]/78 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="relative hidden flex-1 md:block">
          <Search
            size={18}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500"
          />

          <input
            type="text"
            placeholder={searchPlaceholder}
            className="h-14 w-full rounded-[22px] border border-indigo-200/70 bg-white/75 pl-14 pr-28 text-[15px] font-medium text-slate-700 shadow-[0_10px_35px_rgba(99,102,241,0.08)] outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-400 focus:bg-white focus:shadow-[0_18px_48px_rgba(79,70,229,0.16)]"
          />

          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 shadow-sm">
            Global
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="group rounded-2xl border border-transparent bg-white/70 p-3 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
          >
            <Bell size={20} className="transition-transform group-hover:scale-110" />
          </button>

          <button
            type="button"
            className="group rounded-2xl border border-transparent bg-white/70 p-3 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
          >
            <CircleHelp
              size={20}
              className="transition-transform group-hover:rotate-6"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate(quickAddRoute)}
            className="group inline-flex items-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_22px_48px_rgba(79,70,229,0.36)]"
          >
            <Plus size={18} className="transition-transform group-hover:rotate-90" />
            Quick Add
          </button>

          <div className="hidden items-center gap-3 rounded-[20px] bg-white/75 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)] sm:flex">
            <div className="text-right">
              <p className="max-w-[120px] truncate text-sm font-semibold text-slate-900">
                {shopName}
              </p>
              <p className="max-w-[120px] truncate text-xs text-slate-500">
                {userLabel}
              </p>
            </div>

            {logoUrl ? (
              <img
                src={logoUrl}
                alt={shopName}
                className="h-11 w-11 rounded-full border border-slate-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md">
                {getInitial(shopName)}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}