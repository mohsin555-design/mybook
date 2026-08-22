import { describe, expect, it } from 'vitest'

import { getSafeReturnPath } from './navigation'

describe('navigation helpers', () => {
  it('allows internal return paths', () => {
    expect(getSafeReturnPath('/settings')).toBe('/settings')
  })

  it('falls back for missing or external return paths', () => {
    expect(getSafeReturnPath(null)).toBe('/home')
    expect(getSafeReturnPath('https://example.com')).toBe('/home')
    expect(getSafeReturnPath('//example.com')).toBe('/home')
  })
})
