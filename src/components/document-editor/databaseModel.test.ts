import { describe, expect, it } from 'vitest'

import {
  addDatabaseFilter,
  addDatabaseColumn,
  addDatabaseOption,
  addDatabaseRow,
  clearDatabaseSort,
  cloneDatabaseAttrs,
  createDefaultDatabase,
  deleteDatabaseColumn,
  deleteDatabaseFilter,
  deleteDatabaseOption,
  deleteDatabaseRow,
  getDatabaseVisibleRows,
  moveDatabaseColumn,
  moveDatabaseRow,
  normalizeDatabaseAttrs,
  renameDatabaseColumn,
  renameDatabaseOption,
  rowMatchesDatabaseSearch,
  setDatabaseSort,
  updateDatabaseFilter,
  updateDatabaseOptionColor,
  updateDatabaseCell,
} from './databaseModel'
import { DatabaseBlock } from './extensions/DatabaseBlock'

function createViewTestDatabase() {
  const database = normalizeDatabaseAttrs({
    version: 1,
    id: 'db_view',
    title: 'View',
    columns: [
      { id: 'col_name', name: 'Name', type: 'text' },
      { id: 'col_number', name: 'Estimate', type: 'number' },
      {
        id: 'col_select',
        name: 'Priority',
        type: 'select',
        options: [
          { id: 'opt_high', label: 'High', color: 'red' },
          { id: 'opt_medium', label: 'Medium', color: 'yellow' },
          { id: 'opt_low', label: 'Low', color: 'green' },
        ],
      },
      {
        id: 'col_status',
        name: 'Status',
        type: 'status',
        options: [
          { id: 'opt_todo', label: 'Not started', color: 'gray' },
          { id: 'opt_review', label: 'Review', color: 'purple' },
          { id: 'opt_done', label: 'Done', color: 'green' },
        ],
      },
      { id: 'col_date', name: 'Due', type: 'date' },
      { id: 'col_done', name: 'Done', type: 'checkbox' },
    ],
    rows: [
      { id: 'row_homepage', values: { col_name: 'Homepage', col_number: 3, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-10', col_done: true } },
      { id: 'row_qa', values: { col_name: 'QA', col_number: 1, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20', col_done: false } },
      { id: 'row_mobile', values: { col_name: 'Mobile', col_number: 2, col_select: 'opt_medium', col_status: 'opt_todo', col_date: '2026-09-15' } },
      { id: 'row_empty', values: { col_name: '' } },
    ],
  })
  return database
}

describe('database block model', () => {
  it('declares view state as a Tiptap node attribute for editor persistence', () => {
    const attrs = DatabaseBlock.config.addAttributes?.call({
      name: 'databaseBlock',
      options: {},
      storage: {},
      parent: undefined,
    })

    expect(attrs).toMatchObject({
      version: { default: 1 },
      id: { default: null },
      title: { default: 'Untitled database' },
      columns: { default: null },
      rows: { default: null },
      viewState: { default: null },
    })
  })

  it('creates the default database with stable ids, default columns, and status options', () => {
    const database = createDefaultDatabase()

    expect(database).toMatchObject({ version: 1, title: 'Untitled database' })
    expect(database.id).toMatch(/^db_/)
    expect(database.columns).toHaveLength(2)
    expect(database.columns[0]).toMatchObject({ name: 'Name', type: 'text' })
    expect(database.columns[0]?.id).toMatch(/^col_/)
    expect(database.columns[1]).toMatchObject({ name: 'Status', type: 'status' })
    expect(database.columns[1]?.options?.map((option) => option.label)).toEqual(['Not started', 'In progress', 'Done'])
    expect(database.columns[1]?.options?.every((option) => option.id.startsWith('opt_'))).toBe(true)
    expect(database.rows).toHaveLength(1)
    expect(database.rows[0]).toMatchObject({ values: {} })
    expect(database.rows[0]?.id).toMatch(/^row_/)
  })

  it('adds and deletes rows without changing existing row ids', () => {
    const database = createDefaultDatabase()
    const firstRowId = database.rows[0]!.id
    const withRow = addDatabaseRow(database)

    expect(withRow.rows.map((row) => row.id)).toHaveLength(2)
    expect(withRow.rows[0]?.id).toBe(firstRowId)
    expect(withRow.rows[1]?.id).toMatch(/^row_/)

    const withoutFirst = deleteDatabaseRow(withRow, firstRowId)
    expect(withoutFirst.rows).toHaveLength(1)
    expect(withoutFirst.rows[0]?.id).toBe(withRow.rows[1]?.id)
  })

  it('adds supported property types with unique names', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'text')
    database = addDatabaseColumn(database, 'text')
    database = addDatabaseColumn(database, 'number')
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'status')
    database = addDatabaseColumn(database, 'date')
    database = addDatabaseColumn(database, 'checkbox')

    expect(database.columns.map((column) => [column.name, column.type])).toEqual([
      ['Name', 'text'],
      ['Status', 'status'],
      ['Text', 'text'],
      ['Text 2', 'text'],
      ['Number', 'number'],
      ['Select', 'select'],
      ['Status 2', 'status'],
      ['Date', 'date'],
      ['Checkbox', 'checkbox'],
    ])
    expect(database.columns.find((column) => column.type === 'select')?.options?.map((option) => option.label)).toEqual(['Option 1', 'Option 2', 'Option 3'])
  })

  it('renames the primary property but does not delete it', () => {
    const database = createDefaultDatabase()
    const primaryId = database.columns[0]!.id
    const renamed = renameDatabaseColumn(database, primaryId, 'Task')
    const afterDeleteAttempt = deleteDatabaseColumn(renamed, primaryId)

    expect(renamed.columns[0]).toMatchObject({ id: primaryId, name: 'Task', type: 'text' })
    expect(afterDeleteAttempt.columns[0]).toMatchObject({ id: primaryId, name: 'Task', type: 'text' })
    expect(afterDeleteAttempt.columns).toHaveLength(2)
  })

  it('deletes non-primary properties and removes their row values', () => {
    let database = createDefaultDatabase()
    const statusId = database.columns[1]!.id
    const doneId = database.columns[1]!.options![2]!.id
    const rowId = database.rows[0]!.id

    database = updateDatabaseCell(database, rowId, statusId, doneId)
    expect(database.rows[0]?.values[statusId]).toBe(doneId)

    database = deleteDatabaseColumn(database, statusId)
    expect(database.columns).toHaveLength(1)
    expect(database.rows[0]?.values[statusId]).toBeUndefined()
  })

  it('updates text, number, select, status, date, and checkbox values', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'number')
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'date')
    database = addDatabaseColumn(database, 'checkbox')
    const rowId = database.rows[0]!.id
    const nameId = database.columns[0]!.id
    const status = database.columns[1]!
    const numberId = database.columns[2]!.id
    const select = database.columns[3]!
    const dateId = database.columns[4]!.id
    const checkboxId = database.columns[5]!.id
    const doneId = status.options![2]!.id
    const selectId = select.options![1]!.id

    database = updateDatabaseCell(database, rowId, nameId, 'Homepage')
    database = updateDatabaseCell(database, rowId, numberId, -12.5)
    database = updateDatabaseCell(database, rowId, select.id, selectId)
    database = updateDatabaseCell(database, rowId, status.id, doneId)
    database = updateDatabaseCell(database, rowId, dateId, '2026-09-04')
    database = updateDatabaseCell(database, rowId, checkboxId, true)

    expect(database.rows[0]?.values).toEqual({
      [nameId]: 'Homepage',
      [numberId]: -12.5,
      [select.id]: selectId,
      [status.id]: doneId,
      [dateId]: '2026-09-04',
      [checkboxId]: true,
    })
  })

  it('normalizes number and date values safely', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'number')
    database = addDatabaseColumn(database, 'date')
    database = addDatabaseRow(database)
    const numberId = database.columns[2]!.id
    const dateId = database.columns[3]!.id
    const firstRowId = database.rows[0]!.id
    const secondRowId = database.rows[1]!.id

    database = updateDatabaseCell(database, firstRowId, numberId, '42.75')
    database = updateDatabaseCell(database, firstRowId, dateId, '2026-09-04')
    database = updateDatabaseCell(database, secondRowId, numberId, 'not a number')
    database = updateDatabaseCell(database, secondRowId, dateId, '2026-99-99')

    expect(database.rows[0]?.values[numberId]).toBe(42.75)
    expect(database.rows[0]?.values[dateId]).toBe('2026-09-04')
    expect(database.rows[1]?.values[numberId]).toBeUndefined()
    expect(database.rows[1]?.values[dateId]).toBeUndefined()
  })

  it('normalizes malformed attrs without throwing', () => {
    const database = normalizeDatabaseAttrs({
      id: '',
      title: '',
      columns: [
        { id: 'broken', name: 'Broken', type: 'mystery' },
        { id: 'col_status', name: '', type: 'status', options: [{ id: 'opt_a', label: '', color: 'purple' }] },
        { id: 'col_select', name: 'Select', type: 'select', options: [{ id: 'opt_select', label: 'Chosen', color: 'yellow' }] },
        { id: 'col_number', name: 'Number', type: 'number' },
        { id: 'col_date', name: 'Date', type: 'date' },
      ],
      rows: [
        { id: 'row_1', values: { col_status: 'missing', col_select: 'opt_select', col_number: '12.5', col_date: '2026-09-04', unknown: 'value' } },
        { values: { col_status: 'opt_a' } },
      ],
    })

    expect(database.id).toMatch(/^db_/)
    expect(database.title).toBe('Untitled database')
    expect(database.columns[0]).toMatchObject({ name: 'Name', type: 'text' })
    expect(database.columns[1]).toMatchObject({ id: 'col_status', name: 'Property', type: 'status' })
    expect(database.columns[1]?.options).toEqual([{ id: 'opt_a', label: 'Option', color: 'purple' }])
    expect(database.columns[2]).toMatchObject({ id: 'col_select', name: 'Select', type: 'select' })
    expect(database.columns[2]?.options).toEqual([{ id: 'opt_select', label: 'Chosen', color: 'yellow' }])
    expect(database.rows).toEqual([{ id: 'row_1', values: { col_select: 'opt_select', col_number: 12.5, col_date: '2026-09-04' } }])
  })

  it('deletes number, date, and select properties and removes their row values', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'number')
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'date')
    const rowId = database.rows[0]!.id
    const numberId = database.columns[2]!.id
    const select = database.columns[3]!
    const dateId = database.columns[4]!.id

    database = updateDatabaseCell(database, rowId, numberId, 7)
    database = updateDatabaseCell(database, rowId, select.id, select.options![0]!.id)
    database = updateDatabaseCell(database, rowId, dateId, '2026-09-04')
    database = deleteDatabaseColumn(database, numberId)
    database = deleteDatabaseColumn(database, select.id)
    database = deleteDatabaseColumn(database, dateId)

    expect(database.columns.map((column) => column.type)).toEqual(['text', 'status'])
    expect(database.rows[0]?.values[numberId]).toBeUndefined()
    expect(database.rows[0]?.values[select.id]).toBeUndefined()
    expect(database.rows[0]?.values[dateId]).toBeUndefined()
  })

  it('manages select options without changing option identity on rename', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'select')
    const select = database.columns.find((column) => column.type === 'select')!
    const firstOptionId = select.options![0]!.id

    database = renameDatabaseOption(database, select.id, firstOptionId, '  Urgent  ')
    database = updateDatabaseOptionColor(database, select.id, firstOptionId, 'red')
    database = addDatabaseOption(database, select.id)

    const updatedSelect = database.columns.find((column) => column.id === select.id)!
    expect(updatedSelect.options?.[0]).toEqual({ id: firstOptionId, label: 'Urgent', color: 'red' })
    expect(updatedSelect.options?.at(-1)?.id).toMatch(/^opt_/)
    expect(updatedSelect.options?.at(-1)?.label).toBe('Option')
  })

  it('allows duplicate option labels because ids define identity', () => {
    let database = createDefaultDatabase()
    const status = database.columns[1]!
    const firstOptionId = status.options![0]!.id
    const secondOptionId = status.options![1]!.id

    database = renameDatabaseOption(database, status.id, firstOptionId, 'Same')
    database = renameDatabaseOption(database, status.id, secondOptionId, 'Same')

    const labels = database.columns[1]?.options?.map((option) => option.label)
    expect(labels?.slice(0, 2)).toEqual(['Same', 'Same'])
  })

  it('deletes selected select options and clears row values', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'select')
    const select = database.columns.find((column) => column.type === 'select')!
    const rowId = database.rows[0]!.id
    const selectedOptionId = select.options![1]!.id

    database = updateDatabaseCell(database, rowId, select.id, selectedOptionId)
    database = deleteDatabaseOption(database, select.id, selectedOptionId)

    const updatedSelect = database.columns.find((column) => column.id === select.id)!
    expect(updatedSelect.options?.some((option) => option.id === selectedOptionId)).toBe(false)
    expect(database.rows[0]?.values[select.id]).toBeUndefined()
  })

  it('manages status options and clears selected row values on delete', () => {
    let database = createDefaultDatabase()
    const status = database.columns[1]!
    const rowId = database.rows[0]!.id
    const selectedOptionId = status.options![2]!.id

    database = renameDatabaseOption(database, status.id, selectedOptionId, 'Review')
    database = addDatabaseOption(database, status.id)
    database = updateDatabaseCell(database, rowId, status.id, selectedOptionId)
    database = deleteDatabaseOption(database, status.id, selectedOptionId)

    const updatedStatus = database.columns[1]!
    expect(updatedStatus.options?.map((option) => option.label)).toContain('Option')
    expect(updatedStatus.options?.some((option) => option.id === selectedOptionId)).toBe(false)
    expect(database.rows[0]?.values[status.id]).toBeUndefined()
  })

  it('supports zero-option select and status properties', () => {
    const database = normalizeDatabaseAttrs({
      version: 1,
      id: 'db_zero',
      title: 'Zero options',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_status', name: 'Status', type: 'status', options: [] },
        { id: 'col_select', name: 'Select', type: 'select', options: [] },
      ],
      rows: [{ id: 'row_1', values: { col_status: 'missing', col_select: 'missing' } }],
    })

    expect(database.columns[1]?.options).toEqual([])
    expect(database.columns[2]?.options).toEqual([])
    expect(database.rows[0]?.values).toEqual({})
  })

  it('normalizes duplicate option ids and invalid colors', () => {
    const database = normalizeDatabaseAttrs({
      version: 1,
      id: 'db_options',
      title: 'Options',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        {
          id: 'col_status',
          name: 'Status',
          type: 'status',
          options: [
            { id: 'opt_same', label: 'First', color: 'cyan' },
            { id: 'opt_same', label: 'Second', color: 'red' },
            { label: 'Missing id', color: 'green' },
          ],
        },
      ],
      rows: [{ id: 'row_1', values: { col_status: 'opt_same' } }],
    })

    expect(database.columns[1]?.options).toEqual([{ id: 'opt_same', label: 'First', color: 'gray' }])
    expect(database.rows[0]?.values).toEqual({ col_status: 'opt_same' })
  })

  it('moves rows up and down while preserving ids and values', () => {
    let database = createDefaultDatabase()
    const nameId = database.columns[0]!.id
    database = addDatabaseRow(database)
    database = addDatabaseRow(database)
    const [first, second, third] = database.rows
    database = updateDatabaseCell(database, first!.id, nameId, 'Homepage')
    database = updateDatabaseCell(database, second!.id, nameId, 'Mobile')
    database = updateDatabaseCell(database, third!.id, nameId, 'QA')

    database = moveDatabaseRow(database, third!.id, 'up')
    expect(database.rows.map((row) => row.id)).toEqual([first!.id, third!.id, second!.id])
    expect(database.rows.map((row) => row.values[nameId])).toEqual(['Homepage', 'QA', 'Mobile'])

    database = moveDatabaseRow(database, first!.id, 'down')
    expect(database.rows.map((row) => row.id)).toEqual([third!.id, first!.id, second!.id])
    expect(database.rows.map((row) => row.values[nameId])).toEqual(['QA', 'Homepage', 'Mobile'])
  })

  it('treats invalid row moves and row boundaries as safe no-ops', () => {
    let database = createDefaultDatabase()
    database = addDatabaseRow(database)
    const originalOrder = database.rows.map((row) => row.id)

    expect(moveDatabaseRow(database, originalOrder[0]!, 'up').rows.map((row) => row.id)).toEqual(originalOrder)
    expect(moveDatabaseRow(database, originalOrder[1]!, 'down').rows.map((row) => row.id)).toEqual(originalOrder)
    expect(moveDatabaseRow(database, 'missing', 'up').rows.map((row) => row.id)).toEqual(originalOrder)
    expect(moveDatabaseRow({ ...database, rows: [] }, 'missing', 'down').rows).toEqual([])
    expect(moveDatabaseRow({ ...database, rows: [database.rows[0]!] }, database.rows[0]!.id, 'down').rows.map((row) => row.id)).toEqual([database.rows[0]!.id])
  })

  it('moves non-primary columns without changing ids, options, or row values', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'date')
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'checkbox')
    const rowId = database.rows[0]!.id
    const nameId = database.columns[0]!.id
    const status = database.columns[1]!
    const dateId = database.columns[2]!.id
    const select = database.columns[3]!
    const checkboxId = database.columns[4]!.id
    const doneId = status.options![2]!.id
    const selectedId = select.options![1]!.id
    database = updateDatabaseCell(database, rowId, nameId, 'Homepage')
    database = updateDatabaseCell(database, rowId, status.id, doneId)
    database = updateDatabaseCell(database, rowId, dateId, '2026-09-04')
    database = updateDatabaseCell(database, rowId, select.id, selectedId)
    database = updateDatabaseCell(database, rowId, checkboxId, true)

    database = moveDatabaseColumn(database, checkboxId, 'left')
    database = moveDatabaseColumn(database, checkboxId, 'left')

    expect(database.columns.map((column) => column.id)).toEqual([nameId, status.id, checkboxId, dateId, select.id])
    expect(database.columns.find((column) => column.id === select.id)?.options).toEqual(select.options)
    expect(database.rows[0]?.values).toEqual({
      [nameId]: 'Homepage',
      [status.id]: doneId,
      [dateId]: '2026-09-04',
      [select.id]: selectedId,
      [checkboxId]: true,
    })
  })

  it('keeps the primary column first and treats invalid column moves as safe no-ops', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'date')
    const [primary, status, date] = database.columns
    const originalOrder = database.columns.map((column) => column.id)

    expect(moveDatabaseColumn(database, primary!.id, 'right').columns.map((column) => column.id)).toEqual(originalOrder)
    expect(moveDatabaseColumn(database, status!.id, 'left').columns.map((column) => column.id)).toEqual(originalOrder)
    expect(moveDatabaseColumn(database, date!.id, 'right').columns.map((column) => column.id)).toEqual(originalOrder)
    expect(moveDatabaseColumn(database, 'missing', 'left').columns.map((column) => column.id)).toEqual(originalOrder)
  })

  it('sorts text, number, date, checkbox, select, and status values without mutating base rows', () => {
    const base = createViewTestDatabase()
    const baseOrder = base.rows.map((row) => row.id)

    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_name', 'asc')).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_qa', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_name', 'desc')).map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_homepage', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_number', 'asc')).map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_homepage', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_number', 'desc')).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_qa', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_date', 'asc')).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_qa', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_done', 'asc')).map((row) => row.id)).toEqual(['row_qa', 'row_homepage', 'row_mobile', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_select', 'asc')).map((row) => row.id)).toEqual(['row_homepage', 'row_qa', 'row_mobile', 'row_empty'])
    expect(getDatabaseVisibleRows(setDatabaseSort(base, 'col_status', 'asc')).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_qa', 'row_empty'])
    expect(base.rows.map((row) => row.id)).toEqual(baseOrder)
  })

  it('keeps empty values last for ascending and descending sorts', () => {
    const database = createViewTestDatabase()

    expect(getDatabaseVisibleRows(setDatabaseSort(database, 'col_number', 'asc')).at(-1)?.id).toBe('row_empty')
    expect(getDatabaseVisibleRows(setDatabaseSort(database, 'col_number', 'desc')).at(-1)?.id).toBe('row_empty')
  })

  it('clears sort and restores manual row order', () => {
    const database = createViewTestDatabase()
    const sorted = setDatabaseSort(database, 'col_name', 'desc')
    const cleared = clearDatabaseSort(sorted)

    expect(getDatabaseVisibleRows(sorted).map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_homepage', 'row_empty'])
    expect(getDatabaseVisibleRows(cleared).map((row) => row.id)).toEqual(['row_homepage', 'row_qa', 'row_mobile', 'row_empty'])
    expect(cleared.viewState).toBeUndefined()
  })

  it('filters text values with contains, exact, empty, and not-empty operators', () => {
    const database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        filters: [
          { id: 'filter_contains', columnId: 'col_name', operator: 'contains', value: 'o' },
          { id: 'filter_not_exact', columnId: 'col_name', operator: 'isNot', value: 'Mobile' },
        ],
      },
    })

    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_empty', columnId: 'col_name', operator: 'isEmpty' }] } })).map((row) => row.id)).toEqual(['row_empty'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_not_empty', columnId: 'col_name', operator: 'isNotEmpty' }] } })).map((row) => row.id)).toEqual(['row_homepage', 'row_qa', 'row_mobile'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_does_not_contain', columnId: 'col_name', operator: 'doesNotContain', value: 'o' }] } })).map((row) => row.id)).toEqual(['row_qa'])
  })

  it('filters number values with comparison operators', () => {
    const database = createViewTestDatabase()

    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_eq', columnId: 'col_number', operator: 'equals', value: 2 }] } })).map((row) => row.id)).toEqual(['row_mobile'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_ne', columnId: 'col_number', operator: 'notEquals', value: 2 }] } })).map((row) => row.id)).toEqual(['row_homepage', 'row_qa'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_gt', columnId: 'col_number', operator: 'greaterThan', value: 1 }] } })).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_lte', columnId: 'col_number', operator: 'lessThanOrEqual', value: 2 }] } })).map((row) => row.id)).toEqual(['row_qa', 'row_mobile'])
  })

  it('filters select and status by option id so label renames keep filters working', () => {
    let database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        filters: [
          { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
          { id: 'filter_status', columnId: 'col_status', operator: 'isNot', value: 'opt_review' },
        ],
      },
    })

    database = renameDatabaseOption(database, 'col_select', 'opt_high', 'Urgent')

    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_homepage'])
    expect(database.viewState?.filters?.[0]?.value).toBe('opt_high')
  })

  it('filters date and checkbox values', () => {
    const database = createViewTestDatabase()

    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_date', columnId: 'col_date', operator: 'isAfter', value: '2026-09-12' }] } })).map((row) => row.id)).toEqual(['row_qa', 'row_mobile'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_before', columnId: 'col_date', operator: 'isBefore', value: '2026-09-12' }] } })).map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_checked', columnId: 'col_done', operator: 'isChecked' }] } })).map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(normalizeDatabaseAttrs({ ...database, viewState: { filters: [{ id: 'filter_unchecked', columnId: 'col_done', operator: 'isUnchecked' }] } })).map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_empty'])
  })

  it('combines multiple filters with AND behavior and removes individual filters', () => {
    let database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        filters: [
          { id: 'filter_text', columnId: 'col_name', operator: 'contains', value: 'o' },
          { id: 'filter_number', columnId: 'col_number', operator: 'lessThan', value: 3 },
        ],
      },
    })

    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_mobile'])
    database = deleteDatabaseFilter(database, 'filter_number')
    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile'])
  })

  it('adds and updates filters with stable ids', () => {
    let database = addDatabaseFilter(createViewTestDatabase(), 'col_name')
    const filterId = database.viewState?.filters?.[0]?.id
    expect(filterId).toMatch(/^filter_/)

    database = updateDatabaseFilter(database, filterId!, { operator: 'contains', value: 'QA' })
    expect(database.viewState?.filters?.[0]).toEqual({ id: filterId, columnId: 'col_name', operator: 'contains', value: 'QA' })
    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_qa'])
  })

  it('normalizes invalid sort and filter view state safely', () => {
    const database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        sort: { columnId: 'missing', direction: 'sideways' },
        filters: [
          { id: 'filter_valid', columnId: 'col_number', operator: 'greaterThan', value: 1 },
          { id: 'filter_duplicate', columnId: 'col_name', operator: 'contains', value: 'a' },
          { id: 'filter_duplicate', columnId: 'col_name', operator: 'contains', value: 'b' },
          { id: 'filter_bad_operator', columnId: 'col_number', operator: 'contains', value: 'bad' },
          { id: 'filter_bad_value', columnId: 'col_select', operator: 'is', value: 'missing' },
        ],
      },
    })

    expect(database.viewState).toEqual({
      filters: [
        { id: 'filter_valid', columnId: 'col_number', operator: 'greaterThan', value: 1 },
        { id: 'filter_duplicate', columnId: 'col_name', operator: 'contains', value: 'a' },
      ],
    })
  })

  it('cleans sort and filter references when deleting columns or options', () => {
    let database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        sort: { columnId: 'col_select', direction: 'asc' },
        filters: [
          { id: 'filter_select', columnId: 'col_select', operator: 'is', value: 'opt_high' },
          { id: 'filter_status', columnId: 'col_status', operator: 'is', value: 'opt_review' },
          { id: 'filter_name', columnId: 'col_name', operator: 'isNotEmpty' },
        ],
      },
    })

    database = deleteDatabaseOption(database, 'col_status', 'opt_review')
    expect(database.viewState?.filters?.map((filter) => filter.id)).toEqual(['filter_select', 'filter_name'])
    database = deleteDatabaseColumn(database, 'col_select')
    expect(database.viewState).toEqual({ filters: [{ id: 'filter_name', columnId: 'col_name', operator: 'isNotEmpty' }] })
  })

  it('clones database ids and remaps row values for safe duplication', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'number')
    database = addDatabaseColumn(database, 'date')
    const rowId = database.rows[0]!.id
    const nameId = database.columns[0]!.id
    const statusId = database.columns[1]!.id
    const selectId = database.columns[2]!.id
    const numberId = database.columns[3]!.id
    const dateId = database.columns[4]!.id
    const doneId = database.columns[1]!.options![2]!.id
    const selectedId = database.columns[2]!.options![1]!.id
    database = updateDatabaseCell(database, rowId, nameId, 'Homepage')
    database = updateDatabaseCell(database, rowId, statusId, doneId)
    database = updateDatabaseCell(database, rowId, selectId, selectedId)
    database = updateDatabaseCell(database, rowId, numberId, -5)
    database = updateDatabaseCell(database, rowId, dateId, '2026-09-04')

    const cloned = cloneDatabaseAttrs(database)
    const clonedNameId = cloned.columns[0]!.id
    const clonedStatusId = cloned.columns[1]!.id
    const clonedSelectId = cloned.columns[2]!.id
    const clonedNumberId = cloned.columns[3]!.id
    const clonedDateId = cloned.columns[4]!.id
    const clonedDoneId = cloned.columns[1]!.options![2]!.id
    const clonedSelectedId = cloned.columns[2]!.options![1]!.id

    expect(cloned.id).not.toBe(database.id)
    expect(cloned.rows[0]?.id).not.toBe(rowId)
    expect(clonedNameId).not.toBe(nameId)
    expect(clonedStatusId).not.toBe(statusId)
    expect(clonedSelectId).not.toBe(selectId)
    expect(clonedDoneId).not.toBe(doneId)
    expect(clonedSelectedId).not.toBe(selectedId)
    expect(cloned.rows[0]?.values).toEqual({
      [clonedNameId]: 'Homepage',
      [clonedStatusId]: clonedDoneId,
      [clonedSelectId]: clonedSelectedId,
      [clonedNumberId]: -5,
      [clonedDateId]: '2026-09-04',
    })
  })

  it('preserves custom row and column order during safe duplication', () => {
    let database = createDefaultDatabase()
    database = addDatabaseColumn(database, 'date')
    database = addDatabaseColumn(database, 'select')
    database = addDatabaseColumn(database, 'checkbox')
    database = addDatabaseRow(database)
    database = addDatabaseRow(database)
    const nameId = database.columns[0]!.id
    const statusId = database.columns[1]!.id
    const dateId = database.columns[2]!.id
    const selectId = database.columns[3]!.id
    const checkboxId = database.columns[4]!.id
    const firstRowId = database.rows[0]!.id
    const secondRowId = database.rows[1]!.id
    const thirdRowId = database.rows[2]!.id
    database = updateDatabaseCell(database, firstRowId, nameId, 'Homepage')
    database = updateDatabaseCell(database, secondRowId, nameId, 'Mobile')
    database = updateDatabaseCell(database, thirdRowId, nameId, 'QA')
    database = moveDatabaseRow(database, thirdRowId, 'up')
    database = moveDatabaseRow(database, thirdRowId, 'up')
    database = moveDatabaseColumn(database, checkboxId, 'left')
    database = moveDatabaseColumn(database, checkboxId, 'left')

    const cloned = cloneDatabaseAttrs(database)

    expect(database.rows.map((row) => row.values[nameId])).toEqual(['QA', 'Homepage', 'Mobile'])
    expect(database.columns.map((column) => column.id)).toEqual([nameId, statusId, checkboxId, dateId, selectId])
    expect(cloned.rows.map((row) => row.values[cloned.columns[0]!.id])).toEqual(['QA', 'Homepage', 'Mobile'])
    expect(cloned.columns.map((column) => column.type)).toEqual(['text', 'status', 'checkbox', 'date', 'select'])
    expect(cloned.columns.map((column) => column.id)).not.toEqual(database.columns.map((column) => column.id))
    expect(cloned.rows.map((row) => row.id)).not.toEqual(database.rows.map((row) => row.id))
  })

  it('remaps sort columns, filter columns, and filter option values during safe duplication', () => {
    const database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      viewState: {
        sort: { columnId: 'col_date', direction: 'desc' },
        filters: [
          { id: 'filter_select', columnId: 'col_select', operator: 'is', value: 'opt_high' },
          { id: 'filter_status', columnId: 'col_status', operator: 'isNot', value: 'opt_review' },
          { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
        ],
      },
    })

    const cloned = cloneDatabaseAttrs(database)
    const clonedDate = cloned.columns.find((column) => column.type === 'date')!
    const clonedSelect = cloned.columns.find((column) => column.type === 'select')!
    const clonedStatus = cloned.columns.find((column) => column.type === 'status')!
    const clonedCheckbox = cloned.columns.find((column) => column.type === 'checkbox')!

    expect(cloned.viewState?.sort).toEqual({ columnId: clonedDate.id, direction: 'desc' })
    expect(cloned.viewState?.filters?.map((filter) => filter.columnId)).toEqual([clonedSelect.id, clonedStatus.id, clonedCheckbox.id])
    expect(cloned.viewState?.filters?.[0]?.value).toBe(clonedSelect.options?.find((option) => option.label === 'High')?.id)
    expect(cloned.viewState?.filters?.[1]?.value).toBe(clonedStatus.options?.find((option) => option.label === 'Review')?.id)
    expect(cloned.viewState?.filters?.[0]?.id).toMatch(/^filter_/)
    expect(cloned.viewState?.filters?.[0]?.id).not.toBe('filter_select')
  })

  it('normalizes duplicate row and column ids without aliasing valid data', () => {
    const database = normalizeDatabaseAttrs({
      version: 1,
      id: 'db_duplicates',
      title: 'Duplicates',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_status', name: 'Status', type: 'status', options: [{ id: 'opt_done', label: 'Done', color: 'green' }] },
        { id: 'col_status', name: 'Duplicate status', type: 'status', options: [{ id: 'opt_other', label: 'Other', color: 'blue' }] },
      ],
      rows: [
        { id: 'row_same', values: { col_name: 'First', col_status: 'opt_done' } },
        { id: 'row_same', values: { col_name: 'Second', col_status: 'opt_done' } },
      ],
    })

    expect(new Set(database.columns.map((column) => column.id)).size).toBe(database.columns.length)
    expect(new Set(database.rows.map((row) => row.id)).size).toBe(database.rows.length)
    expect(database.columns[1]?.id).toBe('col_status')
    expect(database.columns[2]?.id).toMatch(/^col_/)
    expect(database.columns[2]?.id).not.toBe('col_status')
    expect(database.rows[0]?.id).toBe('row_same')
    expect(database.rows[1]?.id).toMatch(/^row_/)
    expect(database.rows.map((row) => row.values.col_name)).toEqual(['First', 'Second'])
  })

  it('keeps manual base order stable through filter, sort, edit, delete, and clear operations', () => {
    let database = createViewTestDatabase()
    database = moveDatabaseRow(database, 'row_qa', 'up')
    expect(database.rows.map((row) => row.id)).toEqual(['row_qa', 'row_homepage', 'row_mobile', 'row_empty'])

    database = normalizeDatabaseAttrs({
      ...setDatabaseSort(database, 'col_name', 'asc'),
      viewState: {
        sort: { columnId: 'col_name', direction: 'asc' },
        filters: [{ id: 'filter_not_empty', columnId: 'col_name', operator: 'isNotEmpty' }],
      },
    })
    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_qa'])

    database = updateDatabaseCell(database, 'row_mobile', 'col_name', 'Mobile updated')
    database = deleteDatabaseRow(database, 'row_homepage')
    database = clearDatabaseSort(database)
    database = deleteDatabaseFilter(database, 'filter_not_empty')

    expect(database.rows.map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_empty'])
    expect(database.rows.find((row) => row.id === 'row_mobile')?.values.col_name).toBe('Mobile updated')
    expect(getDatabaseVisibleRows(database).map((row) => row.id)).toEqual(['row_qa', 'row_mobile', 'row_empty'])
  })

  it('searches text values with trimmed, case-insensitive, and Unicode substring matching', () => {
    const database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      rows: [
        { id: 'row_homepage', values: { col_name: 'Homepage' } },
        { id: 'row_hindi', values: { col_name: 'नमस्ते योजना' } },
        { id: 'row_arabic', values: { col_name: 'مرحبا خطة' } },
        { id: 'row_emoji', values: { col_name: 'Launch 🚀' } },
      ],
    })

    expect(getDatabaseVisibleRows(database, 'home').map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(database, '  HOME  ').map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(database, 'नम').map((row) => row.id)).toEqual(['row_hindi'])
    expect(getDatabaseVisibleRows(database, 'مرح').map((row) => row.id)).toEqual(['row_arabic'])
    expect(getDatabaseVisibleRows(database, '🚀').map((row) => row.id)).toEqual(['row_emoji'])
    expect(getDatabaseVisibleRows(database, '').map((row) => row.id)).toEqual(['row_homepage', 'row_hindi', 'row_arabic', 'row_emoji'])
    expect(getDatabaseVisibleRows(database, '   ').map((row) => row.id)).toEqual(['row_homepage', 'row_hindi', 'row_arabic', 'row_emoji'])
  })

  it('searches number, date, select label, and status label values without matching option ids', () => {
    const database = createViewTestDatabase()

    expect(getDatabaseVisibleRows(database, '3').map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(database, '2026-09-15').map((row) => row.id)).toEqual(['row_mobile'])
    expect(getDatabaseVisibleRows(database, '2026-09').map((row) => row.id)).toEqual(['row_homepage', 'row_qa', 'row_mobile'])
    expect(getDatabaseVisibleRows(database, 'high').map((row) => row.id)).toEqual(['row_homepage'])
    expect(getDatabaseVisibleRows(database, 'review').map((row) => row.id)).toEqual(['row_qa'])
    expect(getDatabaseVisibleRows(database, 'opt_high')).toEqual([])
    expect(getDatabaseVisibleRows(database, 'col_select')).toEqual([])
  })

  it('does not search checkbox values in V1', () => {
    const database = normalizeDatabaseAttrs({
      version: 1,
      id: 'db_checkbox_search',
      title: 'Checkbox search',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_done', name: 'Done', type: 'checkbox' },
      ],
      rows: [
        { id: 'row_checked', values: { col_done: true } },
        { id: 'row_unchecked', values: { col_done: false } },
      ],
    })

    expect(getDatabaseVisibleRows(database, 'true')).toEqual([])
    expect(getDatabaseVisibleRows(database, 'false')).toEqual([])
    expect(getDatabaseVisibleRows(database, 'checked')).toEqual([])
  })

  it('uses current option labels for search after option rename or delete', () => {
    let database = createViewTestDatabase()

    database = renameDatabaseOption(database, 'col_status', 'opt_review', 'In progress')
    expect(getDatabaseVisibleRows(database, 'in progress').map((row) => row.id)).toEqual(['row_qa'])
    expect(getDatabaseVisibleRows(database, 'review')).toEqual([])

    database = deleteDatabaseOption(database, 'col_status', 'opt_review')
    expect(getDatabaseVisibleRows(database, 'in progress')).toEqual([])
    expect(database.rows.find((row) => row.id === 'row_qa')?.values.col_status).toBeUndefined()
  })

  it('combines search with filters and then applies active sort without mutating base order', () => {
    const base = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      rows: [
        { id: 'row_alpha', values: { col_name: 'Design alpha', col_number: 3, col_status: 'opt_todo', col_date: '2026-09-20' } },
        { id: 'row_beta', values: { col_name: 'Design beta', col_number: 1, col_status: 'opt_todo', col_date: '2026-09-10' } },
        { id: 'row_done', values: { col_name: 'Design done', col_number: 2, col_status: 'opt_done', col_date: '2026-09-15' } },
      ],
      viewState: {
        sort: { columnId: 'col_number', direction: 'asc' },
        filters: [{ id: 'filter_status', columnId: 'col_status', operator: 'is', value: 'opt_todo' }],
      },
    })
    const baseOrder = base.rows.map((row) => row.id)

    expect(getDatabaseVisibleRows(base, 'design').map((row) => row.id)).toEqual(['row_beta', 'row_alpha'])
    expect(base.rows.map((row) => row.id)).toEqual(baseOrder)
    expect(getDatabaseVisibleRows(clearDatabaseSort(base), 'design').map((row) => row.id)).toEqual(['row_alpha', 'row_beta'])
  })

  it('keeps row identity stable when editing or deleting searched rows', () => {
    let database = createViewTestDatabase()
    const searched = getDatabaseVisibleRows(database, 'mobile')

    expect(searched.map((row) => row.id)).toEqual(['row_mobile'])
    database = updateDatabaseCell(database, searched[0]!.id, 'col_name', 'Mobile updated')
    expect(database.rows.find((row) => row.id === 'row_mobile')?.values.col_name).toBe('Mobile updated')
    expect(getDatabaseVisibleRows(database, '').map((row) => row.values.col_name)).toEqual(['Homepage', 'QA', 'Mobile updated', ''])

    const deleteTarget = getDatabaseVisibleRows(database, 'qa')[0]!
    database = deleteDatabaseRow(database, deleteTarget.id)
    expect(database.rows.map((row) => row.id)).toEqual(['row_homepage', 'row_mobile', 'row_empty'])
  })

  it('reports whether individual rows match a database search query', () => {
    const database = createViewTestDatabase()

    expect(rowMatchesDatabaseSearch(database.rows[0]!, database.columns, 'done')).toBe(true)
    expect(rowMatchesDatabaseSearch(database.rows[0]!, database.columns, 'opt_done')).toBe(false)
    expect(rowMatchesDatabaseSearch(database.rows[0]!, database.columns, '   ')).toBe(true)
  })

  it('clones a complex database repeatedly without sharing internal ids or breaking references', () => {
    let database = normalizeDatabaseAttrs({
      ...createViewTestDatabase(),
      rows: createViewTestDatabase().rows.slice(0, 3),
      viewState: {
        sort: { columnId: 'col_status', direction: 'asc' },
        filters: [
          { id: 'filter_priority', columnId: 'col_select', operator: 'isNot', value: 'opt_low' },
          { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
        ],
      },
    })
    database = renameDatabaseOption(database, 'col_select', 'opt_high', '🔥 Urgent')
    database = updateDatabaseOptionColor(database, 'col_select', 'opt_high', 'pink')
    database = moveDatabaseRow(database, 'row_mobile', 'up')
    database = moveDatabaseColumn(database, 'col_done', 'left')
    database = moveDatabaseColumn(database, 'col_done', 'left')

    const clones = [cloneDatabaseAttrs(database), cloneDatabaseAttrs(database), cloneDatabaseAttrs(database)]
    const originalIds = collectDatabaseIds(database)
    for (const cloned of clones) {
      const clonedIds = collectDatabaseIds(cloned)
      expect(clonedIds.size).toBe(originalIds.size)
      for (const id of clonedIds) expect(originalIds.has(id)).toBe(false)
      expect(cloned.columns.map((column) => column.type)).toEqual(database.columns.map((column) => column.type))
      expect(cloned.rows.map((row) => row.values[cloned.columns[0]!.id])).toEqual(['Homepage', 'Mobile', 'QA'])
      expect(cloned.viewState?.sort?.columnId).toBe(cloned.columns.find((column) => column.type === 'status')?.id)
      const clonedSelect = cloned.columns.find((column) => column.type === 'select')!
      expect(clonedSelect.options?.find((option) => option.label === '🔥 Urgent')?.color).toBe('pink')
      expect(cloned.viewState?.filters?.[0]?.value).toBe(clonedSelect.options?.find((option) => option.label === 'Low')?.id)
    }
  })

  it.each([100, 250, 500])('handles %i representative rows in model helpers', (rowCount) => {
    const database = createLargeDatabase(rowCount)
    const baseOrder = database.rows.map((row) => row.id)
    const sorted = setDatabaseSort(database, 'col_estimate', 'desc')
    const filtered = normalizeDatabaseAttrs({
      ...sorted,
      viewState: {
        sort: { columnId: 'col_estimate', direction: 'desc' },
        filters: [
          { id: 'filter_status', columnId: 'col_status', operator: 'isNot', value: 'opt_done' },
          { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
        ],
      },
    })
    const visible = getDatabaseVisibleRows(filtered)
    const cloned = cloneDatabaseAttrs(filtered)

    expect(database.rows.map((row) => row.id)).toEqual(baseOrder)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every((row) => row.values.col_status !== 'opt_done' && row.values.col_done !== true)).toBe(true)
    expect(cloned.rows).toHaveLength(rowCount)
    expect(new Set(cloned.rows.map((row) => row.id)).size).toBe(rowCount)
    expect(cloned.columns.map((column) => column.type)).toEqual(filtered.columns.map((column) => column.type))
    expect(cloned.viewState?.filters).toHaveLength(2)
  })

  it.each([100, 250, 500])('searches %i representative rows without mutating base order', (rowCount) => {
    const database = createLargeDatabase(rowCount)
    const baseOrder = database.rows.map((row) => row.id)
    const visible = getDatabaseVisibleRows(database, 'Task 4')

    expect(database.rows.map((row) => row.id)).toEqual(baseOrder)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every((row) => String(row.values.col_name).toLocaleLowerCase().includes('task 4'))).toBe(true)
  })
})

