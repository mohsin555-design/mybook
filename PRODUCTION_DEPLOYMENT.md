# MyBook production deployment

MyBook can run as a client-only Vite application or with Node.js backend auth on Razor/cPanel hosting. Editable content is stored in IndexedDB and optional backups use the user's Google Drive file-level permission.

## Environment

Copy `.env.production.example` into the deployment provider's environment settings. Never commit `.env`, `.env.production`, OAuth tokens, or client secrets. The Google OAuth client ID is intentionally public frontend configuration; do not add a client secret.

Required variables:

- `VITE_GOOGLE_CLIENT_ID`: production Web OAuth client ID
- `VITE_GOOGLE_AUTH_MODE`: use `browser` for frontend-only auth or `server` for backend refresh-token auth
- `VITE_APP_VERSION`: displayed in Settings
- `VITE_PRODUCTION_ORIGIN`: the exact HTTPS production origin

Required only when `VITE_GOOGLE_AUTH_MODE=server`:

- `GOOGLE_CLIENT_ID`: production Web OAuth client ID
- `GOOGLE_CLIENT_SECRET`: production Web OAuth client secret
- `AUTH_COOKIE_SECRET`: at least 32 random characters used to encrypt HttpOnly auth cookies
- `APP_ORIGIN`: the exact HTTPS production origin
- `GOOGLE_REDIRECT_URI`: `https://your-production-domain.example/api/auth/google/callback`

## Razor/cPanel Static App

The `.cpanel.yml` deployment copies `dist/.` to `/home/celztxeo/mybook`. This remains the static frontend folder.

## Razor/cPanel Node Auth App

Create a separate Node.js app in Razor/cPanel:

1. Node.js version: `18.x` or newer.
2. Application mode: `Production`.
3. Application root: `/home/celztxeo/mybook-live/server`.
4. Application URL: `mohsinali.in/api`.
5. Application startup file: `server.js`.
6. Add the backend environment variables above.
7. Run the Node app's install/start controls in cPanel.

## Static-only hosting

If Razor is serving only static files and Node.js is disabled, use `VITE_GOOGLE_AUTH_MODE=browser`. Backend refresh-token auth requires the Node app.

## Google Cloud Console

1. Create a separate production OAuth Web client.
2. Enable Google Drive API.
3. Configure the OAuth consent screen, add validation accounts as test users while the app is in testing, and publish it to production when it is ready for all Google accounts.
4. Add the exact production origin, including scheme and port when applicable, under Authorized JavaScript origins, for example `https://mybook.example.com`.
5. Do not add a client secret to frontend variables. Put it only in the Razor/cPanel Node app environment variables.
6. Verify the OAuth consent screen requests only `https://www.googleapis.com/auth/drive.file` plus sign-in identity scopes.

## Domain and verification

Use the same exact HTTPS origin in `VITE_PRODUCTION_ORIGIN`, the OAuth JavaScript origins list, and the browser address bar. After deployment, verify that Google login completes, the visible MyBook folder is reused, and DOCX/XLSX files open from Drive.

## Release checklist

- Run `npm run build:production`.
- Install the PWA from Chrome and Safari Add to Home Screen.
- Test offline local editing, then reconnect and retry Drive sync.
- Test desktop Chrome and Edge, Android Chrome, and iPhone Safari.
- Confirm Settings shows version and diagnostics.
- Confirm Drive files remain visible and openable.
- Do not enable error monitoring that captures document content or access tokens. MyBook currently uses development-only sanitized console diagnostics instead.
