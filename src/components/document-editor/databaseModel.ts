export type DatabaseColumnType = 'text' | 'number' | 'select' | 'status' | 'date' | 'checkbox'
export type DatabaseOptionColor = 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink'

export interface DatabaseOption {
  id: string
  label: string
  color: DatabaseOptionColor
}

export interface DatabaseColumn {
  id: string
  name: string
  type: DatabaseColumnType
  options?: DatabaseOption[]
}

export type DatabaseCellValue = string | number | boolean | null
export type DatabaseSortDirection = 'asc' | 'desc'
export type DatabaseFilterOperator =
  | 'contains'
  | 'doesNotContain'
  | 'is'
  | 'isNot'
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isBefore'
  | 'isAfter'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isChecked'
  | 'isUnchecked'

export interface DatabaseSort {
  columnId: string
  direction: DatabaseSortDirection
}

export interface DatabaseFilter {
  id: string
  columnId: string
  operator: DatabaseFilterOperator
  value?: DatabaseCellValue
}

export interface DatabaseViewState {
  sort?: DatabaseSort | null
  filters?: DatabaseFilter[]
}

export interface DatabaseRow {
  id: string
  values: Record<string, DatabaseCellValue>
}

export interface DatabaseAttrs {
  version: 1
  id: string
  title: string
  columns: DatabaseColumn[]
  rows: DatabaseRow[]
  viewState?: DatabaseViewState
}

export const DATABASE_VERSION = 1

const DEFAULT_STATUS_LABELS = ['Not started', 'In progress', 'Done'] as const
const DEFAULT_STATUS_COLORS: DatabaseOptionColor[] = ['gray', 'blue', 'green']
const DEFAULT_SELECT_LABELS = ['Option 1', 'Option 2', 'Option 3'] as const
const DEFAULT_SELECT_COLORS: DatabaseOptionColor[] = ['gray', 'blue', 'green']
export const DATABASE_OPTION_COLORS: DatabaseOptionColor[] = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2, 12)
}

export function prefixedId(prefix: 'db' | 'col' | 'row' | 'opt' | 'filter') {
  return `${prefix}_${uuid()}`
}

export function createDefaultStatusOptions(): DatabaseOption[] {
  return DEFAULT_STATUS_LABELS.map((label, index) => ({
    id: prefixedId('opt'),
    label,
    color: DEFAULT_STATUS_COLORS[index] ?? 'gray',
  }))
}

export function createDefaultSelectOptions(): DatabaseOption[] {
  return DEFAULT_SELECT_LABELS.map((label, index) => ({
    id: prefixedId('opt'),
    label,
    color: DEFAULT_SELECT_COLORS[index] ?? 'gray',
  }))
}

export function createDefaultDatabase(): DatabaseAttrs {
  return {
    version: DATABASE_VERSION,
    id: prefixedId('db'),
    title: 'Untitled database',
    columns: [
      { id: prefixedId('col'), name: 'Name', type: 'text' },
      { id: prefixedId('col'), name: 'Status', type: 'status', options: createDefaultStatusOptions() },
    ],
    rows: [
      { id: prefixedId('row'), values: {} },
    ],
  }
}

export function databaseBlockNode(attrs: DatabaseAttrs = createDefaultDatabase()) {
  return { type: 'databaseBlock', attrs }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function validColumnType(value: unknown): value is DatabaseColumnType {
  return value === 'text' || value === 'number' || value === 'select' || value === 'status' || value === 'date' || value === 'checkbox'
}

function validOptionColor(value: unknown): value is DatabaseOptionColor {
  return typeof value === 'string' && DATABASE_OPTION_COLORS.includes(value as DatabaseOptionColor)
}

function normalizeOptions(options: unknown, type: 'select' | 'status'): DatabaseOption[] {
  if (!Array.isArray(options)) return type === 'status' ? createDefaultStatusOptions() : createDefaultSelectOptions()
  const seen = new Set<string>()
  const normalized = options.flatMap((option): DatabaseOption[] => {
    if (!isRecord(option) || typeof option.id !== 'string' || !option.id) return []
    if (seen.has(option.id)) return []
    seen.add(option.id)
    const color = validOptionColor(option.color) ? option.color : 'gray'
    return [{ id: option.id, label: cleanName(option.label, 'Option'), color }]
  })
  return normalized
}

function normalizeColumn(value: unknown, index: number): DatabaseColumn | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !validColumnType(value.type)) return null
  const base = {
    id: value.id,
    name: cleanName(value.name, index === 0 ? 'Name' : 'Property'),
    type: value.type,
  }
  if (value.type === 'status' || value.type === 'select') return { ...base, options: normalizeOptions(value.options, value.type) }
  return base
}

