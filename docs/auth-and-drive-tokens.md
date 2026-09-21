# Authentication and Drive tokens

## Modes and access rules

`src/stores/useAuthStore.ts` implements Google authentication. `src/stores/useWorkspaceStore.ts` separately records local/Drive mode. `src/app/AuthGuards.tsx` permits app access when authenticated **or** in local mode, so local vaults need no account.

`VITE_GOOGLE_AUTH_MODE=browser` uses Google Identity Services in the frontend. `server` uses the backend refresh-token endpoints. Setup values and Google origins are documented in [Google OAuth setup](../GOOGLE_OAUTH_SETUP.md).

## Browser authentication

Google Sign-In supplies an ID credential; the frontend decodes its payload and requests a short-lived Drive token with `drive.file`. The token flow obtains account identity for the session. Do not describe client-side JWT decoding as server-side cryptographic verification.

Current browser-mode persistence uses `localStorage` under `mybook-auth` and includes email, display name, access token and expiry. This is not session-storage-only authentication. Tokens must never be placed in URLs, logs or exported documents.

## Backend authentication

The frontend navigates to the auth start endpoint; the server completes the code exchange and stores the refresh token in an encrypted HttpOnly cookie. Session and token endpoints restore identity and issue short-lived access tokens. Backend-mode persisted frontend state omits access tokens.

API configuration uses `VITE_AUTH_API_BASE` and `VITE_AUTH_API_EXTENSION`. The code has a legacy `.php` extension default; the Node/Vercel examples explicitly set the extension to an empty value. Vite alone does not provide the auth backend.

Required server-only variables include `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_COOKIE_SECRET`, `APP_ORIGIN` and `GOOGLE_REDIRECT_URI`. Never prefix server secrets with `VITE_`. Implementations are in `api/auth/` and `server/server.js`.

## Expiry and reconnect

A token is considered fresh only when more than 60 seconds remain. `getAccessToken()` reuses a fresh token or shares an in-flight refresh request. Browser renewal requests an empty prompt; backend renewal calls the token endpoint.

The expiry timer clears token fields. During persisted-state rehydration an expired/missing token also clears authentication. Backend refresh failure and some reconnect failures can clear `isAuthenticated`. Consequently, remembered email alone does not guarantee access to Drive-mode routes after reload/failure; account-free local mode still passes the guard.

Renewal can fail when permission is revoked, Google requires interaction, cookies are unavailable or backend session state is lost. Surface reconnect errors without claiming cloud operations succeeded. Preserving local access through every Drive-mode failure remains an acceptance requirement, not a guarantee established by the present guard logic.

## Logout and verification

Logout clears identity/token state, clears the expiry timer, attempts backend logout or browser token revocation, and disables Google auto-select. It does not itself delete the IndexedDB document database.

Tests: `src/stores/useAuthStore.test.ts`, `src/app/AuthGuards.test.tsx`, and `src/pages/LoginPage.test.tsx`. Verify browser and server login, expired-token reload, denied consent, reconnect and account switching with live credentials separately.
