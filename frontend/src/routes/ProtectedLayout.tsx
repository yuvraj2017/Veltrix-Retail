import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { RouteFallback } from '../components/layout/RouteFallback'

export function ProtectedLayout() {
  return (
    <AppShell>
      {/*
        The Suspense boundary sits inside AppShell so that the sidebar and
        header remain mounted and interactive while the next lazily-loaded
        page chunk downloads. Only the main content area shows a skeleton.
      */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
}
