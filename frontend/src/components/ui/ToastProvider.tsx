import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

type ToastInput = {
  title?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
}

type Toast = Required<Pick<ToastInput, 'message' | 'variant' | 'durationMs'>> & {
  id: string
  title?: string
}

type ToastContextValue = {
  showToast: (toast: ToastInput) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2
    panel: string
    accent: string
    aura: string
    iconBox: string
    title: string
    eyebrow: string
    progress: string
  }
> = {
  success: {
    icon: CheckCircle2,
    panel: 'border-emerald-200 bg-white text-slate-800 shadow-[0_24px_70px_rgba(16,185,129,0.24)] dark:border-emerald-800/70 dark:bg-slate-950 dark:text-slate-100',
    accent: 'from-emerald-400 via-teal-400 to-cyan-400',
    aura: 'bg-emerald-400/20',
    iconBox: 'bg-emerald-500 text-white shadow-[0_14px_34px_rgba(16,185,129,0.36)]',
    title: 'text-slate-950 dark:text-white',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    progress: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    panel: 'border-red-200 bg-white text-slate-800 shadow-[0_24px_70px_rgba(239,68,68,0.25)] dark:border-red-800/70 dark:bg-slate-950 dark:text-slate-100',
    accent: 'from-red-500 via-rose-500 to-orange-400',
    aura: 'bg-red-500/20',
    iconBox: 'bg-red-600 text-white shadow-[0_14px_34px_rgba(239,68,68,0.38)]',
    title: 'text-slate-950 dark:text-white',
    eyebrow: 'text-red-700 dark:text-red-300',
    progress: 'bg-red-500',
  },
  warning: {
    icon: TriangleAlert,
    panel: 'border-amber-200 bg-white text-slate-800 shadow-[0_24px_70px_rgba(245,158,11,0.25)] dark:border-amber-800/70 dark:bg-slate-950 dark:text-slate-100',
    accent: 'from-amber-400 via-orange-400 to-red-400',
    aura: 'bg-amber-400/20',
    iconBox: 'bg-amber-500 text-white shadow-[0_14px_34px_rgba(245,158,11,0.36)]',
    title: 'text-slate-950 dark:text-white',
    eyebrow: 'text-amber-700 dark:text-amber-300',
    progress: 'bg-amber-500',
  },
  info: {
    icon: Info,
    panel: 'border-indigo-200 bg-white text-slate-800 shadow-[0_24px_70px_rgba(79,70,229,0.24)] dark:border-indigo-800/70 dark:bg-slate-950 dark:text-slate-100',
    accent: 'from-indigo-500 via-violet-500 to-sky-400',
    aura: 'bg-indigo-500/20',
    iconBox: 'bg-indigo-600 text-white shadow-[0_14px_34px_rgba(79,70,229,0.36)]',
    title: 'text-slate-950 dark:text-white',
    eyebrow: 'text-indigo-700 dark:text-indigo-300',
    progress: 'bg-indigo-500',
  },
}

const variantLabels: Record<ToastVariant, string> = {
  success: 'Success',
  error: 'Action Needed',
  warning: 'Attention',
  info: 'Notice',
}

function createToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const styles = variantStyles[toast.variant]
  const Icon = styles.icon

  useEffect(() => {
    if (toast.durationMs <= 0) return undefined
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs)
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.durationMs, toast.id])

  return (
    <div
      role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
      className={`toast-pop pointer-events-auto relative w-full overflow-hidden rounded-[1.35rem] border p-1 shadow-2xl backdrop-blur-xl ${styles.panel}`}
      style={{ '--toast-duration': `${toast.durationMs}ms` } as CSSProperties}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${styles.accent}`} />
      <div className={`pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full blur-3xl ${styles.aura}`} />
      <div className="relative flex items-start gap-4 rounded-[1.1rem] bg-white/90 p-4 pr-3 dark:bg-slate-950/88">
        <div className="relative shrink-0">
          <span className={`absolute inset-0 rounded-2xl ${styles.iconBox} toast-ping opacity-35`} />
          <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${styles.iconBox}`}>
            <Icon size={23} />
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${styles.eyebrow}`}>
            {variantLabels[toast.variant]}
          </p>
          {toast.title && (
            <p className={`mt-1 text-base font-black leading-5 ${styles.title}`}>{toast.title}</p>
          )}
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Dismiss notification"
        >
          <X size={17} />
        </button>
      </div>
      {toast.durationMs > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800">
          <div className={`toast-progress h-full rounded-r-full ${styles.progress}`} />
        </div>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const id = createToastId()
    setToasts((current) => [
      ...current.slice(-3),
      {
        id,
        title: input.title,
        message: input.message,
        variant: input.variant ?? 'info',
        durationMs: input.durationMs ?? 4500,
      },
    ])
    return id
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-5 z-[200] flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col gap-3 sm:top-6">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
