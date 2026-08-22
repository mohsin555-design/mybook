import { create } from 'zustand'

interface AppState {
  isNavigationOpen: boolean
  theme: 'light' | 'dark'
  closeNavigation: () => void
  toggleTheme: () => void
  toggleNavigation: () => void
}

function applyTheme(theme: AppState['theme']) {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useAppStore = create<AppState>((set) => ({
  isNavigationOpen: false,
  theme: 'light',
  closeNavigation: () => set({ isNavigationOpen: false }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light'
      applyTheme(theme)
      return { theme }
    }),
  toggleNavigation: () =>
    set((state) => ({ isNavigationOpen: !state.isNavigationOpen })),
}))