function collectDatabaseIds(database: ReturnType<typeof normalizeDatabaseAttrs>) {
  const ids = new Set<string>([database.id])
  for (const column of database.columns) {
    ids.add(column.id)
    column.options?.forEach((option) => ids.add(option.id))
  }
  database.rows.forEach((row) => ids.add(row.id))
  database.viewState?.filters?.forEach((filter) => ids.add(filter.id))
  return ids
}

function createLargeDatabase(rowCount: number) {
  return normalizeDatabaseAttrs({
    version: 1,
    id: `db_${rowCount}`,
    title: `${rowCount} rows`,
    columns: [
      { id: 'col_name', name: 'Name', type: 'text' },
      {
        id: 'col_priority',
        name: 'Priority',
        type: 'select',
        options: [
          { id: 'opt_high', label: 'High', color: 'red' },
          { id: 'opt_medium', label: 'Medium', color: 'yellow' },
          { id: 'opt_low', label: 'Low', color: 'green' },
        ],
      },
      {
        id: 'col_status',
        name: 'Status',
        type: 'status',
        options: [
          { id: 'opt_todo', label: 'Not started', color: 'gray' },
          { id: 'opt_progress', label: 'In progress', color: 'blue' },
          { id: 'opt_done', label: 'Done', color: 'green' },
        ],
      },
      { id: 'col_due', name: 'Due date', type: 'date' },
      { id: 'col_estimate', name: 'Estimate', type: 'number' },
      { id: 'col_done', name: 'Done', type: 'checkbox' },
    ],
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row_${index}`,
      values: {
        col_name: `Task ${index}`,
        col_priority: index % 3 === 0 ? 'opt_high' : index % 3 === 1 ? 'opt_medium' : 'opt_low',
        col_status: index % 5 === 0 ? 'opt_done' : index % 2 === 0 ? 'opt_progress' : 'opt_todo',
        col_due: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
        col_estimate: index - 250,
        col_done: index % 5 === 0,
      },
    })),
  })
}
