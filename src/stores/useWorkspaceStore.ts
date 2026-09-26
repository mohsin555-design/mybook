import { create } from 'zustand'
import type { StateStorage } from 'zustand/middleware'
import { createJSONStorage, persist } from 'zustand/middleware'

export type WorkspaceMode = 'local' | 'drive'

interface WorkspaceState {
  mode: WorkspaceMode | null
  workspaceRevision: number
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
      createLocalWorkspace: () => set((state) => ({ mode: 'local', workspaceRevision: state.workspaceRevision + 1 })),
      selectGoogleWorkspace: () => set((state) => ({ mode: 'drive', workspaceRevision: state.workspaceRevision + 1 })),
      clearWorkspace: () => set((state) => ({ mode: null, workspaceRevision: state.workspaceRevision + 1 })),
      bumpWorkspaceRevision: () => set((state) => ({ workspaceRevision: state.workspaceRevision + 1 })),
    }),
    {
      name: 'mybook-workspace',
      storage: createJSONStorage(() => (typeof localStorage === 'undefined' ? fallbackStorage : localStorage)),
    },
  ),
)

export function isLocalWorkspace() {
  return useWorkspaceStore.getState().mode === 'local'
}

export function shouldSyncWithDrive() {
  return useWorkspaceStore.getState().mode !== 'local'
}
