import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CellSelection, selectedRect, TableMap } from 'prosemirror-tables'

export type TableInteractionSelection = {
  axis: 'row' | 'column'
  index: number
  tablePos: number
} | null

export type TableInteractionDrag = {
  axis: 'row' | 'column'
  from: number
  isDragging: boolean
  tablePos: number
} | null

export interface TableInteractionMeta {
  selection: TableInteractionSelection
  drag: TableInteractionDrag
}

const tableInteractionKey = new PluginKey<TableInteractionMeta>('tableInteraction')

function cellDomClass(node: ProseMirrorNode, pos: number, state: EditorState, meta: TableInteractionMeta) {
  const classes: string[] = []
  const resolved = state.doc.resolve(pos)
  const selection = state.selection
  const isActiveCell = selection.$from.pos >= pos && selection.$from.pos < pos + node.nodeSize
  if (isActiveCell) classes.push('mybook-active-table-cell')

  let tableDepth = resolved.depth
  while (tableDepth > 0 && resolved.node(tableDepth).type.name !== 'table') tableDepth -= 1
  if (resolved.node(tableDepth).type.name !== 'table') return classes.join(' ')
  const table = resolved.node(tableDepth)
  const tablePos = resolved.start(tableDepth) - 1
  if (meta.selection?.tablePos !== tablePos && meta.drag?.tablePos !== tablePos) return classes.join(' ')
  const tableStart = resolved.start(tableDepth)
  const map = TableMap.get(table)
  const cellIndex = map.map.indexOf(pos - tableStart)
  if (cellIndex < 0) return classes.join(' ')
  const row = Math.floor(cellIndex / map.width)
  const column = cellIndex % map.width

  if (meta.selection?.axis === 'column' && meta.selection.index === column) classes.push('mybook-table-selected-column')
  if (meta.drag?.isDragging && meta.drag.axis === 'column' && meta.drag.from === column) classes.push('mybook-table-dragging-column')
  if (meta.selection?.axis === 'row' && meta.selection.index === row) classes.push('mybook-table-selected-row-cell')
  if (meta.drag?.isDragging && meta.drag.axis === 'row' && meta.drag.from === row) classes.push('mybook-table-dragging-row-cell')
  return classes.join(' ')
}

function decorationsFor(state: EditorState, meta: TableInteractionMeta) {
  const decorations: Decoration[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table' && node.attrs.fixedRowsEnabled) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {
        'data-fixed-rows': 'true',
        'data-fixed-row-count': String(node.attrs.fixedRowCount ?? 5),
      }))
      return
    }
    if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader') return
    const className = cellDomClass(node, pos, state, meta)
    if (className) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: className }))
  })
  return DecorationSet.create(state.doc, decorations)
}

function defaultMeta(): TableInteractionMeta {
  return { selection: null, drag: null }
}

export const TableInteraction = Extension.create({
  name: 'tableInteraction',

  addProseMirrorPlugins() {
    return [new Plugin<TableInteractionMeta>({
      key: tableInteractionKey,
      state: {
        init: () => defaultMeta(),
        apply: (transaction, value) => {
          const meta = transaction.getMeta(tableInteractionKey) as TableInteractionMeta | undefined
          return meta ?? value
        },
      },
      props: {
        decorations: (state) => decorationsFor(state, tableInteractionKey.getState(state) ?? defaultMeta()),
      },
    })]
  },
})

export function getTableInteractionState(state: EditorState) {
  return tableInteractionKey.getState(state) ?? defaultMeta()
}

export function setTableInteraction(editorState: EditorState, meta: TableInteractionMeta) {
  return editorState.tr.setMeta(tableInteractionKey, meta)
}

export function selectedTableInteraction(state: EditorState): TableInteractionSelection {
  if (!(state.selection instanceof CellSelection)) return null
  const rect = selectedRect(state)
  const table = state.doc.resolve(state.selection.$from.pos)
  let tableDepth = table.depth
  while (tableDepth > 0 && table.node(tableDepth).type.name !== 'table') tableDepth -= 1
  const tablePos = table.node(tableDepth).type.name === 'table' ? table.start(tableDepth) - 1 : 0
  if (rect.left === 0 && rect.right === rect.map.width) return { axis: 'row', index: rect.top, tablePos }
  if (rect.top === 0 && rect.bottom === rect.map.height) return { axis: 'column', index: rect.left, tablePos }
  return null
}
