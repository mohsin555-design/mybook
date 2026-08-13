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

The editor can import `.docx`, `.md`, and `.mybook.md` files. DOCX imports use Mammoth and some complex formatting may be simplified.

The editor can export/download `.docx` files and `.mybook.md` files.

## Drive Backup

Document backups are uploaded to Google Drive as `.mybook.md`. Backup can run automatically after local save or manually through editor actions.

## Drive Edits

Drive backups are not treated as live collaborative copies. If a user edits a Drive backup directly, they can import that file explicitly to replace the MyBook content.
