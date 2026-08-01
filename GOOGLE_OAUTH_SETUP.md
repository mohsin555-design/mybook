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

For the Google Identity Services token flow used by MyBook, you normally do not need a redirect URI for the popup/token callback flow.

If you later switch to a code flow or a backend exchange, add the redirect URI used by that backend.

## 5. Drive API enablement

1. Go to **APIs & Services > Library**.
2. Search for **Google Drive API**.
3. Click **Enable**.

## 6. Environment variables

Add these values to your local `.env` file:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

## 7. Notes

- MyBook only requests `drive.file`, not full Drive access.
- Any Google account permitted by the OAuth consent-screen publishing status can sign in.
- OAuth client secrets must stay out of frontend code.
- The app stores the auth session in browser session storage and clears it on logout or token expiry.
