# Advanced editor blocks and Writin Markdown

## Representation

Tiptap JSON is the in-app document representation. The portable representation is Markdown with Writin metadata and extensions. Local disk files and direct downloads use `.md`; Drive document backups use `.mybook.md`. Both extensions are accepted on import. Implementation: `src/utils/mybookMarkdown.ts` and the extensions/node views in `src/components/document-editor/`.

## Block modules

| Block | Behavior and implementation |
| --- | --- |
| Callout | Styled container with content; `extensions/Callout.ts` |
| Toggle | Editable summary and collapsible content; `extensions/ToggleBlock.ts` |
| Table | Resizable cells and contextual row/column/header/merge/split controls; table extensions and `TableActionsMenu.tsx` |
| Checklist | Nested task items and checked/unchecked, indent/outdent and convert actions; `ChecklistActionsMenu.tsx` |
| Image | File/URL picker, resize/alignment controls and fullscreen viewer; `ImageBlockPicker.tsx`, `ImageBlockNodeView.tsx` |
| Video/audio | Local media or supported URL/provider rendering, captions and editing controls; corresponding picker/node-view modules |
| File attachment | File/URL attachment node and preview/download controls; `FileBlockPicker.tsx`, `FileBlockNodeView.tsx` |
| Bookmark / website mention | Rich preview or compact website mention; [bookmark specification](./bookmark-previews.md) |
| Embed | Supported URL embedding through `EmbedBlockNodeView.tsx`; remote provider restrictions still apply |
| Document link | Reference to a local document ID, with link remapping during backup restore; `documentLinkModel.ts`, `DocumentLinkNodeView.tsx` |
| Table of contents | Heading-based document navigation; `TableOfContentsNodeView.tsx` |
| Database-style block | Document-contained rows and typed columns, sort/filter state; `databaseModel.ts`, `DatabaseBlockNodeView.tsx` |

Database columns support text, number, select, status, date and checkbox. The model carries version, IDs, title, columns, rows and optional view state. It is an embedded document block, not a separate multi-user database service.

Contextual block controls support applicable move, duplicate and delete actions. Slash commands and insert menus expose block insertion; the exact options depend on selection and device layout.

## Media limits and persistence

Current picker limits are 5 MB per image and 50 MB per audio, video or generic attachment file. Selected media can be stored as data URLs in editor content. Local-folder saving and ZIP export extract embedded media into companion directories; see [local vaults](./local-vaults.md) and [backup/export](./backup-and-export.md). Remote URLs are not guaranteed to work offline.

## Markdown format

The existing `mybook_version` frontmatter key and `.mybook.md` backup extension are compatibility identifiers. Keep them unchanged when using the current parser/serializer.

The serializer favors standard Markdown for ordinary text, headings, lists, quotes, links and images. Frontmatter carries Writin version/type/title and, when supplied, document identity. Advanced blocks use additional syntax/data handled by the paired parser. Other Markdown editors may preserve the text without rendering the same blocks.

```md
---
mybook_version: 1
type: document
title: "Project Notes"
---

# Project Notes

:::callout type="info" title="Remember"
A readable callout.
:::

:::toggle title="More details"
Additional content.
:::
```

Use the serializer/parser as the exact format reference for each block. Changing `.mybook.md` to `.md` does not remove custom syntax. DOCX cannot be assumed to preserve every custom node identically.

## Verification and remaining work

Tests cover Markdown conversion, block node views, media pickers, table controls, document links, database models and clipboard behaviors. Every new block should preserve content and attributes across export/import and local save/reopen, including empty values and unsupported-source data.

Verify companion-media paths across rename/move and JSON backup remapping, cross-browser audio/video rendering, keyboard navigation, and database/table content through portable formats. References/citations, user mentions and AI-summary blocks remain future functionality; document links, bookmark mentions and database-style blocks are already present.