function uniqueNormalizedId(id: string, seen: Set<string>, prefix: 'col' | 'row') {
  if (!seen.has(id)) {
    seen.add(id)
    return id
  }
  let nextId = prefixedId(prefix)
  while (seen.has(nextId)) nextId = prefixedId(prefix)
  seen.add(nextId)
  return nextId
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 1) - 1 && date.getUTCDate() === day
}

function normalizeCellValue(column: DatabaseColumn, value: unknown): DatabaseCellValue {
  if (column.type === 'checkbox') {
    if (value === true || value === false) return value
    return null
  }
  if (column.type === 'status' || column.type === 'select') {
    if (typeof value !== 'string') return null
    return column.options?.some((option) => option.id === value) ? value : null
  }
  if (column.type === 'number') return parseFiniteNumber(value)
  if (column.type === 'date') return typeof value === 'string' && isValidDateOnly(value) ? value : null
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

export function filterOperatorsForType(type: DatabaseColumnType): DatabaseFilterOperator[] {
  if (type === 'number') return ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'isEmpty', 'isNotEmpty']
  if (type === 'select' || type === 'status') return ['is', 'isNot', 'isEmpty', 'isNotEmpty']
  if (type === 'date') return ['is', 'isBefore', 'isAfter', 'isEmpty', 'isNotEmpty']
  if (type === 'checkbox') return ['isChecked', 'isUnchecked']
  return ['contains', 'doesNotContain', 'is', 'isNot', 'isEmpty', 'isNotEmpty']
}

function isValidFilterOperatorForType(operator: unknown, type: DatabaseColumnType): operator is DatabaseFilterOperator {
  return typeof operator === 'string' && filterOperatorsForType(type).includes(operator as DatabaseFilterOperator)
}

export function filterNeedsValue(operator: DatabaseFilterOperator) {
  return operator !== 'isEmpty' && operator !== 'isNotEmpty' && operator !== 'isChecked' && operator !== 'isUnchecked'
}

function normalizeFilterValue(column: DatabaseColumn, operator: DatabaseFilterOperator, value: unknown): DatabaseCellValue | null {
  if (!filterNeedsValue(operator)) return null
  return normalizeCellValue(column, value)
}

function normalizeViewState(viewState: unknown, columns: DatabaseColumn[]): DatabaseViewState | undefined {
  if (!isRecord(viewState)) return undefined
  const columnById = new Map(columns.map((column) => [column.id, column]))
  const normalized: DatabaseViewState = {}
  if (isRecord(viewState.sort)) {
    const column = typeof viewState.sort.columnId === 'string' ? columnById.get(viewState.sort.columnId) : undefined
    if (column && (viewState.sort.direction === 'asc' || viewState.sort.direction === 'desc')) {
      normalized.sort = { columnId: column.id, direction: viewState.sort.direction }
    }
  }
  if (Array.isArray(viewState.filters)) {
    const seen = new Set<string>()
    const filters = viewState.filters.flatMap((filter): DatabaseFilter[] => {
      if (!isRecord(filter) || typeof filter.id !== 'string' || !filter.id || seen.has(filter.id)) return []
      const column = typeof filter.columnId === 'string' ? columnById.get(filter.columnId) : undefined
      if (!column || !isValidFilterOperatorForType(filter.operator, column.type)) return []
      const operator = filter.operator
      const value = normalizeFilterValue(column, operator, filter.value)
      if (filterNeedsValue(operator) && value === null) return []
      seen.add(filter.id)
      return [{
        id: filter.id,
        columnId: column.id,
        operator,
        ...(filterNeedsValue(operator) ? { value } : {}),
      }]
    })
    if (filters.length) normalized.filters = filters
  }
  return normalized.sort || normalized.filters?.length ? normalized : undefined
}

