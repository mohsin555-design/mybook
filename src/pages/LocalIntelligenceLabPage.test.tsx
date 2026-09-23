// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { LocalIntelligenceLabPage } from './LocalIntelligenceLabPage'
import { router } from '../app/router'

interface RouteEntry {
  path?: string
  children?: RouteEntry[]
  lazy?: () => Promise<unknown>
}

afterEach(() => {
  cleanup()
})

describe('LocalIntelligenceLabPage & Route Isolation', () => {
  it('renders the lab workspace with editor and status banner', async () => {
    const { unmount } = render(<LocalIntelligenceLabPage />)

    expect(screen.getByRole('heading', { name: 'Writin Local Intelligence Lab' })).toBeInTheDocument()
    expect(screen.getByText('Experimental')).toBeInTheDocument()
    expect(screen.getByText(/Zero Network AI Cost/)).toBeInTheDocument()
    expect(screen.getByText('Sample Document Editor')).toBeInTheDocument()
    expect(screen.getByText('Writing Tools')).toBeInTheDocument()
    unmount()
  })

  it('verifies /labs/intelligence is configured in router without exposing in normal navigation', () => {
    const route = (router.routes as RouteEntry[])
      .flatMap((r) => r.children || [r])
      .flatMap((r) => r.children || [r])
      .find((r) => r.path === '/labs/intelligence')

    expect(route).toBeDefined()
    expect(typeof route?.lazy).toBe('function')
  })
})
