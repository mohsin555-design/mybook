import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '../stores/useAuthStore'

export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const location = useLocation()

  if (isLoading) {
    return <div role="status" className="p-4 text-base text-muted-foreground">Checking session...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectAuthenticated() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) {
    return <div role="status" className="p-4 text-base text-muted-foreground">Checking session...</div>
  }

  return isAuthenticated ? <Navigate to="/home" replace /> : <Outlet />
}
