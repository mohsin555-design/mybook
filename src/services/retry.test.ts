import { describe, expect, it, vi } from 'vitest'

import { retryWithBackoff } from './googleDrive'

describe('Drive retry logic', () => {
  it('retries transient failures with bounded attempts', async () => {
    vi.useFakeTimers()
    let calls = 0
    const task = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw new Error('temporary')
      return 'ok'
    })
    const result = retryWithBackoff(task, 3)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
