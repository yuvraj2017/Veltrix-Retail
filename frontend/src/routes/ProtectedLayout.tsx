import { Outlet } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'

export function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
