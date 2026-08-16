# Google OAuth Setup

Use these settings to connect MyBook to Google Identity Services and Drive with the narrow `drive.file` scope.

## 1. Google Cloud project

1. Create or select a Google Cloud project.
2. Enable the **Google Drive API** for that project.
3. Create an **OAuth 2.0 Client ID** for a **Web application**.

## 2. OAuth consent screen

1. Open **APIs & Services > OAuth consent screen**.
2. Set the application name, support email, and branding.
3. Add the scope:
   - `https://www.googleapis.com/auth/drive.file`
4. Keep the app in **Testing** while you validate it.
5. Add each account used during validation as a **test user**.
6. Publish the app to **Production** when it is ready for all Google accounts.

## 3. Authorized origins

Add every origin where MyBook runs, for example:

- `http://localhost:5173`
- your production app origin

Use the exact scheme, host, and port.

## 4. Authorized redirect URIs

For the browser token flow, you normally do not need a redirect URI for the popup/token callback flow.

For backend refresh-token auth, add the redirect URI used by the backend:

- Local: `http://localhost:5173/api/auth/google/callback`
- Razor/cPanel Node production: `https://your-production-domain.example/api/auth/google/callback`

## 5. Drive API enablement

1. Go to **APIs & Services > Library**.
2. Search for **Google Drive API**.
3. Click **Enable**.

## 6. Environment variables

Add these values to your local `.env` file:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_AUTH_MODE=browser
```

To use backend refresh-token auth instead:

```bash
VITE_GOOGLE_AUTH_MODE=server
VITE_AUTH_API_BASE=/api/auth
VITE_AUTH_API_EXTENSION=
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
AUTH_COOKIE_SECRET=replace-with-at-least-32-random-characters
APP_ORIGIN=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
```

On Razor/cPanel Node.js hosting, create a Node app that uses `server/` as the application root and set the backend variables in the Node app environment section.

## 7. Notes

- MyBook requests `drive.file` access so it can create and manage MyBook backups in Drive without broad access to the user's whole Drive.
- Any Google account permitted by the OAuth consent-screen publishing status can sign in.
- OAuth client secrets must stay out of frontend code.
- Browser mode stores the auth session in browser storage and clears it on logout.
- Backend mode stores the Google refresh token in an encrypted HttpOnly cookie and uses the Node backend in `server/` to mint short-lived Drive access tokens.
