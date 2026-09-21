# New Syncing Implementation

Status: Open — documented only; no fix implemented.

## Issue

Selecting a device folder that already contains `Writin/files` does not discover
its existing documents and spreadsheets. The app lists files from its browser
database, but workspace initialization does not scan the selected folder to
restore missing file records. Files on disk can therefore be absent from the UI
when browser database records are missing. Logging in again alone has not been
confirmed as the cause of missing records.

The user's folder structure is valid:

```text
Writin/              <- User-created folder selected in the picker
└── Writin/          <- App-created folder
    └── files/
        └── Existing saved files
```

## Expected fix

When opening an existing workspace, discover supported files in the selected
folder's `Writin/files` directory and restore the records needed to display them.
Preserve existing disk contents and avoid duplicate entries when exact-content
and portable versions represent the same document, or when reopening a workspace.
Determine how to recover names, types, and folder relationships from available
metadata; do not assume all metadata is currently persisted on disk.

## Verification needed

- Open a populated workspace with an empty browser database and verify supported
  documents and spreadsheets appear and open correctly.
- Reopen the same workspace and verify no duplicate entries or overwritten files.
- Verify the nested structure above resolves to the existing `Writin/files`.

The initial diagnosis came from inspecting `src/services/localWorkspace.ts` and
`src/database/repositories.ts`. Existing workspace, login, and folder-view tests
were attempted but could not start because of a dependency `ERR_REQUIRE_ESM`
error. The reported scenario still needs a successful runtime reproduction.

## Discussed direction: Markdown documents and companion attachments

Planning note only — implementation is not authorized by this note. Keep
spreadsheets outside the scope of this proposed document-storage change.

- Use one user-facing `.md` file per document, without the `.mybook` suffix or
  a separate user-facing `.content.json` copy.
- Use the selected folder directly as the workspace root. Leave a newly selected
  empty folder empty until the user creates content; do not add `Writin/files`.
- Mirror folders and documents created in the app on disk, including nested
  folders, renames, and moves.
- Keep the document in place when media is added. Create a companion attachment
  folder only when needed, rather than moving the document into a new folder.

Example proposed layout:

```text
My workspace/
├── Shopping.md
├── Holiday.md
└── Holiday.attachments/
    ├── beach.jpg
    ├── tickets.pdf
    └── recording.mp3
```

Reference local media using relative paths in the Markdown file. The app could
hide companion folders from its document sidebar while keeping attachments
accessible on disk. Renaming or moving a document must handle its companion
folder and update affected links safely.

The `.mybook.md` suffix is not technically required. However, changing the
extension does not make all editor blocks standard Markdown. Preserve ordinary
content with Markdown and advanced blocks with documented additional syntax or
structured data inside the same `.md` file. Other Markdown editors may not render
those advanced blocks identically.

JSON may remain an internal editor representation or cache, but essential
document data must be recoverable from the Markdown and attachment files without
the original browser database. Verify every supported block survives saving and
reopening before removing the exact JSON disk copy.

## Safety requirements for the proposed storage change

- Scan the selected workspace recursively and rebuild the app's file list from
  disk, treating the browser database as a rebuildable cache.
- Support opening or migrating the existing nested `Writin/files` layout above;
  do not abandon existing documents when introducing the new layout.
- During migration, retain original files for recovery and verify converted
  documents before any cleanup. Avoid duplicate documents and filename collisions.
- Preserve unsupported block content rather than silently dropping it.
- Detect external edits before overwriting files and handle interrupted writes.
- Verify images, audio, video, PDFs, other attachments, and advanced editor blocks;
  test reopening with an empty browser database, nested folders, renames, moves,
  attachment links, and repeated workspace opening.

## UX follow-up: private storage and downloads

- Improve capability-based onboarding: detect missing `showDirectoryPicker` and
  adapt the storage choices. Apple-device detection may tailor explanatory copy,
  but actual browser capabilities must decide which features are enabled.
- Complete and verify the private OPFS workflow (initialization, create, update,
  append where needed, read, and delete), with the existing IndexedDB fallback
  handled explicitly. Keep these implementation details out of the normal UX.
- Provide friendly iOS/browser-specific guidance explaining that direct folder
  saving is unavailable in that browser, private device storage needs no account,
  and users can download their documents to Files. Do not present an inferred
  Apple privacy rationale as an established reason for missing API support.
