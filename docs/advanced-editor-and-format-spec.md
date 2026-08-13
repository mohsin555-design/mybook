# Advanced Editor and MyBook Markdown Spec

## Purpose

MyBook should provide a polished document editor with advanced blocks, strong accessibility, and responsive controls across desktop and mobile.

This work will happen on the `mybook-markdown-format` branch one task at a time. Each task should keep the app stable, pass tests/build, and update this spec when behavior changes.

## Product Direction

MyBook is the primary editor and source of truth. Google Drive is used for backup, import, and export.

Users should not expect Google Docs-style live two-way editing between Drive and MyBook. A file edited directly in Drive can be imported explicitly, but MyBook should not silently overwrite local content from Drive.

## Editor Layout

### Desktop

Desktop keeps a Quip-style toolbar at the top of the document.

Expected behavior:

- Primary document actions stay in the top bar.
- Formatting controls stay near the top and remain easy to scan.
- The editor area uses the full available width under the header.
- Editor routes opt out of the app's centered max-width shell so the document editor header and canvas can span the full viewport.
- The default writing canvas is a wide centered page column on a grey workspace, similar to Google Docs.
- Page mode uses a continuous paper column and should not expose a hard page-end boundary while editing.
- Users can switch desktop view between centered page width and full-width editing.
- Full-width editing uses a clean white workspace without the paper-page shadow.
- Users can adjust desktop document zoom.
- Active formatting states are visible.
- Buttons have accessible labels and keyboard focus styles.
- Toolbar controls should not cover document content.

### Mobile

Mobile uses a bottom editing toolbar.

Expected behavior:

- The toolbar appears near the bottom while editing.
- When the keyboard is open, the toolbar sticks above the keyboard.
- The document area is always full width on mobile.
- Mobile does not expose page-width or zoom controls.
- Touch targets should be comfortable for mobile use.
- Controls can be grouped or horizontally scrollable when space is limited.
- Slash commands and block menus should open as touch-friendly sheets or popovers above the keyboard.
- Typing should not cause layout jumps or hide the caret.

## Accessibility Requirements

Every editor task should preserve or improve accessibility.

Required standards:

- Toolbar buttons must have clear `aria-label` text.
- Menus/popovers must be keyboard reachable.
- Focus states must be visible.
- Icon-only buttons must have tooltips or accessible names.
- Formatting controls must expose selected/pressed state when applicable.
- Heading controls must create real document headings, not styled paragraphs.
- Mobile controls must use reliable hit areas and not require precise pointer movement.

## Work Plan

The editor will be improved in small tasks instead of one large rewrite.

### Step 1: Editor Foundation

Goal: make the current Tiptap editor cleaner, responsive, and accessible before adding bigger blocks.

Scope:

- Review toolbar structure and editor layout.
- Improve focus states and button labels.
- Ensure desktop and mobile layouts do not overlap content.
- Keep existing formatting behavior working.

Status:

- Desktop uses the top toolbar pattern.
- Mobile keeps the bottom toolbar pattern.
- Toolbar buttons expose labels, pressed states, and visible keyboard focus styles.
- Editor content has clearer focus styling and mobile heading sizing.

### Step 2: Desktop Toolbar

Goal: refine the Quip-style top toolbar.

Scope:

- Better grouping for document, insert, and format controls.
- Clear active states for current marks and block type.
- Stable toolbar height and no layout shift.
- Keyboard-friendly menus.

Status:

- Desktop now has a command menu row with Document, Edit, View, Insert, and Format menus.
- Document actions are grouped away from the icon toolbar.
- Insert and Format menus expose common commands without requiring users to remember toolbar icons.
- The desktop icon toolbar remains compact and horizontally scrollable at narrower desktop widths.

### Step 3: Mobile Toolbar

Goal: provide a mobile-first editing toolbar.

Scope:

- Bottom toolbar while editing.
- Sticky positioning above keyboard.
- Touch-friendly groups for text style, insert, lists, undo/redo.
- Responsive behavior for small screens and safe areas.

Status:

- Mobile toolbar uses a bottom-fixed layout separate from the desktop toolbar.
- The toolbar measures `visualViewport` and offsets itself above the on-screen keyboard when supported.
- Primary mobile actions stay in the main toolbar row.
- Secondary format and insert actions are grouped in a touch-friendly bottom sheet.
- Toolbar and bottom sheet respect safe-area spacing.

### Step 4: Core Formatting

Goal: make common writing features solid.

Scope:

- Bold, italic, underline, strikethrough.
- Headings H1-H3.
- Bulleted, numbered, and task lists.
- Blockquote.
- Inline code and code blocks.
- Link create/edit/remove.
- Horizontal rule.
- Clear formatting.
- Clean paste from common sources.

Status:

- Inline code and code block commands are exposed in desktop and mobile controls.
- Desktop Format menu includes inline code and code block actions.
- Mobile bottom sheet includes inline code and code block in the Format group.
- Pasted HTML is cleaned before insertion by removing style/class/id/data noise and unsafe document-level tags.
- Pasted text normalizes non-breaking spaces and line endings.
- Inline code and code blocks have dedicated editor styling.

