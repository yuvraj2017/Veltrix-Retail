import type { ReactNode } from 'react'
import { useState } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
<div className="h-screen overflow-x-hidden bg-[#f7f8fc]">
      <div className="flex h-full">
        {/* Wrapper width tracks collapsed state — eliminates the dead space /}
        <div
          className={[
            'hidden h-full shrink-0 overflow-y-auto transition-all duration-300 ease-in-out md:block',
            collapsed ? 'w-[72px]' : 'w-[260px]',
          ].join(' ')}
        >
          <AppSidebar
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
          />
        </div>

        {/ Mobile: sidebar takes no layout space (fixed drawer) */}
        <div className="md:hidden">
          <AppSidebar
            collapsed={false}
            onCollapsedChange={() => {}}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0">
            <AppHeader />
          </div>

          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 md:px-6 lg:px-8 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}