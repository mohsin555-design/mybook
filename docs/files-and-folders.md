# Files, folders, search and favorites

## Module and routes

The library manages document and spreadsheet records. Home, Favorites, Folders, Search and Trash are separate routes in `src/app/router.tsx`. UI actions live in `src/components/files/`; data operations and workspace filtering live in `src/database/repositories.ts`.

## Files

Users can create, open, rename, duplicate, move, favorite, move to Trash, restore, and permanently delete files. New names default to `Untitled` or `Untitled Spreadsheet`, with numbered suffixes to avoid duplicates. Rename rejects empty names and duplicate names in the target folder. File records contain type, content, parent folder, timestamps, workspace type, favorite/deleted flags and Drive sync metadata.

Local files start with `syncStatus: local`; Google workspace files start pending. Lists are filtered to the active workspace and normal views exclude deleted files. Duplicates receive a new ID and lose the source Drive link and favorite flag. Local file reads can hydrate content from disk.

## Folders

Folders support creation, nesting, browsing, rename, favorites, Trash, restore and permanent deletion. App-created nesting is limited to three levels. Deleting a folder marks its descendants deleted; restore handles the subtree. Local disk folder creation and file writes use the folder hierarchy. Do not assume disk renames/moves are atomic or fully reconciled; see [local vaults](./local-vaults.md).

## Search and navigation

Search matches file names, not full document content. Type filters select documents, spreadsheets or both. Sorting supports recent, oldest, ascending/descending name and type. File actions are available from results. Favorites provide a separate navigation destination, and folder breadcrumbs preserve hierarchy context.

## Trash and cloud operations

Soft deletion retains local records for Trash and queues Drive trash operations when connected. Restore clears the deleted flag and restores or recreates the remote item as needed. Permanent deletion removes records/local files directly when no remote deletion is needed; otherwise a queued operation completes remote deletion before local cleanup. Pending offline operations must not be presented as completed remote deletions.

## Export and verification

Folder actions include ZIP export; the sidebar also provides active-vault ZIP export. Format details and limitations are in [backup and export](./backup-and-export.md).

Tests cover repositories, folder management/breadcrumbs, Home, Search and Trash. Remaining acceptance checks include nested restore, disk folder rename behavior, interrupted permanent deletion and reconnecting queued operations against Drive. Local metadata and disk contents should be checked together when testing recovery.
