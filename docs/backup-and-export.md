# Backup, import and export

## Supported paths

| Content | Import | Export / backup |
| --- | --- | --- |
| Document | `.docx`, `.md`, `.mybook.md` in the editor | `.docx` and `.md` downloads; `.mybook.md` Drive backup |
| Spreadsheet | Dedicated editor `.xlsx` import | Dedicated editor `.xlsx` export and Drive backup |
| Local workspace | Versioned `.mybook-backup.json` in Settings | JSON backup through browser share or download |
| Folder or active vault | No general ZIP restore flow | ZIP containing document Markdown, extracted embedded attachments and folder paths; spreadsheet caveat below |

## JSON recovery backup

`src/services/localBackup.ts` writes kind `mybook-workspace-backup`, version `1`, export time, active local files/folders and version records. Deleted files/folders are excluded. The current exporter reads the full version table; it does not filter exported versions by workspace. Import retains only versions belonging to imported files.

The current filename is `writin-backup-<timestamp>.mybook-backup.json` and the share title is **Writin backup**, although the application is primarily named MyBook. The browser share API is used when supported, otherwise an ordinary download is triggered. The user/browser decides the save location.

Import validates the backup envelope and restores into a newly named **Imported backup …** folder. It assigns new file/folder IDs, remaps document links, clears Drive IDs, marks records local, and writes restored files through the local-storage service. Existing records are not intentionally overwritten by JSON restore.

## Markdown and media

Document downloads use `.md`, with the same MyBook frontmatter/container format used by `.mybook.md` backups. See [the format specification](./advanced-editor-and-format-spec.md). DOCX import uses Mammoth; complex layouts and advanced blocks may be simplified when converting formats.

`src/services/vaultExport.ts` builds folder/vault ZIPs from the active workspace's non-deleted records. It preserves file folder paths and extracts data-URL media into `<document>_attachments/`. Remote media URLs remain remote. Empty folders are not independently emitted. Individual Markdown downloads do not create a companion-media ZIP; embedded data URLs and custom syntax may not render in other Markdown tools.

The sidebar passes the selected vault name for the ZIP filename. Settings currently invokes the export with its default name. Folder ZIPs restrict files to the chosen subtree.

## Limitations and remaining work

Local-folder and vault-ZIP spreadsheet paths currently write workbook text under `.xlsx`; they are not equivalent to the dedicated Excel converter. See [spreadsheet storage](./spreadsheet-editor.md#local-folder-and-zip-limitation).

Verify filename and attachment collisions, nested paths, all media types, repeated restore and document-link remapping. Decide a complete single-document-with-media download flow. Align ZIP naming between Settings and the sidebar, and filter JSON version export to its intended scope. ZIP export is not a substitute for a verified round-trip restore format.

Implementation/tests: `localBackup.ts` / `localBackup.test.ts`, `vaultExport.ts` / `vaultExport.test.ts`, `src/utils/zip.ts` / `zip.test.ts`, `docx.ts`, `xlsx.ts`, and `mybookMarkdown.ts` with their test files.