export function normalizeDatabaseAttrs(attrs: unknown): DatabaseAttrs {
  const fallback = createDefaultDatabase()
  if (!isRecord(attrs)) return fallback

  const seenColumnIds = new Set<string>()
  const normalizedColumns = Array.isArray(attrs.columns)
    ? attrs.columns.flatMap((column, index) => {
      const normalized = normalizeColumn(column, index)
      return normalized ? [{ ...normalized, id: uniqueNormalizedId(normalized.id, seenColumnIds, 'col') }] : []
    })
    : []

  const hasPrimary = normalizedColumns[0]?.type === 'text'
  const columns = hasPrimary
    ? normalizedColumns
    : [{ id: prefixedId('col'), name: 'Name', type: 'text' } satisfies DatabaseColumn, ...normalizedColumns.filter((column) => column.type !== 'text' || column.name !== 'Name')]

  const seenRowIds = new Set<string>()
  const rows = Array.isArray(attrs.rows)
    ? attrs.rows.flatMap((row): DatabaseRow[] => {
      if (!isRecord(row) || typeof row.id !== 'string' || !row.id) return []
      const sourceValues = isRecord(row.values) ? row.values : {}
      const values: DatabaseRow['values'] = {}
      for (const column of columns) {
        const value = normalizeCellValue(column, sourceValues[column.id])
        if (value !== null) values[column.id] = value
      }
      return [{ id: uniqueNormalizedId(row.id, seenRowIds, 'row'), values }]
    })
    : []

  const viewState = normalizeViewState(attrs.viewState, columns)
  return {
    version: DATABASE_VERSION,
    id: typeof attrs.id === 'string' && attrs.id ? attrs.id : fallback.id,
    title: cleanName(attrs.title, fallback.title),
    columns,
    rows,
    ...(viewState ? { viewState } : {}),
  }
}

