import { describe, expect, it } from 'vitest'

import { formatUpdatedAt } from './dateFormat'

describe('formatUpdatedAt', () => {
  it('uses consistent relative and absolute app formatting', () => {
    const now = new Date('2026-08-29T12:00:00.000Z')

    expect(formatUpdatedAt('2026-08-29T11:59:45.000Z', now)).toBe('just now')
    expect(formatUpdatedAt('2026-08-29T11:59:00.000Z', now)).toBe('1 min ago')
    expect(formatUpdatedAt('2026-08-29T11:47:00.000Z', now)).toBe('13 mins ago')
    expect(formatUpdatedAt('2026-08-29T11:00:00.000Z', now)).toBe('1 hr ago')
    expect(formatUpdatedAt('2026-08-29T08:00:00.000Z', now)).toBe('4 hrs ago')
    expect(formatUpdatedAt('2026-08-29T05:05:00.000Z', now)).toBe('today, 5:05 AM')
    expect(formatUpdatedAt('2026-08-28T16:17:00.000Z', now)).toBe('yesterday, 4:17 PM')
    expect(formatUpdatedAt('2026-08-22T09:05:00.000Z', now)).toBe('Aug 22, 2026, 9:05 AM')
  })
})
