import ExcelJS, { type CellValue, type Fill, type Font } from 'exceljs'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const MAX_XLSX_SIZE = 20 * 1024 * 1024

interface UniverCell {
  v?: string | number | boolean | null
  f?: string
  s?: string | Record<string, unknown>
}

interface UniverSheet {
  id: string
  name: string
  rowCount?: number
  columnCount?: number
  cellData?: Record<number, Record<number, UniverCell>>
  columnData?: Record<number, { w?: number }>
}

export interface UniverWorkbookSnapshot {
  id: string
  name?: string
  sheetOrder?: string[]
  sheets?: Record<string, UniverSheet>
  styles?: Record<string, Record<string, unknown>>
}

export interface XlsxResult<T> {
  success: boolean
  data?: T
  warnings: string[]
  error?: string
}

interface XlsxFileLike {
  name: string
  type: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function color(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const rgb = (value as { rgb?: unknown }).rgb
  return typeof rgb === 'string' ? rgb.replace('#', '').replace(/^FF/i, '') : undefined
}

function resolvedStyle(cell: UniverCell, workbook: UniverWorkbookSnapshot) {
  if (typeof cell.s === 'string') return workbook.styles?.[cell.s] ?? {}
  return cell.s ?? {}
}

function applyUniverStyleToExcel(cell: import('exceljs').Cell, style: Record<string, unknown>) {
  const fontColor = color(style.cl)
  cell.font = {
    bold: Boolean(style.bl),
    italic: Boolean(style.it),
    strike: Boolean(style.st),
    underline: style.ul ? true : undefined,
    size: typeof style.fs === 'number' ? style.fs : undefined,
    name: typeof style.ff === 'string' ? style.ff : undefined,
    color: fontColor ? { argb: `FF${fontColor}` } : undefined,
  }
  const fillColor = color(style.bg)
  if (fillColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fillColor}` } }
  const numberStyle = style.n as { pattern?: unknown } | undefined
  if (typeof numberStyle?.pattern === 'string') cell.numFmt = numberStyle.pattern
  const horizontal = style.ht
  if (horizontal === 1 || horizontal === 'left') cell.alignment = { horizontal: 'left' }
  if (horizontal === 2 || horizontal === 'center') cell.alignment = { horizontal: 'center' }
  if (horizontal === 3 || horizontal === 'right') cell.alignment = { horizontal: 'right' }
}

function excelColor(value: { argb?: string; rgb?: string } | undefined) {
  const raw = value?.argb ?? value?.rgb
  return raw ? `#${raw.slice(-6)}` : undefined
}

function excelStyleToUniver(font: Partial<Font>, fill: Fill | undefined, numFmt: string, alignment: { horizontal?: string } | undefined) {
  const style: Record<string, unknown> = {}
  if (font.bold) style.bl = 1
  if (font.italic) style.it = 1
  if (font.strike) style.st = 1
  if (font.underline) style.ul = { s: 1 }
  if (font.size) style.fs = font.size
  if (font.name) style.ff = font.name
  const fontColor = excelColor(font.color)
  if (fontColor) style.cl = { rgb: fontColor }
  if (fill?.type === 'pattern') {
    const fillColor = excelColor(fill.fgColor)
    if (fillColor) style.bg = { rgb: fillColor }
  }
  if (numFmt && numFmt !== 'General') style.n = { pattern: numFmt }
  if (alignment?.horizontal) style.ht = alignment.horizontal
  return style
}

export async function exportWorkbookToXlsx(snapshot: UniverWorkbookSnapshot): Promise<XlsxResult<Blob>> {
  try {
    const workbook = new ExcelJS.Workbook()
    const ids = snapshot.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(snapshot.sheets ?? {})
    for (const id of ids) {
      const source = snapshot.sheets?.[id]
      if (!source) continue
      const sheet = workbook.addWorksheet(source.name || 'Sheet')
      for (const [columnIndex, column] of Object.entries(source.columnData ?? {})) {
        if (column.w) sheet.getColumn(Number(columnIndex) + 1).width = Math.max(1, column.w / 7)
      }
      for (const [rowIndex, row] of Object.entries(source.cellData ?? {})) {
        for (const [columnIndex, sourceCell] of Object.entries(row)) {
          const cell = sheet.getCell(Number(rowIndex) + 1, Number(columnIndex) + 1)
          if (sourceCell.f) cell.value = { formula: sourceCell.f.replace(/^=/, ''), result: sourceCell.v ?? undefined }
          else cell.value = sourceCell.v as CellValue
          applyUniverStyleToExcel(cell, resolvedStyle(sourceCell, snapshot))
        }
      }
    }
    if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1')
    const buffer = await workbook.xlsx.writeBuffer()
    const bytes = new Uint8Array(buffer)
    return { success: true, data: new Blob([bytes], { type: XLSX_MIME }), warnings: ['Charts, macros, pivot tables, conditional formatting, and external data connections are not exported.'] }
  } catch {
    return { success: false, warnings: [], error: 'The workbook could not be exported as XLSX.' }
  }
}

export function validateXlsxFile(file: Pick<XlsxFileLike, 'name' | 'type' | 'size'>): string | null {
  if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) return 'Choose a file with the .xlsx extension.'
  if (file.size <= 0) return 'The selected file is empty.'
  if (file.size > MAX_XLSX_SIZE) return 'The selected file is larger than 20 MB.'
  const allowedTypes = [XLSX_MIME, 'application/octet-stream', 'application/zip', '']
  if (!allowedTypes.includes(file.type)) return 'The selected file does not have a valid XLSX MIME type.'
  return null
}

