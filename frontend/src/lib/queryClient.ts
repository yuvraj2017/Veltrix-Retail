import { QueryClient } from '@tanstack/react-query'

/**
 * Shared query client.
 *
 * Before this, every page refetched from scratch on each mount, so navigating
 * Billing -> Products -> Billing re-ran every request even though nothing had
 * changed. These defaults make a return visit render instantly from cache
 * while a background refresh runs.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 60s. Within that window, navigating back
      // to a page is served entirely from cache with no network request.
      staleTime: 60_000,

      // Keep unused data for 5 minutes so back-navigation still hits cache.
      gcTime: 5 * 60_000,

      // This is a back-office tool that people leave open in a tab all day;
      // refetching on every window focus would produce constant chatter.
      refetchOnWindowFocus: false,

      // The 401 interceptor in lib/api.ts already redirects on an expired
      // session. Retrying auth failures would just delay that redirect.
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})
