// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { tableMenuTop } from './tableMenuPosition'

describe('tableMenuTop', () => {
  it('uses the measured menu height when opening above a bottom row grip', () => {
    expect(tableMenuTop(700, 718, 300)).toBe(392)
  })
})