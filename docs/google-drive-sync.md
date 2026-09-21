# Google Drive synchronization

## Scope and module

Google Drive provides remote copies and synchronization for the Google-connected workspace. This is not real-time collaborative editing. Implementation lives in `src/services/googleDrive.ts`, `src/hooks/useDriveBootstrap.ts`, `src/database/repositories.ts`, and the editor save/conflict flows.

The visible root folder is currently `MyBook` (the existing compatibility name), with its ID stored under `google-drive.mybook-folder-id`. Documents upload as `.mybook.md`; spreadsheets use XLSX conversion. App folders mirror into Drive folders. Authentication uses the narrow `drive.file` permission; see [authentication](./auth-and-drive-tokens.md).

## Connection and bootstrap

Local users can connect Google from the sidebar or Settings. In Drive mode, authenticated bootstrap finds/creates the root folder, processes pending folder work, imports remote folders/files, backfills folders, and queues existing local items for backup. Bootstrap and browser `online` handling both invoke remote import.

`queueLocalItemsForDriveBackup` changes active local file/folder records to `workspaceType: drive` and queues creates. Local database content is retained, but repository disk persistence is gated on local mode. Continuing to update the previously selected device folder after cloud connection is therefore unfinished.

## Upload queue

File/folder operations include create, update, delete, restore and permanent-delete. Queue records track pending, processing, failed and completed states, retry count and error message. Files track `driveFileId`, `syncStatus`, `syncError` and `lastSyncedAt`. Offline intent remains queued for later processing. Settings exposes errors and retry/reconnect controls.

## Remote import and conflicts

Remote import walks the existing `MyBook` Drive tree and matches files using Drive ID or name/parent. New Markdown documents can recover portable document IDs when available and unused. Newer remote contents can update local records when no unresolved local operation blocks replacement; a version snapshot is stored before replacing changed content.

Unresolved local intent protects pending work from ordinary remote replacement. Remote disappearance can mark corresponding local records deleted when no unresolved operation exists. Editors also expose conflict-resolution paths for choosing local/remote content or downloading copies. Version records exist in the database/repository; this does not imply a complete user-facing history browser.

These are changes from the earlier explicit-import-only design: Drive content can now be imported automatically on bootstrap/reconnection.

## Save status

The status model distinguishes editing, local saving, saved locally, pending, backing up, backed up, failed and offline. A successful IndexedDB save is not proof of cloud upload. Verify the document and spreadsheet UI against the exact header/More-menu behavior in the [sync requirements](./new-syncing-implementation.md).

## Remaining work and acceptance checks

- Complete combined device-folder and Drive saving without losing the chosen folder or creating duplicate records.
- Reconcile the proposed Writin root with the existing `MyBook` folder before changing names.
- Verify fresh-browser recovery, offline edits, simultaneous devices, local/remote deletion, token expiry and reconnect.
- Verify attachments and advanced document blocks survive upload/download, and cloud-success labels wait for the required content.
- Exercise error paths and interrupted uploads against a real account; passing mocked service tests is not live cloud validation.

Tests: `src/services/googleDrive.test.ts`, `src/database/repositories.test.ts`, `src/services/retry.test.ts`, `src/utils/conflict.test.ts`, and editor status tests. `npm run verify:drive-trash` is a separate Drive trash verification script and should be reviewed/configured before use.
