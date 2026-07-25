// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { RedirectAuthenticated, RequireAuth } from './AuthGuards'
import { useAuthStore } from '../stores/useAuthStore'

describe('route protection', () => {
  beforeEach(() => useAuthStore.setState({ isAuthenticated: false, error: null }))

  it('redirects unauthenticated users to login', () => {
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects authenticated users away from login', () => {
    useAuthStore.setState({ isAuthenticated: true })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})