function uniqueColumnName(columns: DatabaseColumn[], base: string) {
  const names = new Set(columns.map((column) => column.name.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  let index = 2
  while (names.has(`${base} ${index}`.toLowerCase())) index += 1
  return `${base} ${index}`
}

function isOptionColumn(column: DatabaseColumn | undefined): column is DatabaseColumn & { type: 'select' | 'status', options: DatabaseOption[] } {
  return Boolean(column && (column.type === 'select' || column.type === 'status') && Array.isArray(column.options))
}

function uniqueOptionLabel(options: DatabaseOption[], base = 'Option') {
  const labels = new Set(options.map((option) => option.label.toLowerCase()))
  if (!labels.has(base.toLowerCase())) return base
  let index = 2
  while (labels.has(`${base} ${index}`.toLowerCase())) index += 1
  return `${base} ${index}`
}

function defaultFilterOperatorForColumn(column: DatabaseColumn): DatabaseFilterOperator {
  if (column.type === 'checkbox') return 'isChecked'
  return 'isEmpty'
}

function defaultFilterValueForColumn(column: DatabaseColumn): DatabaseCellValue {
  if (column.type === 'number') return 0
  if (column.type === 'date') return '1970-01-01'
  if (column.type === 'select' || column.type === 'status') return column.options?.[0]?.id ?? null
  if (column.type === 'checkbox') return null
  return ''
}

function withoutColumnViewReferences(viewState: DatabaseViewState | undefined, columnId: string): DatabaseViewState | undefined {
  if (!viewState) return undefined
  const sort = viewState.sort?.columnId === columnId ? undefined : viewState.sort
  const filters = viewState.filters?.filter((filter) => filter.columnId !== columnId)
  return sort || filters?.length ? { ...(sort ? { sort } : {}), ...(filters?.length ? { filters } : {}) } : undefined
}

function withoutOptionFilterReferences(database: DatabaseAttrs, columnId: string, optionId: string): DatabaseViewState | undefined {
  const filters = database.viewState?.filters?.filter((filter) => filter.columnId !== columnId || filter.value !== optionId)
  const sort = database.viewState?.sort
  return sort || filters?.length ? { ...(sort ? { sort } : {}), ...(filters?.length ? { filters } : {}) } : undefined
}

function withOptionalViewState(database: DatabaseAttrs, viewState: DatabaseViewState | undefined): DatabaseAttrs {
  const rest = { ...database }
  delete rest.viewState
  return viewState ? { ...rest, viewState } : rest
}

export function addDatabaseColumn(database: DatabaseAttrs, type: DatabaseColumnType): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const baseName = type === 'text' ? 'Text' : type === 'number' ? 'Number' : type === 'select' ? 'Select' : type === 'status' ? 'Status' : type === 'date' ? 'Date' : 'Checkbox'
  const column: DatabaseColumn = type === 'status' || type === 'select'
    ? { id: prefixedId('col'), name: uniqueColumnName(normalized.columns, baseName), type, options: type === 'status' ? createDefaultStatusOptions() : createDefaultSelectOptions() }
    : { id: prefixedId('col'), name: uniqueColumnName(normalized.columns, baseName), type }
  return { ...normalized, columns: [...normalized.columns, column] }
}

export function renameDatabaseColumn(database: DatabaseAttrs, columnId: string, name: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return {
    ...normalized,
    columns: normalized.columns.map((column) => column.id === columnId ? { ...column, name: cleanName(name, column.name) } : column),
  }
}

export function deleteDatabaseColumn(database: DatabaseAttrs, columnId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  if (normalized.columns[0]?.id === columnId) return normalized
  const columns = normalized.columns.filter((column) => column.id !== columnId)
  const rows = normalized.rows.map((row) => {
    const values = { ...row.values }
    delete values[columnId]
    return { ...row, values }
  })
  const viewState = withoutColumnViewReferences(normalized.viewState, columnId)
  return withOptionalViewState({ ...normalized, columns, rows }, viewState)
}

export function moveDatabaseColumn(database: DatabaseAttrs, columnId: string, direction: 'left' | 'right'): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const index = normalized.columns.findIndex((column) => column.id === columnId)
  if (index <= 0) return normalized
  const targetIndex = direction === 'left' ? index - 1 : index + 1
  if (targetIndex <= 0 || targetIndex >= normalized.columns.length) return normalized
  const columns = [...normalized.columns]
  const [column] = columns.splice(index, 1)
  if (!column) return normalized
  columns.splice(targetIndex, 0, column)
  return { ...normalized, columns }
}

export function setDatabaseSort(database: DatabaseAttrs, columnId: string, direction: DatabaseSortDirection): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  if (!normalized.columns.some((column) => column.id === columnId)) return normalized
  const viewState = { ...(normalized.viewState ?? {}), sort: { columnId, direction } }
  return { ...normalized, viewState }
}

export function clearDatabaseSort(database: DatabaseAttrs): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const filters = normalized.viewState?.filters
  return withOptionalViewState(normalized, filters?.length ? { filters } : undefined)
}

export function clearDatabaseFilters(database: DatabaseAttrs): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const sort = normalized.viewState?.sort
  return withOptionalViewState(normalized, sort ? { sort } : undefined)
}

export function addDatabaseFilter(database: DatabaseAttrs, columnId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const column = normalized.columns.find((candidate) => candidate.id === columnId)
  if (!column) return normalized
  const filter: DatabaseFilter = {
    id: prefixedId('filter'),
    columnId,
    operator: defaultFilterOperatorForColumn(column),
  }
  const viewState = {
    ...(normalized.viewState ?? {}),
    filters: [...(normalized.viewState?.filters ?? []), filter],
  }
  return normalizeDatabaseAttrs({ ...normalized, viewState })
}

