/**
 * Shown while a lazily-loaded route chunk is being fetched.
 * Mirrors the general shape of the app's pages (header block + cards)
 * so the transition does not feel like a blank flash.
 */
export function RouteFallback() {
  return (
    <div className="animate-pulse space-y-6 py-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-7 w-64 rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-80 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-28 rounded-[2rem] bg-white shadow-sm dark:bg-slate-800"
          />
        ))}
      </div>

      <div className="h-72 rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
    </div>
  )
}

/** Full-viewport variant for public (unauthenticated) routes. */
export function PublicRouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8faff] dark:bg-slate-950">
      <div className="w-full max-w-[520px] animate-pulse space-y-5 px-6" aria-busy="true">
        <div className="h-8 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-72 rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-12 rounded-2xl bg-white shadow-sm dark:bg-slate-800" />
        <div className="h-12 rounded-2xl bg-white shadow-sm dark:bg-slate-800" />
        <div className="h-12 rounded-2xl bg-indigo-200 dark:bg-indigo-900" />
      </div>
    </div>
  )
}
