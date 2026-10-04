# Collaboration-ready sync architecture

Real-time collaboration is **not implemented**. This guide records the sync model that keeps today's Drive synchronization safe and leaves room for CRDT/OT-style syncing later.

## Principles

1. Local edits are never silently overwritten by remote (Drive) content.
2. Editing, persistence and remote sync are separate layers; remote sync never writes into the editor directly.
3. A remote change is an *external update* that may be applied, kept aside, or deferred. It is never assumed to be safe to apply.
4. No logic assumes one device or one user is the only writer.
5. No timing heuristics ("idle for N seconds") decide whether it is safe to apply remote content. Safety is derived from state.

## Layers

| Layer | Responsibility | Code |
| --- | --- | --- |
| Editor session | Owns ProseMirror state and local edits | `TiptapDocumentEditor.tsx` |
| Persistence | Autosaves local content to IndexedDB | `useAutosave.ts` |
| Remote sync | Detects remote versions, reads remote content | `refreshDriveFileToLocal` in `googleDrive.ts`, `useDriveLiveSync.ts` |
| Reconciler | Decides what an external update may do | `syncReconciler.ts` |
| Conflict store | Keeps the unapplied remote version and resolves conflicts | `syncConflicts.ts` |
| Unsaved-edits probe | Lets sync ask the open editor "do you hold unsaved edits?" | `localEditState.ts` |

## Version model (Step 1)

Each file stores, in addition to `content`:

- `baseContent`: the last content known to match the remote copy (the common ancestor). Written when a push succeeds, when remote content is applied, and on import.
- `lastSyncedAt`: the remote version (Drive `modifiedTime`) that `baseContent` corresponds to.
- `syncConflict`: set while a remote version exists that was not applied (`remoteModifiedTime`, `versionId`, `detectedAt`).

Remote change detection uses the remote version (`modifiedTime` newer than `lastSyncedAt`), not content equality, because Drive Markdown does not round-trip byte-for-byte to local editor JSON.

Files created before `baseContent` existed have `baseContent === undefined`. Only a `backed-up` file is then assumed to equal its remote copy; every other status is treated as locally changed (conservative).

## Reconciler (Step 2)

`reconcileExternalUpdate({ baseContent, localContent, syncStatus, hasUnsavedLocalEdits, hasPendingPush, remoteChanged, remoteContent })` returns:

| Situation | Decision |
| --- | --- |
| Remote version unchanged | `noop` |
| Remote content equals local content and nothing unsaved | `noop` (adopt remote version, update base) |
| Local unchanged since base | `apply-remote` |
| Local changed (stored, unsaved keystrokes, or queued push) and remote changed | `conflict` |

On `conflict`: local content is kept untouched, the remote content is stored as a file version (`Remote version (not applied)`), and `syncConflict` is set. The editor shows a banner:

- **Keep mine**: clears the conflict, acknowledges the remote version (`lastSyncedAt`) and queues a push. The remote version stays in history.
- **Use other version**: saves the current local content to history (`Before using remote version`), replaces content and base with the remote version.

The same remote version never raises a second conflict; only newer remote versions do.

### What counts as unsaved local edits

The open editor registers a probe (`registerUnsavedEditsProbe`) that returns true when a keystroke is waiting to be flushed to autosave, or autosave holds content not yet persisted. The sync layer re-checks the probe immediately before deciding, after the remote fetch. `useAutosave` adds a second guard: if the stored file changes under unsaved edits, the edits are kept and the incoming content is recorded as a conflict.

## Known limits (addressed by later steps)

- Pushing to Drive is not yet conditional on the remote version, so an edit made on another device between the last poll and a push can still be overwritten on Drive. The previous remote version is not captured in that window. (Step 4)
- Full workspace import (`importDriveFilesToLocal`) skips reading remote content for files with local intent and does not raise conflicts.
- Applying remote content (idle case) still uses a full `setContent()`, which resets undo history and remaps the caret by position. (Step 3)
- Conflicts are whole-document; there is no merge.

## Roadmap

1. Version model: `baseContent`, `lastSyncedAt` (done).
2. Reconciler and conflict snapshot + banner (done).
3. Apply remote updates as a diff transaction (`addToHistory: false`, selection mapping, origin metadata) instead of `setContent()`.
4. Conditional push with a version precondition.
5. Stable block IDs and a pluggable sync transport (`pull`, `push`, `subscribe`).

## Related specifications

[Google Drive synchronization](./google-drive-sync.md), [Document editor](./document-editor.md), [Files and folders](./files-and-folders.md).

## Verification

`syncReconciler.test.ts`, `localEditState.test.ts`, `syncConflicts.test.ts`, `useAutosave.test.tsx`, and the `refreshDriveFileToLocal` cases in `googleDrive.test.ts`.