export function updateDatabaseFilter(database: DatabaseAttrs, filterId: string, patch: Partial<Omit<DatabaseFilter, 'id'>>): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const filters = normalized.viewState?.filters ?? []
  if (!filters.some((filter) => filter.id === filterId)) return normalized
  const nextFilters = filters.map((filter) => {
    if (filter.id !== filterId) return filter
    const columnId = typeof patch.columnId === 'string' ? patch.columnId : filter.columnId
    const column = normalized.columns.find((candidate) => candidate.id === columnId)
    if (!column) return filter
    const operator = patch.operator && isValidFilterOperatorForType(patch.operator, column.type)
      ? patch.operator
      : isValidFilterOperatorForType(filter.operator, column.type)
        ? filter.operator
        : defaultFilterOperatorForColumn(column)
    const value = patch.value !== undefined
      ? patch.value
      : columnId === filter.columnId && filter.value !== undefined
        ? filter.value
        : defaultFilterValueForColumn(column)
    return {
      id: filter.id,
      columnId,
      operator,
      ...(filterNeedsValue(operator) ? { value } : {}),
    }
  })
  return normalizeDatabaseAttrs({ ...normalized, viewState: { ...(normalized.viewState ?? {}), filters: nextFilters } })
}

export function deleteDatabaseFilter(database: DatabaseAttrs, filterId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const filters = normalized.viewState?.filters?.filter((filter) => filter.id !== filterId)
  const sort = normalized.viewState?.sort
  return withOptionalViewState(normalized, sort || filters?.length ? { ...(sort ? { sort } : {}), ...(filters?.length ? { filters } : {}) } : undefined)
}

export function addDatabaseOption(database: DatabaseAttrs, columnId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return {
    ...normalized,
    columns: normalized.columns.map((column) => {
      if (column.id !== columnId || !isOptionColumn(column)) return column
      return {
        ...column,
        options: [...column.options, { id: prefixedId('opt'), label: uniqueOptionLabel(column.options), color: 'gray' }],
      }
    }),
  }
}

export function renameDatabaseOption(database: DatabaseAttrs, columnId: string, optionId: string, label: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return {
    ...normalized,
    columns: normalized.columns.map((column) => {
      if (column.id !== columnId || !isOptionColumn(column)) return column
      return {
        ...column,
        options: column.options.map((option) => option.id === optionId ? { ...option, label: cleanName(label, option.label) } : option),
      }
    }),
  }
}

export function updateDatabaseOptionColor(database: DatabaseAttrs, columnId: string, optionId: string, color: DatabaseOptionColor): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return {
    ...normalized,
    columns: normalized.columns.map((column) => {
      if (column.id !== columnId || !isOptionColumn(column)) return column
      return {
        ...column,
        options: column.options.map((option) => option.id === optionId ? { ...option, color } : option),
      }
    }),
  }
}

export function deleteDatabaseOption(database: DatabaseAttrs, columnId: string, optionId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const column = normalized.columns.find((candidate) => candidate.id === columnId)
  if (!isOptionColumn(column)) return normalized
  const viewState = withoutOptionFilterReferences(normalized, columnId, optionId)
  return withOptionalViewState({
    ...normalized,
    columns: normalized.columns.map((candidate) => (
      candidate.id === columnId && isOptionColumn(candidate)
        ? { ...candidate, options: candidate.options.filter((option) => option.id !== optionId) }
        : candidate
    )),
    rows: normalized.rows.map((row) => {
      if (row.values[columnId] !== optionId) return row
      const values = { ...row.values }
      delete values[columnId]
      return { ...row, values }
    }),
  }, viewState)
}

export function addDatabaseRow(database: DatabaseAttrs): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return { ...normalized, rows: [...normalized.rows, { id: prefixedId('row'), values: {} }] }
}

export function deleteDatabaseRow(database: DatabaseAttrs, rowId: string): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  return { ...normalized, rows: normalized.rows.filter((row) => row.id !== rowId) }
}

