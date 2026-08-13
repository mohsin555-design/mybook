# Google Drive Sync

## Purpose

Google Drive stores visible backup copies of MyBook files and mirrors folder structure under a Drive folder named `MyBook`.

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

Documents are backed up as `.docx` files.

Spreadsheets are backed up as `.xlsx` files.

Each local file stores:

- `driveFileId`
- `syncStatus`
- `syncError`
- `lastSyncedAt`

## Drive Imports

MyBook periodically imports Drive folders and files into local IndexedDB after sign-in. It matches records by Drive ID first, then by name and parent folder.

## Conflict Handling

Editors check Drive file status. If the Drive file changed after `lastSyncedAt`, MyBook shows a conflict screen with options:

- Keep MyBook version.
- Use Drive version.
- Download both.
