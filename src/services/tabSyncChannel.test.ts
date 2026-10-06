import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { broadcastDocUpdate, getTabId, subscribeToTabDocUpdates } from './tabSyncChannel'

describe('tabSyncChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides a unique tab identifier', () => {
    expect(typeof getTabId()).toBe('string')
    expect(getTabId().length).toBeGreaterThan(0)
  })

  it('allows subscribing and unsubscribing to doc updates', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTabDocUpdates(listener)
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('does not throw when broadcasting without broadcast support', () => {
    expect(() => broadcastDocUpdate('file-1', 'content', 'Title')).not.toThrow()
  })
})
