# Google Drive Sync

## Purpose

Google Drive stores visible backup copies of MyBook files and mirrors the app-created folder structure under a Drive folder named `MyBook`.

MyBook is the source of truth. Drive is used for backup, storage, and explicit import/export, not as a live second editor.

## Drive Folder

On startup after sign-in, MyBook finds or creates a visible Google Drive folder named `MyBook`. The Drive folder ID is saved in local settings using `google-drive.mybook-folder-id`.

## Folder Sync

Local folders are mirrored into Drive folders. Folder operations can be queued when Drive is unavailable:

- create
- update
- delete
- restore

Queued work is retried when the browser comes online or when the user clicks retry in Settings.

## File Backup

Documents are backed up as `.mybook.md` files. This keeps backups text-based and portable while preserving MyBook metadata in Markdown frontmatter.

Spreadsheets are backed up as `.xlsx` files.

Each local file stores:

- `driveFileId`
- `syncStatus`
- `syncError`
- `lastSyncedAt`

## Drive Imports

MyBook does not automatically import arbitrary Drive files into IndexedDB. Users import documents or spreadsheets explicitly from editor actions.

## External Drive Edits

If a user edits a backup directly in Drive, MyBook does not silently replace local content. The user should import that file explicitly if they want the Drive version to become the MyBook version.
