export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options?: Record<string, unknown>) => void
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean
            isSkippedMoment: () => boolean
            isDisplayed: () => boolean
          }) => void) => void
          disableAutoSelect: () => void
        }
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              expires_in?: number
              error?: string
              error_description?: string
            }) => void
          }) => {
            requestAccessToken: (overrides?: { prompt?: '' | 'consent' | 'select_account' }) => void
          }
          revoke: (token: string, callback?: () => void) => void
        }
      }
    }
  }
}
