// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LoadingOverlay } from './LoadingOverlay'

describe('LoadingOverlay', () => {
  afterEach(() => cleanup())

  it('renders default message and status role', () => {
    render(<LoadingOverlay />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<LoadingOverlay message="Checking your session…" />)
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('renders spinner element', () => {
    const { container } = render(<LoadingOverlay />)
    const spinner = container.querySelector('[data-slot="spinner"]')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
  })
})
