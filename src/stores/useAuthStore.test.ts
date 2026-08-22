// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authApiUrl, getFriendlyGoogleAuthError, isBackendAuthEnabled, isTokenFresh, useAuthStore } from './useAuthStore'

const canRunBrowserTokenTest = !isBackendAuthEnabled && Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim())

function createGoogleCredential(payload: Record<string, unknown>) {
  return [
    'header',
    btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    'signature',
  ].join('.')
}

describe('auth helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      email: null,
      accessToken: null,
      accessTokenExpiresAt: null,
    })
  })

  it('maps Google auth errors to clear messages', () => {
    expect(getFriendlyGoogleAuthError(new Error('access_denied'))).toMatch(/test user/i)
    expect(getFriendlyGoogleAuthError(new Error('invalid_client'))).toMatch(/OAuth client ID/i)
    expect(getFriendlyGoogleAuthError(new Error('Google sign-in was dismissed.'))).toMatch(/closed before completion/i)
  })

  it('detects fresh and expired tokens', () => {
    const now = Date.now()
    expect(isTokenFresh(now + 61_000)).toBe(true)
    expect(isTokenFresh(now + 30_000)).toBe(false)
    expect(isTokenFresh(null)).toBe(false)
  })

  it.skipIf(isBackendAuthEnabled)('completes Google credential login with a Drive access token', async () => {
    const requestAccessToken = vi.fn((overrides?: { prompt?: string }) => {
      expect(overrides).toEqual({ prompt: '' })
    })
    const tokenCallbacks: Array<(response: { access_token?: string; expires_in?: number }) => void> = []
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((config: { callback: (response: { access_token?: string; expires_in?: number }) => void }) => {
              tokenCallbacks.push(config.callback)
              return { requestAccessToken }
            }),
            revoke: vi.fn(),
          },
          id: {
            disableAutoSelect: vi.fn(),
            initialize: vi.fn(),
            prompt: vi.fn(),
            renderButton: vi.fn(),
          },
        },
      },
    })

    const credential = createGoogleCredential({
      email: 'Reader@Example.com',
      email_verified: true,
    })
    const loginPromise = useAuthStore.getState().completeLogin(credential, '')
    await vi.waitFor(() => expect(requestAccessToken).toHaveBeenCalled())
    const callback = tokenCallbacks[0]
    if (!callback) throw new Error('Google token callback was not registered.')
    callback({ access_token: 'drive-token', expires_in: 3600 })

    await expect(loginPromise).resolves.toBe(true)
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: 'drive-token',
      error: null,
    })
  })

  it('restores a valid login after the browser session is reopened', async () => {
    const expiresAt = Date.now() + 3_600_000
    useAuthStore.setState({
      isAuthenticated: false,
      email: null,
      accessToken: null,
      accessTokenExpiresAt: null,
    })
    localStorage.setItem('mybook-auth', JSON.stringify({
      state: {
        email: 'reader@example.com',
        accessToken: 'saved-token',
        accessTokenExpiresAt: expiresAt,
      },
      version: 0,
    }))
    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: 'saved-token',
      accessTokenExpiresAt: expiresAt,
    })
  })

  it('keeps the user signed in when the stored Drive token is expired', async () => {
    localStorage.setItem('mybook-auth', JSON.stringify({
      state: {
        email: 'reader@example.com',
        accessToken: 'expired-token',
        accessTokenExpiresAt: Date.now() - 1_000,
      },
      version: 0,
    }))

    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: null,
      accessTokenExpiresAt: null,
    })
  })

  it.skipIf(!canRunBrowserTokenTest)('silently renews an expired Drive token when Google allows it', async () => {
    const requestAccessToken = vi.fn((overrides?: { prompt?: string }) => {
      expect(overrides).toEqual({ prompt: '' })
    })
    const tokenCallbacks: Array<(response: { access_token?: string; expires_in?: number }) => void> = []
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((config: { callback: (response: { access_token?: string; expires_in?: number }) => void }) => {
              tokenCallbacks.push(config.callback)
              return { requestAccessToken }
            }),
            revoke: vi.fn(),
          },
          id: {
            disableAutoSelect: vi.fn(),
            initialize: vi.fn(),
            prompt: vi.fn(),
            renderButton: vi.fn(),
          },
        },
      },
    })

    useAuthStore.setState({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: null,
      accessTokenExpiresAt: null,
    })
    const tokenPromise = useAuthStore.getState().getAccessToken()
    await vi.waitFor(() => expect(requestAccessToken).toHaveBeenCalled())
    const callback = tokenCallbacks[0]
    if (!callback) throw new Error('Google token callback was not registered.')
    callback({ access_token: 'fresh-token', expires_in: 3600 })

    await expect(tokenPromise).resolves.toBe('fresh-token')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      accessToken: 'fresh-token',
      error: null,
    })
  })

  it.runIf(isBackendAuthEnabled)('requests a Drive token from the backend when server auth is enabled', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'backend-token',
      expiresIn: 3600,
      email: 'reader@example.com',
    }), { status: 200 }))

    useAuthStore.setState({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: null,
      accessTokenExpiresAt: null,
    })

    await expect(useAuthStore.getState().getAccessToken()).resolves.toBe('backend-token')
    expect(window.fetch).toHaveBeenCalledWith(authApiUrl('/token'), {
      method: 'POST',
      credentials: 'include',
    })
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      email: 'reader@example.com',
      accessToken: 'backend-token',
      error: null,
    })
  })
})
