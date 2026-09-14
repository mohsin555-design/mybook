import { Table, TableView } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

class WidthPreservingTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number, view?: EditorView, htmlAttributes?: Record<string, unknown>) {
    super(node, cellMinWidth, view, htmlAttributes)
    this.applyTableWidth(node)
  }

  update(node: ProseMirrorNode) {
    const updated = super.update(node)
    if (updated) this.applyTableWidth(node)
    return updated
  }

  private applyTableWidth(node: ProseMirrorNode) {
    const width = node.attrs.tableWidth
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) this.table.style.width = `${width}px`
  }
}

export const FixedTable = Table.extend({
  addOptions() {
    const parentOptions = this.parent?.()
    return {
      HTMLAttributes: parentOptions?.HTMLAttributes ?? {},
      resizable: parentOptions?.resizable ?? false,
      renderWrapper: parentOptions?.renderWrapper ?? false,
      handleWidth: parentOptions?.handleWidth ?? 5,
      cellMinWidth: parentOptions?.cellMinWidth ?? 25,
      View: WidthPreservingTableView,
      lastColumnResizable: parentOptions?.lastColumnResizable ?? true,
      allowTableNodeSelection: parentOptions?.allowTableNodeSelection ?? false,
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      tableWidth: {
        default: null,
        parseHTML: (element) => {
          const width = Number.parseFloat(element.style.width)
          return Number.isFinite(width) && width > 0 ? width : null
        },
        renderHTML: (attributes) => typeof attributes.tableWidth === 'number' && attributes.tableWidth > 0
          ? { style: `width: ${attributes.tableWidth}px` }
          : {},
      },
      fixedRowsEnabled: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-fixed-rows') === 'true',
        renderHTML: (attributes) => attributes.fixedRowsEnabled ? { 'data-fixed-rows': 'true' } : {},
      },
      fixedRowCount: {
        default: 5,
        parseHTML: (element) => Number(element.getAttribute('data-fixed-row-count')) || 5,
        renderHTML: (attributes) => ({ 'data-fixed-row-count': String(attributes.fixedRowCount ?? 5) }),
      },
    }
  },
})
