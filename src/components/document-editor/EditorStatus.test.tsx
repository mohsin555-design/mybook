// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditorStatus } from './EditorStatus'

describe('EditorStatus', () => {
  afterEach(() => cleanup())

  it('keeps pending Drive sync out of the header status', () => {
    render(<EditorStatus status="pending" simplified />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()
  })

  it('keeps local workspace status free of Drive terminology', () => {
    render(<EditorStatus status="saved-locally" workspace="local" simplified />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByText(/Drive|Sync/i)).not.toBeInTheDocument()
  })

  it.each([
    ['editing', 'Saving…'],
    ['saving-locally', 'Saving…'],
    ['saved-locally', 'Saved'],
    ['pending', 'Saved'],
    ['backing-up', 'Saving…'],
    ['backed-up', 'Saved'],
    ['offline', 'Saved'],
    ['failed', 'Saved'],
  ] as const)('maps Google workspace %s to %s', (status, label) => {
    render(<EditorStatus status={status} workspace="drive" simplified />)

    expect(screen.getByRole('status')).toHaveTextContent(label)
  })

  it('keeps cloud sync retry actions out of the simplified header', () => {
    render(<EditorStatus status="failed" simplified />)

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('preserves the retry action for other editor status uses', () => {
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
