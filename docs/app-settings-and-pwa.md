# App settings, navigation and PWA

## Navigation and settings

`src/components/layout/AppLayout.tsx` provides the responsive sidebar and vault/account controls. Routes include Home, Favorites, Folders, Search, Trash, document/spreadsheet editors, Settings and the design-system page. Mobile navigation and editor controls adapt to available space.

`src/pages/SettingsPage.tsx` exposes light/dark theme, Drive connection/status/retry controls, local storage protection, JSON backup import/export, full-vault ZIP export and diagnostics/version information. Theme state is managed by `useAppStore.ts`, which applies the document theme and dark class; the store currently has no persistence middleware.

`src/config/app.ts` reads `VITE_APP_VERSION` with fallback `0.1.0`. Backup/storage behavior is specified in [backup/export](./backup-and-export.md) and [local vaults](./local-vaults.md).

## Offline and installation

`vite.config.ts` configures the PWA manifest (currently named `MyBook` in code) and prompt-based service-worker updates. Static assets are precached; navigation falls back to the app shell except under `/api/`. Google Drive and Google account requests are network-only. Offline cached app access does not supply remote media or authenticated cloud requests.

`PwaStatus.tsx` displays offline/update notices, uses the browser install prompt where available, and supplies Safari Add to Home Screen guidance. Its automatic install-help flow is currently gated on authenticated email. Update checks run on registration, visibility/focus/page-show events and periodically.

## Naming

**Writin** is the documentation product name. Existing runtime names remain `MyBook` in the browser title, login screen, PWA manifest and Drive root; npm uses `mybook`. JSON-backup filenames/share text and legacy directory handling already use Writin. These technical and runtime names are documented as they exist. Renaming them requires a separate code/configuration change with compatibility for saved data and Drive folders; no such change is part of this documentation update.

## Verification and remaining work

Test offline startup after a successful online load, update prompts, installation and mobile keyboards on actual target browsers. Verify local-only installation guidance and the consistency of save/sync messages across Settings and editors. Theme persistence would require an explicit implementation if desired.

Relevant tests include layout/header accessibility and Settings tests. Storybook (`npm run storybook`) and `/design-system` provide component inspection. Production validation requires `npm run build:production`; modern frontend test dependencies require Node 22.13+ in the 22.x line or Node 24+, even though the standalone auth server declares a lower minimum.
