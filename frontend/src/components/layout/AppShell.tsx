import type { ReactNode } from 'react'
import { useState } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="h-screen overflow-hidden bg-[#f7f8fc]">
      <div className="flex h-full">
        {/* Sidebar wrapper — width animates with the sidebar state */}
        <div
          className="h-full shrink-0 overflow-y-auto transition-all duration-300 ease-in-out"
          style={{ width: sidebarOpen ? '260px' : '72px' }}
        >
          <AppSidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((prev) => !prev)}
            onClose={() => setSidebarOpen(false)}
          />
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