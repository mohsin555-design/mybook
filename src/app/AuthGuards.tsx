import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '../stores/useAuthStore'

export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectAuthenticated() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return isAuthenticated ? <Navigate to="/home" replace /> : <Outlet />
}
