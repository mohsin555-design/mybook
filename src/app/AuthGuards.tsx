import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const location = useLocation()

  if (isLoading) {
    return <div role="status" className="p-4 text-base text-muted-foreground">Checking session...</div>
  }

  if (!isAuthenticated && workspaceMode !== 'local') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectAuthenticated() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const workspaceMode = useWorkspaceStore((state) => state.mode)

  if (isLoading) {
    return <div role="status" className="p-4 text-base text-muted-foreground">Checking session...</div>
  }

  return isAuthenticated || workspaceMode === 'local' ? <Navigate to="/home" replace /> : <Outlet />
}
