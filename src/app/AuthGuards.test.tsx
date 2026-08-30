// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RedirectAuthenticated, RequireAuth } from './AuthGuards'
import { LegacyGoogleAuthStartRedirect } from './LegacyGoogleAuthStartRedirect'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

function LoginState() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  return <p>Login from {state?.from ?? 'none'}</p>
}

describe('route protection', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, error: null })
    useWorkspaceStore.setState({ mode: null })
  })

  it('redirects unauthenticated users to login', () => {
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects authenticated users away from login', () => {
    useAuthStore.setState({ isAuthenticated: true })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('allows local workspace users without a Google session', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('redirects local workspace users away from login', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('preserves legacy Google auth return paths', () => {
    render(<MemoryRouter initialEntries={['/api/auth/google/start?returnTo=%2Fsettings']}><Routes><Route path="/api/auth/google/start" element={<LegacyGoogleAuthStartRedirect />} /><Route path="/login" element={<LoginState />} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login from /settings')).toBeInTheDocument()
  })
})