export function moveDatabaseRow(database: DatabaseAttrs, rowId: string, direction: 'up' | 'down'): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const index = normalized.rows.findIndex((row) => row.id === rowId)
  if (index < 0) return normalized
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= normalized.rows.length) return normalized
  const rows = [...normalized.rows]
  const [row] = rows.splice(index, 1)
  if (!row) return normalized
  rows.splice(targetIndex, 0, row)
  return { ...normalized, rows }
}

export function updateDatabaseCell(database: DatabaseAttrs, rowId: string, columnId: string, value: DatabaseCellValue): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const column = normalized.columns.find((candidate) => candidate.id === columnId)
  if (!column) return normalized
  const cleanValue = normalizeCellValue(column, value)
  return {
    ...normalized,
    rows: normalized.rows.map((row) => {
      if (row.id !== rowId) return row
      const values = { ...row.values }
      if (cleanValue === null || cleanValue === '') delete values[columnId]
      else values[columnId] = cleanValue
      return { ...row, values }
    }),
  }
}

function cellIsEmpty(row: DatabaseRow, column: DatabaseColumn) {
  const value = row.values[column.id]
  return value === undefined || value === null || value === ''
}

function optionLabel(column: DatabaseColumn, value: unknown) {
  if (typeof value !== 'string') return ''
  return column.options?.find((option) => option.id === value)?.label ?? ''
}

function sortValue(row: DatabaseRow, column: DatabaseColumn): string | number | boolean | null {
  const value = row.values[column.id]
  if (value === undefined || value === null || value === '') return null
  if (column.type === 'number') return typeof value === 'number' ? value : null
  if (column.type === 'checkbox') return value === true
  if (column.type === 'select' || column.type === 'status') return optionLabel(column, value).toLocaleLowerCase()
  return String(value).toLocaleLowerCase()
}

function compareRows(left: DatabaseRow, right: DatabaseRow, column: DatabaseColumn, direction: DatabaseSortDirection) {
  const leftValue = sortValue(left, column)
  const rightValue = sortValue(right, column)
  const leftEmpty = leftValue === null
  const rightEmpty = rightValue === null
  if (leftEmpty && rightEmpty) return 0
  if (leftEmpty) return 1
  if (rightEmpty) return -1
  let comparison = 0
  if (typeof leftValue === 'number' && typeof rightValue === 'number') comparison = leftValue - rightValue
  else if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') comparison = Number(leftValue) - Number(rightValue)
  else comparison = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' })
  return direction === 'desc' ? -comparison : comparison
}

function textValue(row: DatabaseRow, column: DatabaseColumn) {
  const value = row.values[column.id]
  return value == null ? '' : String(value)
}

