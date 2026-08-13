# MyBook Feature Specs

This folder documents how MyBook works at the product and implementation level.

## Specs

- [Authentication and Drive tokens](./auth-and-drive-tokens.md)
- [Google Drive sync](./google-drive-sync.md)
- [Files and folders](./files-and-folders.md)
- [Document editor](./document-editor.md)
- [Spreadsheet editor](./spreadsheet-editor.md)

## Product Summary

MyBook is a local-first browser workspace for personal documents and spreadsheets. Editable content is stored in IndexedDB so the app remains usable offline. Google Drive is used for visible file backups and folder mirroring after the user signs in with Google.

The app should treat local access and Drive access separately:

- Local workspace access depends on the remembered signed-in user.
- Drive actions depend on a short-lived Google access token.
- Expired Drive tokens should be renewed silently when possible.
- If silent renewal fails, local files should remain available and Drive actions should ask for reconnect.
