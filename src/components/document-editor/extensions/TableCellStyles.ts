import { TableCell, TableHeader } from '@tiptap/extension-table'

export const tableColors = [
  { name: 'White', value: '#ffffff' },
  { name: 'Gray', value: '#f3f4f6' },
  { name: 'Blue', value: '#dbeafe' },
  { name: 'Green', value: '#dcfce7' },
  { name: 'Yellow', value: '#fef9c3' },
  { name: 'Orange', value: '#ffedd5' },
  { name: 'Pink', value: '#fce7f3' },
  { name: 'Purple', value: '#f3e8ff' },
] as const

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
