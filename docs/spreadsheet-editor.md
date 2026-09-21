# Spreadsheet editor

## Editor and storage

Spreadsheets open at `/spreadsheet/:spreadsheetId` using the lazily loaded `UniverSpreadsheetEditor`. Univer Sheets provides the workbook grid, formatting toolbar, formula bar, sheet bar, add-sheet control, statistics and zoom. Content is serialized as a Univer workbook snapshot in IndexedDB and autosaved after workbook commands.

Implementation: `src/components/spreadsheet-editor/UniverSpreadsheetEditor.tsx`, `src/hooks/useAutosave.ts` and `src/utils/xlsx.ts`.

## Dedicated XLSX import/export

The editor imports actual `.xlsx` workbooks into Univer snapshots and exports snapshots through the XLSX conversion utility. Conversion may report warnings where workbook features cannot be represented exactly. Google Drive spreadsheet backups use the conversion path and `.xlsx` files.

Do not promise complete Excel feature parity, macros or lossless preservation of arbitrary workbooks. Validate the formulas, formatting and sheet structures relevant to each import/export case.

## Cloud changes

A newer Drive copy can trigger editor conflict handling with options to retain local work, use remote content or download copies. Startup/reconnect imports also exist in the shared Drive service. See [Drive synchronization](./google-drive-sync.md) for queued local intent and version snapshots.

## Local-folder and ZIP limitation

`localWorkspace.ts` currently writes the raw workbook content string using an `.xlsx` filename and scans `.xlsx` files as text. `vaultExport.ts` similarly places workbook text under `.xlsx` inside ZIPs. These paths do not perform Excel conversion and should not be treated as valid portable XLSX export/import.

Use the dedicated spreadsheet editor export for actual Excel files. Remaining implementation work is to use proper conversion in folder/ZIP paths, or clearly identify an internal snapshot format without misleading extensions. Binary XLSX folder discovery needs the corresponding parser.

## Verification

Tests in `src/utils/xlsx.test.ts` exercise conversion; workspace/export tests cover their own storage paths. Test multiple sheets, formulas, formatting and conversion warnings separately from local-folder recovery. Live Drive conflicts, offline edits and fresh-browser restore still need browser/account acceptance checks.
