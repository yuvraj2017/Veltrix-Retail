import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-[#f7f8fc]">
      <div className="flex h-full">
        <div className="h-full w-[260px] shrink-0 overflow-y-auto">
          <AppSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0">
            <AppHeader />
          </div>

          <main className="flex-1 overflow-y-auto px-8 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}