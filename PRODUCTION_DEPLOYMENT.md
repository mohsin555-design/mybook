# MyBook production deployment

MyBook is a client-only Vite application. No backend is required: editable content is stored in IndexedDB and optional backups use the user's Google Drive file-level permission.

## Environment

Copy `.env.production.example` into the deployment provider's environment settings. Never commit `.env`, `.env.production`, OAuth tokens, or client secrets. The Google OAuth client ID is intentionally public frontend configuration; do not add a client secret.

Required variables:

- `VITE_GOOGLE_CLIENT_ID`: production Web OAuth client ID
- `VITE_APP_VERSION`: displayed in Settings
- `VITE_PRODUCTION_ORIGIN`: the exact HTTPS production origin

## Vercel

Import the repository into Vercel. `vercel.json` configures the Vite build and SPA fallback. Use `npm run build:production` as the build command and `dist` as the output directory. Add the variables above in Project Settings, then redeploy.

Cloudflare Pages can use the same build command and output directory; add the same variables under Settings > Environment variables.

## Google Cloud Console

1. Create a separate production OAuth Web client.
2. Enable Google Drive API.
3. Configure the OAuth consent screen, add validation accounts as test users while the app is in testing, and publish it to production when it is ready for all Google accounts.
4. Add the exact production origin, including scheme and port when applicable, under Authorized JavaScript origins, for example `https://mybook.example.com`.
5. Do not add a client secret to frontend variables.
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