function cellValue(value: CellValue, warnings: Set<string>): { value?: string | number | boolean; formula?: string } {
  if (value === null) return {}
  if (value instanceof Date) return { value: (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000 }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return { value }
  if (typeof value === 'object' && 'formula' in value) return { formula: `=${value.formula}`, value: typeof value.result === 'string' || typeof value.result === 'number' || typeof value.result === 'boolean' ? value.result : undefined }
  if (typeof value === 'object' && 'richText' in value) {
    warnings.add('Rich text inside individual cells was converted to plain text.')
    return { value: value.richText.map((part) => part.text).join('') }
  }
  warnings.add('Some unsupported cell values were converted to text.')
  return { value: String(value) }
}

export async function importXlsxToWorkbook(file: XlsxFileLike, workbookId: string = crypto.randomUUID()): Promise<XlsxResult<UniverWorkbookSnapshot>> {
  const validationError = validateXlsxFile(file)
  if (validationError) return { success: false, warnings: [], error: validationError }
  try {
    const input = new Uint8Array(await file.arrayBuffer())
    if (input[0] !== 0x50 || input[1] !== 0x4b) return { success: false, warnings: [], error: 'The file is not a valid XLSX archive.' }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(input as unknown as Buffer)
    const warnings = new Set<string>()
    const sheets: Record<string, UniverSheet> = {}
    const sheetOrder: string[] = []
    workbook.eachSheet((worksheet) => {
      const id = crypto.randomUUID()
      sheetOrder.push(id)
      const cellData: Record<number, Record<number, UniverCell>> = {}
      const columnData: Record<number, { w?: number }> = {}
      worksheet.columns.forEach((column, index) => { if (column.width) columnData[index] = { w: column.width * 7 } })
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
          const converted = cellValue(cell.value, warnings)
          const style = excelStyleToUniver(cell.font, cell.fill, cell.numFmt, cell.alignment)
          const targetRow = cellData[rowNumber - 1] ?? (cellData[rowNumber - 1] = {})
          targetRow[columnNumber - 1] = { v: converted.value, f: converted.formula, s: style }
        })
      })
      if (worksheet.model.merges?.length) warnings.add('Merged cells were flattened during import.')
      sheets[id] = { id, name: worksheet.name, rowCount: Math.max(100, worksheet.rowCount), columnCount: Math.max(26, worksheet.columnCount), cellData, columnData }
    })
    if (!sheetOrder.length) return { success: false, warnings: [], error: 'The XLSX file does not contain any worksheets.' }
    warnings.add('Charts, macros, pivot tables, conditional formatting, and external connections are not imported.')
    return { success: true, data: { id: workbookId, name: file.name.replace(/\.xlsx$/i, ''), sheetOrder, sheets }, warnings: [...warnings] }
  } catch {
    return { success: false, warnings: [], error: 'The XLSX file is invalid or unsupported.' }
  }
}

export function downloadXlsx(blob: Blob, title: string) {
  const safeName = (title.trim() || 'Untitled spreadsheet').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}.xlsx`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
