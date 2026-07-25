import { describe, expect, it } from 'vitest'

import { isDriveVersionNewer } from './conflict'

describe('Drive conflict detection', () => {
  it('detects a newer Drive timestamp without modifying either copy', () => {
    expect(isDriveVersionNewer('2026-01-01T10:00:00.000Z', '2026-01-01T10:00:01.000Z')).toBe(true)
    expect(isDriveVersionNewer('2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')).toBe(false)
    expect(isDriveVersionNewer(null, '2026-01-01T10:00:01.000Z')).toBe(false)
  })
})
