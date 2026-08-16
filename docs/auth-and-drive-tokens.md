# Authentication and Drive Tokens

## Purpose

Authentication identifies the MyBook user and authorizes Google Drive backup/sync.

## Browser Flow

1. The login page renders the Google Sign-In button.
2. Google returns an ID credential.
3. MyBook verifies the credential payload and stores the verified email.
4. MyBook requests a Google Drive access token with the `drive.file` scope.
5. The auth state is persisted in `localStorage` under `mybook-auth`.
6. Protected app routes use `isAuthenticated` to decide whether the user can enter the app.

## Backend Flow

Set `VITE_GOOGLE_AUTH_MODE=server` to use backend refresh-token auth.

1. The login page sends the user to `/api/auth/google/start` on Razor/cPanel Node hosting.
2. The backend redirects to Google OAuth with `access_type=offline`.
3. Google redirects back to `/api/auth/google/callback` with an authorization code.
4. The backend exchanges the code for tokens and stores the refresh token in an encrypted HttpOnly cookie.
5. The frontend restores the session through `/api/auth/session`.
6. Drive operations request a short-lived access token from `/api/auth/token`.
7. If refresh fails, MyBook keeps local files available and asks the user to reconnect Google Drive.

## Token Model

Google Drive access tokens are short-lived. MyBook should not treat token expiry as full logout.

The browser-mode model is:

- `email` present means the user has a remembered MyBook session.
- `isAuthenticated` can stay `true` even when the Drive token has expired.
- `accessToken` and `accessTokenExpiresAt` represent only the current Drive API token.
- `getAccessToken()` silently requests a fresh Drive token with `prompt: ''` when the stored token is missing or expired.

The backend-mode model is:

- `email` present means the user has a remembered MyBook session.
- The refresh token is not exposed to frontend JavaScript.
- `getAccessToken()` asks the backend for a fresh Drive access token when the stored access token is missing or expired.
- If the backend cookie is missing or Google rejects the refresh token, Drive sync pauses until the user reconnects.

## Silent Renewal

`prompt: ''` is sent to Google Identity Services. It means "try to return a new access token without showing UI."

Silent renewal can succeed when:

- The user is still signed in to Google in the browser.
- The user already granted MyBook Drive permission.
- Browser privacy settings allow the Google session to be used.

Silent renewal can fail when:

- The user signed out of Google.
- The user revoked permission.
- The browser cleared cookies/storage.
- The Google session requires interaction.

When silent renewal fails, MyBook keeps local files available and asks the user to reconnect Drive.

## Explicit Logout

Logout clears the remembered user, clears the access token, revokes the current token when possible, and disables Google auto-select.
