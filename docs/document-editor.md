# Document Editor

## Purpose

The document editor provides rich text editing for MyBook documents.

## Storage

Documents are stored locally as Tiptap JSON in IndexedDB. Autosave writes edits locally and keeps recovery drafts in `localStorage`.

## Formatting

Supported editor actions include:

- bold
- italic
- underline
- headings 1-3
- bulleted lists
- numbered lists
- checklists
- undo and redo
- blockquote
- links
- tables
- horizontal rule
- strikethrough
- clear formatting

## Import and Export

The editor can import `.docx` files using Mammoth. Some complex formatting may be simplified.

The editor can export/download `.docx` files.

## Drive Backup

Document backups are uploaded to Google Drive as `.docx`. Backup can run automatically after local save or manually through editor actions.

## Drive Conflict

If the Drive copy is newer than the last backup, the editor stops replacement and asks the user to choose which version to keep.
