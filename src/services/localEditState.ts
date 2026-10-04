type UnsavedEditsProbe = () => boolean

const probes = new Map<string, UnsavedEditsProbe>()

// The open editor registers a probe so the sync layer can ask, without timing
// heuristics, whether the user holds edits that are not persisted yet.
export function registerUnsavedEditsProbe(fileId: string, probe: UnsavedEditsProbe) {
  probes.set(fileId, probe)
  return () => {
    if (probes.get(fileId) === probe) probes.delete(fileId)
  }
}

export function hasUnsavedLocalEdits(fileId: string) {
  return probes.get(fileId)?.() ?? false
}
