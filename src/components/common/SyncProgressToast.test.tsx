// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SyncProgressToast } from './SyncProgressToast'

afterEach(cleanup)

describe('SyncProgressToast', () => {
  it('does not render when isVisible is false', () => {
    const { container } = render(<SyncProgressToast isVisible={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders with label, default percentage and responsive classes when isVisible is true', () => {
    render(<SyncProgressToast isVisible={true} progress={0} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Fetching your data…')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()

    const aside = screen.getByRole('status')
    expect(aside).toHaveAttribute('aria-valuenow', '0')
    expect(aside).toHaveClass('sm:bottom-6')
    expect(aside).toHaveClass('sm:right-6')
    expect(aside).toHaveClass('bottom-[calc(4.75rem+env(safe-area-inset-bottom))]')
  })

  it('renders dynamic percentage progress correctly', () => {
    render(<SyncProgressToast isVisible={true} progress={65} />)

    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-valuenow', '65')
  })

  it('allows custom title and subtitle overrides', () => {
    render(
      <SyncProgressToast
        isVisible={true}
        title="Custom fetching title"
        subtitle="Downloading files..."
      />
    )

    expect(screen.getByText('Custom fetching title')).toBeInTheDocument()
    expect(screen.getByText('Downloading files...')).toBeInTheDocument()
  })
})
