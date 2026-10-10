// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { rowGripMenuTop, tableMenuTop } from './tableMenuPosition'

describe('tableMenuTop', () => {
  it('uses the measured menu height when opening above a bottom row grip', () => {
    expect(tableMenuTop(700, 718, 300)).toBe(392)
  })
})

describe('rowGripMenuTop', () => {
  it('anchors directly to the grip icon top when there is room below', () => {
    expect(rowGripMenuTop(200, 218, 250)).toBe(200)
  })

  it('anchors to the grip icon bottom when near the bottom of the viewport', () => {
    expect(rowGripMenuTop(700, 718, 300)).toBe(418)
  })
})