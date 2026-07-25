// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppButton } from './common/AppButton'
import { MobileBottomNavigation } from './layout/MobileBottomNavigation'

describe('critical accessibility components', () => {
  it('exposes primary mobile navigation as a labelled landmark', () => {
    render(<MemoryRouter><MobileBottomNavigation /></MemoryRouter>)
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('renders buttons with a touch-target class and accessible name', () => {
    render(<AppButton>Back up now</AppButton>)
    const button = screen.getByRole('button', { name: 'Back up now' })
    expect(button).toHaveClass('min-h-11')
  })
})
