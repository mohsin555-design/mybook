import { describe, expect, it } from 'vitest'

import {
  exportWorkbookToXlsx,
  importXlsxToWorkbook,
  MAX_XLSX_SIZE,
  validateXlsxFile,
  type UniverWorkbookSnapshot,
} from './xlsx'

function asFile(blob: Blob, name = 'budget.xlsx', type = blob.type) {
  return { name, type, size: blob.size, arrayBuffer: () => blob.arrayBuffer() }
}

describe('XLSX conversion', () => {
  it('round trips sheets, values, formulas, number formats, styles, and widths', async () => {
    const source: UniverWorkbookSnapshot = {
      id: 'workbook-1',
      name: 'Budget',
      sheetOrder: ['summary', 'notes'],
      sheets: {
        summary: {
          id: 'summary',
          name: 'Summary',
          columnData: { 0: { w: 140 } },
          cellData: {
            0: { 0: { v: 'Revenue', s: { bl: 1, bg: { rgb: '#FFF2CC' } } } },
            1: { 0: { v: 1250, s: { n: { pattern: '$#,##0.00' } } } },
            2: { 0: { v: 1250, f: '=SUM(A2:A2)' } },
          },
        },
        notes: { id: 'notes', name: 'Notes', cellData: { 0: { 0: { v: 'Reviewed' } } } },
      },
    }

    const exported = await exportWorkbookToXlsx(source)
    expect(exported.success).toBe(true)
    expect(exported.data?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const imported = await importXlsxToWorkbook(asFile(exported.data!), 'workbook-2')
    expect(imported.success).toBe(true)
    const sheetIds = imported.data?.sheetOrder ?? []
    const summary = imported.data?.sheets?.[sheetIds[0]!]
    expect(sheetIds).toHaveLength(2)
    expect(summary?.name).toBe('Summary')
    expect(summary?.cellData?.[0]?.[0]?.v).toBe('Revenue')
    expect(summary?.cellData?.[1]?.[0]?.v).toBe(1250)
    expect(summary?.cellData?.[1]?.[0]?.s).toMatchObject({ n: { pattern: '$#,##0.00' } })
    expect(summary?.cellData?.[2]?.[0]?.f).toBe('=SUM(A2:A2)')
    expect(summary?.columnData?.[0]?.w).toBeCloseTo(140)
  })

  it('validates extension, MIME type, and size', () => {
    expect(validateXlsxFile({ name: 'book.xls', type: 'application/octet-stream', size: 10 })).toMatch(/\.xlsx/)
    expect(validateXlsxFile({ name: 'book.xlsx', type: 'text/plain', size: 10 })).toMatch(/MIME/)
    expect(validateXlsxFile({ name: 'book.xlsx', type: '', size: MAX_XLSX_SIZE + 1 })).toMatch(/20 MB/)
  })

  it('returns an error instead of throwing for an invalid archive', async () => {
    const invalid = new Blob(['not an Excel file'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const result = await importXlsxToWorkbook(asFile(invalid, 'broken.xlsx'))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/valid XLSX/)
  })
})
