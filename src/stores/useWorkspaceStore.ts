import { create } from 'zustand'
import type { StateStorage } from 'zustand/middleware'
import { createJSONStorage, persist } from 'zustand/middleware'

export type WorkspaceMode = 'local' | 'drive'

interface WorkspaceState {
  mode: WorkspaceMode | null
  workspaceRevision: number
  isMirrorFolderMissing: boolean
  isMirroring: boolean
  mirrorProgress: number
  setMirrorFolderMissing: (missing: boolean) => void
  setMirrorProgress: (state: { isMirroring: boolean; progress: number }) => void
  createLocalWorkspace: () => void
  selectGoogleWorkspace: () => void
  clearWorkspace: () => void
  bumpWorkspaceRevision: () => void
}

const memoryStorage = new Map<string, string>()
const fallbackStorage: StateStorage = {
  getItem: (name) => memoryStorage.get(name) ?? null,
  setItem: (name, value) => { memoryStorage.set(name, value) },
  removeItem: (name) => { memoryStorage.delete(name) },
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      mode: null,
      workspaceRevision: 0,
      isMirrorFolderMissing: false,
      isMirroring: false,
      mirrorProgress: 0,
      setMirrorFolderMissing: (missing: boolean) =>
        set((state) => ({ isMirrorFolderMissing: missing, workspaceRevision: state.workspaceRevision + 1 })),
      setMirrorProgress: ({ isMirroring, progress }) => set({ isMirroring, mirrorProgress: progress }),
      createLocalWorkspace: () => set((state) => ({ mode: 'local', isMirrorFolderMissing: false, isMirroring: false, workspaceRevision: state.workspaceRevision + 1 })),
      selectGoogleWorkspace: () => set((state) => ({ mode: 'drive', isMirrorFolderMissing: false, isMirroring: false, workspaceRevision: state.workspaceRevision + 1 })),
      clearWorkspace: () => set((state) => ({ mode: null, isMirrorFolderMissing: false, isMirroring: false, workspaceRevision: state.workspaceRevision + 1 })),
      bumpWorkspaceRevision: () => set((state) => ({ workspaceRevision: state.workspaceRevision + 1 })),
    }),
    {
      name: 'mybook-workspace',
      storage: createJSONStorage(() => (typeof localStorage === 'undefined' ? fallbackStorage : localStorage)),
      partialize: (state) => ({
        mode: state.mode,
        workspaceRevision: state.workspaceRevision,
      }),
    },
  ),
)

export function isLocalWorkspace() {
  return useWorkspaceStore.getState().mode === 'local'
}

export function shouldSyncWithDrive() {
  return useWorkspaceStore.getState().mode !== 'local'
}
