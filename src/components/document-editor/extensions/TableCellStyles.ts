import { TableCell, TableHeader } from '@tiptap/extension-table'

function styledCellAttributes(parent: (() => Record<string, unknown>) | undefined) {
  return {
    ...(parent?.() ?? {}),
    backgroundColor: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
      renderHTML: (attributes: { backgroundColor?: string | null }) => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor};` } : {},
    },
  }
}

export const StyledTableCell = TableCell.extend({
  addAttributes() {
    return styledCellAttributes(this.parent)
  },
})

export const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return styledCellAttributes(this.parent)
  },
})
