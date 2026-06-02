import { Bell, CircleHelp, Plus, Search, X } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
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

  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const shopName = shop?.name || user?.shop_name || "Veltrix Retail";
  const logoUrl =
    resolveImageUrl(shop?.logo_url) ||
    resolveImageUrl(user?.shop_logo_url) ||
    null;

  const userLabel = user?.full_name || user?.role || "Store Admin";

  const searchPlaceholder = useMemo(() => {
    if (location.pathname.startsWith("/vendors"))
      return "Search vendors, bills or payments...";
    if (location.pathname.startsWith("/products"))
      return "Search inventory products...";
    if (location.pathname.startsWith("/billing"))
      return "Search invoices or transactions...";
    return "Search dashboard...";
  }, [location.pathname]);

  const quickAddRoute = useMemo(() => {
    if (location.pathname.startsWith("/vendors")) return "/vendors/new";
    if (location.pathname.startsWith("/products")) return "/products/new";
    return "/products/new";
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  // ─── Avatar element (reused in both layouts) ───────────────────────────────
  const Avatar = ({ size }: { size: "sm" | "lg" }) => {
    const cls =
      size === "sm"
        ? "h-9 w-9 text-xs"
        : "h-11 w-11 text-sm";
    return logoUrl ? (
      <img
        src={logoUrl}
        alt={shopName}
        className={`${cls} rounded-full border border-slate-200 object-cover shadow-sm`}
      />
    ) : (
      <div
        className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-md`}
      >
        {getInitial(shopName)}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-[#f7f9ff]/78 backdrop-blur-xl">

      {/* ════════════════════════════════════════════════════
          MOBILE + TABLET  (hidden on lg+)
          Layout: [spacer] [Search] [Bell] [Quick Add] [Avatar]
      ════════════════════════════════════════════════════ */}
      <div className="lg:hidden">

        {/* Search overlay row */}
        {searchOpen ? (
          <div className="flex items-center gap-2 px-3 py-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder={searchPlaceholder}
                className="h-12 w-full rounded-[20px] border border-indigo-200/70 bg-white/90 pl-11 pr-4 text-[14px] font-medium text-slate-700 shadow-[0_8px_28px_rgba(99,102,241,0.10)] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:shadow-[0_14px_40px_rgba(79,70,229,0.16)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm transition-all hover:border-indigo-100 hover:text-indigo-600"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          /* Normal mobile/tablet row */
          <div className="flex items-center justify-end gap-2 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">

            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group rounded-2xl border border-transparent bg-white/70 p-2.5 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
            >
              <Search size={18} className="transition-transform group-hover:scale-110" />
            </button>

            {/* Bell */}
            <button
              type="button"
              className="group rounded-2xl border border-transparent bg-white/70 p-2.5 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
            >
              <Bell size={18} className="transition-transform group-hover:scale-110" />
            </button>

            {/* Quick Add */}
            <button
              type="button"
              onClick={() => navigate(quickAddRoute)}
              className="group inline-flex items-center gap-1.5 rounded-[18px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_16px_40px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_22px_48px_rgba(79,70,229,0.36)] sm:px-4 sm:py-3 sm:text-[14px]"
            >
              <Plus size={16} className="transition-transform group-hover:rotate-90" />
              <span>Quick Add</span>
            </button>

            {/* Avatar only — no text */}
            <div className="flex items-center rounded-[16px] bg-white/75 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <Avatar size="sm" />
            </div>

          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          DESKTOP  (hidden below lg)
          Original layout: [Search bar] [Bell] [Help] [Quick Add] [User card]
      ════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:items-center lg:gap-4 lg:px-8 lg:py-4 mb-1">

        {/* Search bar */}
        <div className="relative flex-1">
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
          {/* Bell */}
          <button
            type="button"
            className="group rounded-2xl border border-transparent bg-white/70 p-3 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
          >
            <Bell size={20} className="transition-transform group-hover:scale-110" />
          </button>

          {/* Help */}
          <button
            type="button"
            className="group rounded-2xl border border-transparent bg-white/70 p-3 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-[1px] hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
          >
            <CircleHelp size={20} className="transition-transform group-hover:rotate-6" />
          </button>

          {/* Quick Add */}
          <button
            type="button"
            onClick={() => navigate(quickAddRoute)}
            className="group inline-flex items-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_22px_48px_rgba(79,70,229,0.36)]"
          >
            <Plus size={18} className="transition-transform group-hover:rotate-90" />
            Quick Add
          </button>

          {/* User card with text + avatar */}
          <div className="flex items-center gap-3 rounded-[20px] bg-white/75 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="text-right">
              <p className="max-w-[120px] truncate text-sm font-semibold text-slate-900">
                {shopName}
              </p>
              <p className="max-w-[120px] truncate text-xs text-slate-500">
                {userLabel}
              </p>
            </div>
            <Avatar size="lg" />
          </div>
        </div>
      </div>

    </header>
  );
}