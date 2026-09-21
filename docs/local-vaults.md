# Local vaults and device storage

## Purpose and entry points

Local vaults let users work without a Google account. `LoginPage` offers **Select a Local Vault Folder** when `showDirectoryPicker` exists, otherwise **Create a Private Device Vault**. Private vault names are editable; selected folders use the folder's actual name. The sidebar displays the saved vault name.

Implementation: `src/services/localWorkspace.ts`, `src/stores/useWorkspaceStore.ts`, `src/pages/LoginPage.tsx`, `src/app/AuthGuards.tsx`, and `src/database/repositories.ts`.

## Storage model

- IndexedDB `mybook-db` stores file/folder records, editor content, settings, sync queue entries and version snapshots.
- Selected device-folder handles and vault details are stored in the settings table.
- Private storage uses OPFS when available, otherwise IndexedDB. Browser capability checks determine the options; Apple-device detection only adjusts explanatory copy.
- Initialization requests persistent storage. This can reduce automatic eviction; clearing website data still removes browser-held data. Private storage is not application-level encryption or cross-device sync.
- Workspace mode is persisted as `local` or `drive` under `mybook-workspace`. Local mode bypasses Google authentication guards.

## Local files and attachments

The selected folder itself is the root for new writes. Folder paths are resolved from database parent relationships. Documents are written as `<name>.md` with MyBook metadata and advanced-block syntax. Embedded image, audio, video and attachment data can be extracted into `<name>_attachments/`; Markdown uses relative media paths. Loading hydrates recognized companion attachments back into editor data URLs.

Names are sanitized for filesystem use. New empty workspaces do not need an app-created `Writin/files` directory. Spreadsheet disk handling has a [format limitation](./spreadsheet-editor.md#local-folder-and-zip-limitation).

## Discovery and recovery

`scanAndHydrateLocalWorkspace` runs during initialization and recursively creates missing records for recognized files/folders. It skips attachment directories, `.git`, `node_modules`, hidden files and the legacy root directory during normal traversal. It first checks for the older nested `Writin/files` layout.

Markdown records are matched by portable document ID, then local name and parent. Existing nonempty content is not replaced by the scanner. Legacy `.content.json` fills an existing record with missing content; it does not by itself rebuild a missing record. Discovery is not a filesystem watcher or a complete migration guarantee.

When a stored device handle lacks permission, root resolution can fall back to OPFS. The distinction between chosen-folder saving and private fallback must remain visible enough to avoid misleading users.

## Saving and remaining work

Repository writes persist to disk only while local workspace mode is active. Connecting Drive changes records to Drive mode, so continued writing into the previous device folder is not complete; see [Drive sync](./google-drive-sync.md).

Disk-write errors are currently caught and logged. Remaining work includes actionable save errors, collision handling after filename sanitization, safe interrupted writes, external-edit detection, and recovery tests with an empty database. Verify attachment moves/renames, legacy and new layout coexistence, repeated scans, and document identity before declaring migration complete.

Tests: `src/services/localWorkspace.test.ts`, `src/database/repositories.test.ts`, `src/pages/LoginPage.test.tsx`, and `src/app/AuthGuards.test.tsx`. These tests do not replace real browser permission and recovery checks.
