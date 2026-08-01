// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { getFriendlyGoogleAuthError, isTokenFresh, useAuthStore } from './useAuthStore'

describe('auth helpers', () => {
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
})
