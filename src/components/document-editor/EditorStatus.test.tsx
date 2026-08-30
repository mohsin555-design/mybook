// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditorStatus } from './EditorStatus'

describe('EditorStatus', () => {
  afterEach(() => cleanup())

  it('shows pending Drive sync as saved locally instead of endless saving', () => {
    render(<EditorStatus status="pending" />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
  })

  it('shows retry for failed sync', () => {
    const retry = vi.fn()
    render(<EditorStatus status="failed" onRetry={retry} />)

    expect(screen.getByRole('status')).toHaveTextContent("Couldn't sync")
    screen.getByRole('button', { name: 'Retry' }).click()
    expect(retry).toHaveBeenCalled()
  })
})
