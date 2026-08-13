# Spreadsheet Editor

## Purpose

The spreadsheet editor provides workbook editing for MyBook spreadsheets.

## Editor Engine

MyBook uses Univer Sheets for spreadsheet editing.

Enabled surface area includes:

- workbook grid
- toolbar
- formula bar
- sheet bar
- statistic bar
- zoom slider
- add sheet button

## Storage

Spreadsheet state is saved as a Univer workbook snapshot in IndexedDB. Autosave updates local content after workbook commands.

## Import and Export

The editor can import `.xlsx` files into a Univer workbook snapshot.

The editor can export/download `.xlsx` files. Export may show warnings when workbook features cannot be represented perfectly.

## Drive Backup

Spreadsheet backups are uploaded to Google Drive as `.xlsx`. Backup can run automatically after local save or manually through editor actions.

## Drive Conflict

If the Drive copy is newer than the last backup, the editor asks whether to keep the local workbook, use the Drive workbook, or download both.
