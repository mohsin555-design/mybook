import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: () => Promise<boolean>
  logout: () => void
  clearError: () => void
}

const MOCK_LOGIN_DELAY = 900

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      clearError: () => set({ error: null }),
      login: async () => {
        set({ isLoading: true, error: null })

        try {
          await new Promise((resolve) => window.setTimeout(resolve, MOCK_LOGIN_DELAY))
          set({ isAuthenticated: true, isLoading: false })
          return true
        } catch {
          set({
            error: 'We could not sign you in. Please try again.',
            isLoading: false,
          })
          return false
        }
      },
      logout: () => set({ isAuthenticated: false, isLoading: false, error: null }),
    }),
    {
      name: 'mybook-auth',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    },
  ),
)
