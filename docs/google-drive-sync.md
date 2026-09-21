# Google Drive synchronization

## Scope and module

Google Drive provides remote copies and synchronization for the Google-connected workspace. This is not real-time collaborative editing. Implementation lives in `src/services/googleDrive.ts`, `src/hooks/useDriveBootstrap.ts`, `src/database/repositories.ts`, and the editor save/conflict flows.

The visible root folder is **Writin**, with its ID stored under `google-drive.mybook-folder-id`. Documents upload as `.md`; spreadsheets use XLSX conversion. App folders mirror into Drive folders. Authentication uses the narrow `drive.file` permission; see [authentication](./auth-and-drive-tokens.md).

## Folder-name migration

`ensureMyBookDriveFolder` keeps its internal export name but now prepares **Writin**:

1. With a saved folder ID, fetch and validate that exact folder. Missing permission, a missing/trashed folder or an invalid response stops setup; it does not trigger discovery or creation of a replacement.
2. Without a saved ID, search for Writin and legacy MyBook names, including historical capitalization, across all result pages. This also finds folders moved away from Drive root. Failed/incomplete searches stop setup. Multiple candidates require resolving the existing connection; the app does not choose, copy or merge automatically.
3. Reuse the unique existing folder and persist its ID before renaming. A name-only PATCH changes it to Writin; children, parents, file IDs and content are untouched. Already-renamed folders need no PATCH.
4. Only successful discovery with no matching folders creates a new Writin folder.

Rename failure retains the ID and data and exposes a retryable setup error. Cloud setup pauses rather than creating a replacement; local-only use is independent. Bootstrap always invokes this migration, including when an ID is already cached, and retries on reconnection. Calls within a tab share setup; Web Locks serialize same-origin tabs where supported. Separate devices do not share that lock, so simultaneous first-time creation across devices still needs live acceptance testing.

Keep `google-drive.mybook-folder-id`, database/auth keys, cookie names, and Drive app-property keys unchanged. Drive supports existing `.mybook.md` legacy backups on import while new backups upload as `.md`. Do not create a new OAuth project/client or change the deployed origin as part of branding; existing `drive.file` access and local browser storage must remain available.

## Connection and bootstrap

Local users can connect Google from the sidebar or Settings. In Drive mode, authenticated bootstrap finds/creates the root folder, processes pending folder work, imports remote folders/files, backfills folders, and queues existing local items for backup. Bootstrap and browser `online` handling both invoke remote import.

`queueLocalItemsForDriveBackup` changes active local file/folder records to `workspaceType: drive` and queues creates. Local database content is retained, but repository disk persistence is gated on local mode. Continuing to update the previously selected device folder after cloud connection is therefore unfinished.

## Upload queue

File/folder operations include create, update, delete, restore and permanent-delete. Queue records track pending, processing, failed and completed states, retry count and error message. Files track `driveFileId`, `syncStatus`, `syncError` and `lastSyncedAt`. Offline intent remains queued for later processing. Settings exposes errors and retry/reconnect controls.

## Remote import and conflicts

Remote import walks the connected Writin Drive tree and matches files using Drive ID or name/parent. New Markdown documents can recover portable document IDs when available and unused. Newer remote contents can update local records when no unresolved local operation blocks replacement; a version snapshot is stored before replacing changed content.

Unresolved local intent protects pending work from ordinary remote replacement. Remote disappearance can mark corresponding local records deleted when no unresolved operation exists. Editors also expose conflict-resolution paths for choosing local/remote content or downloading copies. Version records exist in the database/repository; this does not imply a complete user-facing history browser.

These are changes from the earlier explicit-import-only design: Drive content can now be imported automatically on bootstrap/reconnection.

## Save status

The status model distinguishes editing, local saving, saved locally, pending, backing up, backed up, failed and offline. A successful IndexedDB save is not proof of cloud upload. Verify the document and spreadsheet UI against the exact header/More-menu behavior in the [sync requirements](./new-syncing-implementation.md).

## Remaining work and acceptance checks

- Complete combined device-folder and Drive saving without losing the chosen folder or creating duplicate records.
- Verify migration with an existing populated MyBook folder and with a fresh browser. Older app versions that only search MyBook by name should be updated before reconnecting without a saved folder ID.
- Verify fresh-browser recovery, offline edits, simultaneous devices, local/remote deletion, token expiry and reconnect.
- Verify attachments and advanced document blocks survive upload/download, and cloud-success labels wait for the required content.
- Exercise error paths and interrupted uploads against a real account; passing mocked service tests is not live cloud validation.

Tests: `src/services/driveRootMigration.test.ts`, `src/hooks/useDriveBootstrap.test.tsx`, `src/services/googleDrive.test.ts`, `src/database/repositories.test.ts`, `src/services/retry.test.ts`, `src/utils/conflict.test.ts`, and editor status tests. `npm run verify:drive-trash` is a separate Drive trash verification script and should be reviewed/configured before use.
