import { describe, expect, it } from 'vitest'

import { hasUnsavedLocalEdits, registerUnsavedEditsProbe } from './localEditState'

describe('localEditState', () => {
  it('reports no unsaved edits without a registered editor', () => {
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
  })

  it('asks the live probe each time', () => {
    let dirty = true
    const unregister = registerUnsavedEditsProbe('file-1', () => dirty)
    expect(hasUnsavedLocalEdits('file-1')).toBe(true)
    dirty = false
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
    unregister()
  })

  it('ignores a stale unregister from a replaced editor', () => {
    const unregisterOld = registerUnsavedEditsProbe('file-1', () => false)
    const unregisterNew = registerUnsavedEditsProbe('file-1', () => true)
    unregisterOld()
    expect(hasUnsavedLocalEdits('file-1')).toBe(true)
    unregisterNew()
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
  })
})
