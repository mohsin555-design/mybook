import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { slashCommands, type SlashCommand } from './slashCommands'

export interface BlockTarget {
  node: ProseMirrorNode
  pos: number
  rect: DOMRect
  controlRect: DOMRect
}

export interface ColumnContext {
  isInsideColumn: boolean
  columnIndex: number
  isFirstColumn: boolean
  columnPos: number
  prevColumnRight: number | null
}

export const insertBlockCommands: SlashCommand[] = slashCommands.filter(
  (command) => !command.id.startsWith('columns-'),
)

export function getColumnContext(editor: Editor, pos: number): ColumnContext | null {
  const { state, view } = editor
  const $pos = state.doc.resolve(Math.min(pos + 1, state.doc.content.size))
  let columnDepth = -1
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'column') {
      columnDepth = depth
      break
    }
  }
  if (columnDepth === -1) return null

  const parentColumns = columnDepth > 1 && $pos.node(columnDepth - 1).type.name === 'columns'
    ? $pos.node(columnDepth - 1)
    : null

  const colPos = $pos.before(columnDepth)
  let columnIndex = 0
  if (parentColumns) {
    const columnsPos = $pos.before(columnDepth - 1)
    let currentChildPos = columnsPos + 1
    for (let i = 0; i < parentColumns.childCount; i += 1) {
      if (currentChildPos === colPos) {
        columnIndex = i
        break
      }
      currentChildPos += parentColumns.child(i).nodeSize
    }
  }

  let prevColumnRight: number | null = null
  if (columnIndex > 0 && parentColumns) {
    const columnsPos = $pos.before(columnDepth - 1)
    let prevPos = columnsPos + 1
    for (let i = 0; i < columnIndex - 1; i += 1) {
      prevPos += parentColumns.child(i).nodeSize
    }
    const prevElement = view.nodeDOM(prevPos)
    if (prevElement instanceof Element) {
      prevColumnRight = prevElement.getBoundingClientRect().right
    }
  }

  return {
    isInsideColumn: true,
    columnIndex,
    isFirstColumn: columnIndex === 0,
    columnPos: colPos,
    prevColumnRight,
  }
}

export function gutterBoundsForTarget(editor: Editor, target: BlockTarget): { left: number; width: number } {
  const colContext = getColumnContext(editor, target.pos)
  if (colContext && !colContext.isFirstColumn) {
    const fallbackLeft = target.controlRect.left - 68
    const gutterLeft = colContext.prevColumnRight != null && colContext.prevColumnRight > 0
      ? Math.max(colContext.prevColumnRight, fallbackLeft)
      : fallbackLeft
    const gutterRight = target.controlRect.left + 4
    const gutterWidth = Math.max(16, gutterRight - gutterLeft)
    return { left: gutterLeft, width: gutterWidth }
  }
  return {
    left: Math.max(0, target.controlRect.left - 96),
    width: 100,
  }
}