function searchTextValue(row: DatabaseRow, column: DatabaseColumn) {
  const value = row.values[column.id]
  if (value === undefined || value === null || value === '') return ''
  if (column.type === 'checkbox') return ''
  if (column.type === 'select' || column.type === 'status') return optionLabel(column, value)
  if (column.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  return String(value)
}

export function rowMatchesDatabaseSearch(row: DatabaseRow, columns: DatabaseColumn[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  return columns.some((column) => (
    searchTextValue(row, column).toLocaleLowerCase().includes(normalizedQuery)
  ))
}

function filterMatches(row: DatabaseRow, column: DatabaseColumn, filter: DatabaseFilter) {
  const empty = cellIsEmpty(row, column)
  if (filter.operator === 'isEmpty') return empty
  if (filter.operator === 'isNotEmpty') return !empty
  if (filter.operator === 'isChecked') return row.values[column.id] === true
  if (filter.operator === 'isUnchecked') return row.values[column.id] !== true
  if (empty) return false

  if (column.type === 'number') {
    const value = row.values[column.id]
    const filterValue = filter.value
    if (typeof value !== 'number' || typeof filterValue !== 'number') return false
    if (filter.operator === 'equals') return value === filterValue
    if (filter.operator === 'notEquals') return value !== filterValue
    if (filter.operator === 'greaterThan') return value > filterValue
    if (filter.operator === 'greaterThanOrEqual') return value >= filterValue
    if (filter.operator === 'lessThan') return value < filterValue
    if (filter.operator === 'lessThanOrEqual') return value <= filterValue
    return false
  }

  if (column.type === 'select' || column.type === 'status') {
    const value = row.values[column.id]
    if (typeof value !== 'string' || typeof filter.value !== 'string') return false
    if (filter.operator === 'is') return value === filter.value
    if (filter.operator === 'isNot') return value !== filter.value
    return false
  }

  if (column.type === 'date') {
    const value = row.values[column.id]
    if (typeof value !== 'string' || typeof filter.value !== 'string') return false
    if (filter.operator === 'is') return value === filter.value
    if (filter.operator === 'isBefore') return value < filter.value
    if (filter.operator === 'isAfter') return value > filter.value
    return false
  }

  const value = textValue(row, column).toLocaleLowerCase()
  const filterValue = String(filter.value ?? '').toLocaleLowerCase()
  if (filter.operator === 'contains') return value.includes(filterValue)
  if (filter.operator === 'doesNotContain') return !value.includes(filterValue)
  if (filter.operator === 'is') return value === filterValue
  if (filter.operator === 'isNot') return value !== filterValue
  return false
}

export function getDatabaseVisibleRows(database: DatabaseAttrs, searchQuery = ''): DatabaseRow[] {
  const normalized = normalizeDatabaseAttrs(database)
  const columnById = new Map(normalized.columns.map((column) => [column.id, column]))
  const searched = searchQuery.trim()
    ? normalized.rows.filter((row) => rowMatchesDatabaseSearch(row, normalized.columns, searchQuery))
    : normalized.rows
  const filters = normalized.viewState?.filters ?? []
  const filtered = filters.length
    ? searched.filter((row) => filters.every((filter) => {
      const column = columnById.get(filter.columnId)
      return column ? filterMatches(row, column, filter) : true
    }))
    : searched
  const sort = normalized.viewState?.sort
  const sortColumn = sort ? columnById.get(sort.columnId) : undefined
  if (!sort || !sortColumn) return filtered
  return [...filtered].sort((left, right) => compareRows(left, right, sortColumn, sort.direction))
}

export function cloneDatabaseAttrs(database: unknown): DatabaseAttrs {
  const normalized = normalizeDatabaseAttrs(database)
  const columnIds = new Map<string, string>()
  const optionIds = new Map<string, string>()
  const columns = normalized.columns.map((column) => {
    const nextColumnId = prefixedId('col')
    columnIds.set(column.id, nextColumnId)
    if (column.type !== 'status' && column.type !== 'select') return { ...column, id: nextColumnId }
    const options = (column.options ?? []).map((option) => {
      const nextOptionId = prefixedId('opt')
      optionIds.set(option.id, nextOptionId)
      return { ...option, id: nextOptionId }
    })
    return { ...column, id: nextColumnId, options }
  })
  const rows = normalized.rows.map((row) => {
    const values: DatabaseRow['values'] = {}
    for (const [columnId, value] of Object.entries(row.values)) {
      const nextColumnId = columnIds.get(columnId)
      if (!nextColumnId) continue
      values[nextColumnId] = typeof value === 'string' && optionIds.has(value) ? optionIds.get(value)! : value
    }
    return { id: prefixedId('row'), values }
  })
  const sort = normalized.viewState?.sort
  const filters = normalized.viewState?.filters?.flatMap((filter): DatabaseFilter[] => {
    const columnId = columnIds.get(filter.columnId)
    if (!columnId) return []
    return [{
      ...filter,
      id: prefixedId('filter'),
      columnId,
      value: typeof filter.value === 'string' && optionIds.has(filter.value) ? optionIds.get(filter.value)! : filter.value,
    }]
  })
  const viewState: DatabaseViewState | undefined = sort || filters?.length
    ? {
      ...(sort && columnIds.has(sort.columnId) ? { sort: { ...sort, columnId: columnIds.get(sort.columnId)! } } : {}),
      ...(filters?.length ? { filters } : {}),
    }
    : undefined
  return withOptionalViewState({ ...normalized, id: prefixedId('db'), columns, rows }, viewState)
}