### Step 5: Slash Command Menu

Goal: let users type `/` to insert blocks quickly.

Scope:

- Slash menu opens near the caret.
- Menu supports keyboard and touch selection.
- Commands include headings, lists, quote, table, callout, image, divider, and code block.
- Search/filter should be fast and predictable.

Status:

- Typing `/` in an empty paragraph opens a slash command menu near the caret.
- The menu filters commands as the user types after `/`.
- Keyboard controls support Arrow Up, Arrow Down, Enter, Tab, and Escape.
- Mouse/touch selection is supported without moving editor focus first.
- Initial commands include text, headings, lists, checklist, quote, code block, table, and divider.

### Step 6: Advanced Blocks

Goal: add Notion-style blocks that still work well in a document editor.

Initial blocks:

- Callout block.
- Toggle block.
- Table block improvements.
- Image block.
- File attachment block.
- Checklist block improvements.
- Block actions: duplicate, delete, move.

Later blocks:

- References/citations.
- Page links and mentions.
- Embed bookmarks.
- AI/summary blocks.
- Database-lite blocks only after the core editor is stable.

Status:

- Callout block is implemented as a real Tiptap node.
- Callout can be inserted from the desktop Insert menu, desktop toolbar, mobile Insert sheet, and slash command menu.
- Callout blocks render with accessible document content and responsive styling.
- `.mybook.md` export preserves callouts with readable fenced container syntax.
- `.mybook.md` import restores callouts into MyBook callout blocks.
- Toggle block is implemented as a real Tiptap node with an editable title and collapsible content.
- Toggle can be inserted from the desktop Insert menu, desktop toolbar, mobile Insert sheet, and slash command menu.
- `.mybook.md` export preserves toggles with readable fenced container syntax.
- `.mybook.md` import restores toggles into MyBook toggle blocks.
- Image block is implemented as a real Tiptap node.
- Images can be inserted from the desktop Insert menu, desktop toolbar, mobile Insert sheet, and slash command menu.
- The first image implementation stores selected image files as local document data URLs with a 5 MB limit.
- `.mybook.md` export preserves images with normal Markdown image syntax.
- `.mybook.md` import restores Markdown image syntax into MyBook image blocks.
- Block actions panel is implemented for callout, toggle, image, table, blockquote, and code block.
- Block actions include move up, move down, duplicate, and delete.
- Block actions appear when the user selects or edits inside an actionable block.
- Desktop block actions appear as a compact side toolbar.
- Mobile block actions appear from a floating trigger and open in a keyboard-aware bottom sheet.
- Table actions are implemented as contextual controls when the selection is inside a table.
- Table actions include add row above/below, add column left/right, delete row, delete column, toggle header row/column, merge cells, split cell, and delete table.
- Desktop table actions appear as a compact floating toolbar near the active table cell.
- Mobile table actions open from a touch-friendly bottom sheet.
- Checklist styling is improved with larger checkbox targets, clearer nested spacing, checked-item styling, and mobile-friendly hit areas.
- Checklist actions are implemented as contextual controls when the selection is inside a checklist item.
- Checklist actions include mark checked, mark unchecked, indent, outdent, and convert to text.
- File attachment block is implemented as a real Tiptap node.
- Files can be attached from the desktop Insert menu, desktop toolbar, mobile Insert sheet, and slash command menu.
- The first attachment implementation stores selected files as local document data URLs with a 10 MB limit.
- `.mybook.md` export preserves file attachments with readable fenced container syntax.
- `.mybook.md` import restores fenced file attachment syntax into MyBook file attachment blocks.
- Image insert event handling is registered before editor loading returns so editor initialization keeps a stable React hook order.

### Step 7: MyBook Markdown Format

Goal: make `.mybook.md` a portable backup/export format for MyBook documents.

Rules:

- Tiptap JSON remains the internal editing source.
- `.mybook.md` is the portable backup/export layer.
- Standard content should use normal Markdown where possible.
- MyBook-only blocks should use readable container syntax.
- Files should remain understandable when opened in other Markdown editors.

Example:

```md
---
mybook_version: 1
type: document
title: "Project Notes"
---

# Project Notes

:::callout type="info" title="Remember"
This remains readable outside MyBook.
:::

:::toggle title="More details"
Hidden content appears here.
:::
```

## Import and Export Rules

Import should be explicit. MyBook should not silently pull Drive edits into local documents.

Supported import targets:

- `.mybook.md`
- `.md`
- `.docx`

Supported export targets:

- `.mybook.md`
- `.docx`

Formatting should be preserved where practical. When a source format cannot represent a MyBook feature exactly, the import/export flow should prefer readable content over hidden or broken data.

## Acceptance Criteria

Before each editor task is considered done:

- Existing document editing still works.
- Autosave still writes local Tiptap JSON.
- Drive backup behavior remains backup-only.
- Desktop layout is usable at normal laptop widths.
- Mobile layout is usable on narrow screens.
- Keyboard navigation and focus states are not broken.
- Tests and build pass, or any failure is clearly documented.