- Explain that private storage does not sync across devices by itself. Persistent
  storage can protect against automatic eviction when granted, but cannot protect
  against deliberate website-data deletion; do not promise immunity to all cache
  or browser-data clearing actions.
- Provide individual `.md` downloads in the document More menu, folder ZIP
  exports, and a full-vault ZIP export in the library. Name the full ZIP after the
  user's workspace and include attachments and folder structure in ZIP exports.
  This supersedes the earlier preference against ZIP vault exports.
- A Markdown-only download does not include its local media: the document-level
  download UX for companion attachments remains to be decided. Do not describe an
  isolated Markdown download as a complete backup of a document containing media.
- Use the browser download/share flow; do not promise a particular save location
  or that a download goes directly into Files without user interaction.

## Vault onboarding, naming, and cloud connection

- Where direct folder access is supported, show `Select a Local Vault Folder`.
  Display the selected or newly created folder's actual name at the top of the
  sidebar instead of the generic `Local workspace` label.
- Where folder selection is unavailable, show `Create a Private Device Vault`.
  Provide an editable name input prefilled with `Private Device Vault`; use the
  chosen name at the top of the sidebar.
- Show `Connect Cloud Vault (Google)` below the local vault name in the sidebar
  and in Settings. Connecting is optional; local use never requires sign-in.
- For iOS onboarding, prominently offer `Connect Cloud Vault (Recommended for
  iOS)` while retaining an easy account-free private-vault path. Recommendation
  must not imply that Google removes local browser storage restrictions.
- Detect capabilities first, rather than disabling folder selection for all
  Apple devices; supported browsers on macOS can use device folders.
- Suggested explanatory copy: "This browser doesn't support saving directly into
  a chosen folder. Your documents stay in this browser's private storage on this
  device. Export copies to Files or optionally connect Google Drive."
- Do not call OPFS an encrypted vault without implementing and verifying actual
  encryption. Explain that clearing website data removes local-only documents.

## Proposed flow: local saving with optional Google Drive sync

Documented for discussion only; no implementation requested yet.

- Local-only use must remain available without sign-in. Save to a selected device
  folder when supported and chosen; otherwise use private storage (OPFS where
  available).
- Let a local user optionally connect Google Drive later without losing the local
  workspace or changing its selected disk folder. Sync existing and future work
  automatically into a Drive folder named `Writin`. Upload all existing documents
  and attachments automatically when connected; no manual upload step is needed.
- If the user starts with Google Drive, still save locally first using OPFS where
  available, then sync automatically. Account for browsers where OPFS is absent.
- Both paths should use the same local-first save and sync behavior after Drive
  is connected. Sync document contents, media, and folder changes; fetch remote
  changes so other browsers/devices can restore and update their local copies.
- Local-only editor: no routine `Saving` or `Saved` indicator.
- Google-connected editor (whether connected later or selected initially): show
  `Saving…` / `Saved` in the editor header, and `Syncing…` / `Synced` at the bottom
  of the editor's More menu. Keep routine sync status out of the global app header.
- Do not imply completed cloud sync before upload succeeds: show `Synced` only
  after the latest document changes and required attachments are uploaded.
  Keep header status consistent with this meaning; pending/offline changes must
  not appear cloud-saved. Detailed pending/offline/error states can live in More.
- Preserve offline changes, retry safely, and handle conflicts without silently
  overwriting another device's work. Surface actionable reconnect/save errors.
- Reconcile the existing Drive folder named `MyBook` with the proposed `Writin`
  name during implementation; avoid duplicate cloud workspaces or lost backups.
- Verify connecting Drive to an existing local workspace retains local saving,
  uploads existing content without duplication, and opens correctly on a fresh
  browser. Test offline edits, media, reconnection, and simultaneous device edits.

## Preserve existing functionality and UI

Do not break current functionality, saved content, or existing UI while implementing
this plan. Limit UI changes to the agreed onboarding, vault naming, cloud connection,
export actions, and editor status placements. Preserve unrelated flows, editor
blocks, existing backup recovery, and local/Drive data through compatible migration.
Run appropriate regression checks before claiming implementation is complete.

Follow the repository's [working-tree safety and verification requirements](../AGENTS.md).
