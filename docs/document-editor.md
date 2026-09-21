# Document editor

## Purpose and implementation

Documents open at `/document/:documentId`. `src/components/document-editor/TiptapDocumentEditor.tsx` configures Tiptap and coordinates toolbars, block controls, imports, local saving and Drive actions. Document content is serialized Tiptap JSON in IndexedDB; recovery drafts also use localStorage. `src/hooks/useAutosave.ts` debounces content saves by 500 ms and attempts to flush on page hide/visibility changes.

## Formatting and editing

- Bold, italic, underline, strikethrough and inline code.
- Semantic headings H1–H4, paragraphs, bulleted/numbered lists and nested checklists.
- Quotes, code blocks, links, horizontal rules and clear formatting.
- Tables with row/column controls, headers, merge/split and resizing.
- Undo/redo, paste cleanup, slash-command insertion and contextual block actions.

Desktop uses command menus and a top formatting toolbar, centered-page/full-width views and zoom. Mobile uses a bottom toolbar and contextual sheets, with visual-viewport/safe-area handling. Desktop page view is a continuous writing column, not a guaranteed print-pagination system.

## Advanced content

The editor registers callouts, toggles, image/video/audio blocks, file attachments, bookmarks, website mentions, embeds, document links, table of contents and database-style blocks. Their models, format rules and limits are documented in [advanced editor and Markdown](./advanced-editor-and-format-spec.md). Website mentions are not user mentions.

## Import/export and sync

The editor imports `.docx`, `.md` and legacy `.mybook.md`; downloads `.docx` or `.md`. DOCX uses Mammoth for import and can simplify unsupported content. Markdown downloads preserve Writin metadata and custom blocks. Drive document backups also use `.md`.

Local saves and cloud upload are different stages. Connected workspaces can import remote changes during bootstrap/reconnect, with conflict/version handling in the Drive services. See [Drive sync](./google-drive-sync.md), [local vaults](./local-vaults.md) and [backup/export](./backup-and-export.md).

## Accessibility and verification

Controls should have accessible names, visible focus and selected states. Slash commands support keyboard selection; heading commands create real headings. Mobile controls must keep the caret reachable when the keyboard opens.

Relevant tests are alongside editor components, extensions and Markdown/DOCX utilities. Remaining acceptance checks include real mobile keyboards, desktop zoom, clean paste, all block round trips with media, error/recovery behavior and cloud status placement. AI summaries, user mentions and a citations workflow are not implemented editor features.
