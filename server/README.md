# MyBook Node Auth Server

Use this folder as the Razor/cPanel Node.js application root.

Recommended cPanel fields:

- Node.js version: `18.x` or newer
- Application mode: `Production`
- Application root: `/home/celztxeo/mybook-live/server`
- Application URL: `mohsinali.in/api`
- Application startup file: `server.js`

Environment variables:

```bash
NODE_ENV=production
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
AUTH_COOKIE_SECRET=replace-with-at-least-32-random-characters
APP_ORIGIN=https://mohsinali.in
GOOGLE_REDIRECT_URI=https://mohsinali.in/api/auth/google/callback
```

Frontend build variables:

```bash
VITE_GOOGLE_AUTH_MODE=server
VITE_AUTH_API_BASE=/api/auth
VITE_AUTH_API_EXTENSION=
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```
