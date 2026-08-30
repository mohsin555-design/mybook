import { create } from 'zustand'
import type { StateStorage } from 'zustand/middleware'
import { createJSONStorage, persist } from 'zustand/middleware'

export type WorkspaceMode = 'local' | 'drive'

interface WorkspaceState {
  mode: WorkspaceMode | null
  createLocalWorkspace: () => void
  selectGoogleWorkspace: () => void
  clearWorkspace: () => void
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
      createLocalWorkspace: () => set({ mode: 'local' }),
      selectGoogleWorkspace: () => set({ mode: 'drive' }),
      clearWorkspace: () => set({ mode: null }),
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
