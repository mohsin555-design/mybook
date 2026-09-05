// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditorStatus } from './EditorStatus'

describe('EditorStatus', () => {
  afterEach(() => cleanup())

  it('shows pending Drive sync as saved locally instead of synced', () => {
    render(<EditorStatus status="pending" />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved locally')
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()
  })

  it('keeps local workspace status free of Drive terminology', () => {
    render(<EditorStatus status="saved-locally" workspace="local" />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByText(/Drive|Sync/i)).not.toBeInTheDocument()
  })

  it.each([
    ['editing', 'Saving...'],
    ['saving-locally', 'Saving...'],
    ['saved-locally', 'Saved locally'],
    ['pending', 'Saved locally'],
    ['backing-up', 'Syncing...'],
    ['backed-up', 'Synced'],
    ['offline', 'Saved locally · Offline'],
    ['failed', 'Saved locally · Sync failed'],
  ] as const)('maps Google workspace %s to %s', (status, label) => {
    render(<EditorStatus status={status} workspace="drive" />)

    expect(screen.getByRole('status')).toHaveTextContent(label)
  })

  it('shows retry for failed sync', () => {
    const retry = vi.fn()
    render(<EditorStatus status="failed" onRetry={retry} />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved locally · Sync failed')
    screen.getByRole('button', { name: 'Retry' }).click()
    expect(retry).toHaveBeenCalled()
  })

  it('distinguishes local save failure from Drive sync failure', () => {
    render(<EditorStatus status="failed" workspace="local" />)

    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save")
  })
})
