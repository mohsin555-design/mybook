import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useState, type ReactNode } from 'react'

import { MobileBottomSheet } from '../common/MobileBottomSheet'

interface TableTarget {
  rect: DOMRect
}

interface TableAction {
  label: string
  icon: typeof PlusIcon
  destructive?: boolean
  isEnabled: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

function getTableTarget(editor: Editor): TableTarget | null {
  if (!editor.isActive('table')) return null
  const { from } = editor.state.selection
  const coords = editor.view.coordsAtPos(from)
  return {
    rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top),
  }
}

function TableActionButton({
  action,
  editor,
  children,
  onRun,
}: {
  action: TableAction
  editor: Editor
  children: ReactNode
  onRun?: () => void
}) {
  const disabled = !action.isEnabled(editor)
  return (
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        if (disabled) return
        action.run(editor)
        onRun?.()
      }}
      className={`flex size-9 items-center justify-center rounded-[8px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-35 ${
        action.destructive ? 'text-red-600 hover:bg-red-50' : 'text-muted hover:bg-[var(--app-subtle)] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function SheetActionButton({
  action,
  editor,
  onRun,
}: {
  action: TableAction
  editor: Editor
  onRun: () => void
}) {
  const disabled = !action.isEnabled(editor)
  const Icon = action.icon
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        action.run(editor)
        onRun()
      }}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[8px] border border-[var(--app-border)] px-4 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 ${
        action.destructive
          ? 'text-red-600 hover:border-red-200 hover:bg-red-50'
          : 'text-foreground hover:bg-[var(--app-subtle)]'
      }`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span>{action.label}</span>
    </button>
  )
}

const tableActions: TableAction[] = [
  {
    label: 'Add row above',
    icon: PlusIcon,
    isEnabled: (editor) => editor.can().chain().focus().addRowBefore().run(),
    run: (editor) => editor.chain().focus().addRowBefore().run(),
  },
  {
    label: 'Add row below',
    icon: PlusIcon,
    isEnabled: (editor) => editor.can().chain().focus().addRowAfter().run(),
    run: (editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: 'Add column left',
    icon: PlusIcon,
    isEnabled: (editor) => editor.can().chain().focus().addColumnBefore().run(),
    run: (editor) => editor.chain().focus().addColumnBefore().run(),
  },
  {
    label: 'Add column right',
    icon: PlusIcon,
    isEnabled: (editor) => editor.can().chain().focus().addColumnAfter().run(),
    run: (editor) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: 'Delete row',
    icon: TrashIcon,
    destructive: true,
    isEnabled: (editor) => editor.can().chain().focus().deleteRow().run(),
    run: (editor) => editor.chain().focus().deleteRow().run(),
  },
  {
    label: 'Delete column',
    icon: TrashIcon,
    destructive: true,
    isEnabled: (editor) => editor.can().chain().focus().deleteColumn().run(),
    run: (editor) => editor.chain().focus().deleteColumn().run(),
  },
  {
    label: 'Toggle header row',
    icon: TableCellsIcon,
    isEnabled: (editor) => editor.can().chain().focus().toggleHeaderRow().run(),
    run: (editor) => editor.chain().focus().toggleHeaderRow().run(),
  },
  {
    label: 'Toggle header column',
    icon: TableCellsIcon,
    isEnabled: (editor) => editor.can().chain().focus().toggleHeaderColumn().run(),
    run: (editor) => editor.chain().focus().toggleHeaderColumn().run(),
  },
  {
    label: 'Merge selected cells',
    icon: ArrowsPointingInIcon,
    isEnabled: (editor) => editor.can().chain().focus().mergeCells().run(),
    run: (editor) => editor.chain().focus().mergeCells().run(),
  },
  {
    label: 'Split cell',
    icon: ArrowsPointingOutIcon,
    isEnabled: (editor) => editor.can().chain().focus().splitCell().run(),
    run: (editor) => editor.chain().focus().splitCell().run(),
  },
  {
    label: 'Delete table',
    icon: TrashIcon,
    destructive: true,
    isEnabled: (editor) => editor.can().chain().focus().deleteTable().run(),
    run: (editor) => editor.chain().focus().deleteTable().run(),
  },
]

export function TableActionsMenu({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<TableTarget | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  useEffect(() => {
    const update = () => setTarget(getTableTarget(editor))
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    editor.on('blur', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      editor.off('blur', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [editor])

  if (!target) return null

  const top = Math.max(140, target.rect.top - 48)
  const left = Math.max(8, Math.min(target.rect.left, window.innerWidth - 432))

  return (
    <>
      <div
        className="fixed z-40 hidden max-w-[calc(100vw-1rem)] gap-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)] md:flex"
        style={{ top, left }}
        role="toolbar"
        aria-label="Table actions"
      >
        {tableActions.map((action) => (
          <TableActionButton key={action.label} action={action} editor={editor}>
            <action.icon aria-hidden="true" className="size-4" />
          </TableActionButton>
        ))}
      </div>

      <div className="fixed left-4 z-40 md:hidden" style={{ bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 5.5rem + env(safe-area-inset-bottom))' }}>
        <MobileBottomSheet
          title="Table actions"
          triggerLabel="Open table actions"
          isOpen={isMobileSheetOpen}
          onOpenChange={setIsMobileSheetOpen}
          trigger={
            <span className="flex size-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
              <TableCellsIcon aria-hidden="true" className="size-5" />
            </span>
          }
          triggerClassName="rounded-full"
        >
          <div className="space-y-5 pb-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Rows and columns</h2>
              <div className="grid grid-cols-1 gap-2">
                {tableActions.slice(0, 6).map((action) => (
                  <SheetActionButton key={action.label} action={action} editor={editor} onRun={() => setIsMobileSheetOpen(false)} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Cell actions</h2>
              <div className="grid grid-cols-1 gap-2">
                {tableActions.slice(6).map((action) => (
                  <SheetActionButton key={action.label} action={action} editor={editor} onRun={() => setIsMobileSheetOpen(false)} />
                ))}
              </div>
            </div>
          </div>
        </MobileBottomSheet>
      </div>
    </>
  )
}
