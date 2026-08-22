import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  EllipsisHorizontalIcon,
  QueueListIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useState, type ReactNode } from 'react'

import { MobileBottomSheet } from '../common/MobileBottomSheet'

interface ChecklistTarget {
  checked: boolean
  rect: DOMRect
}

interface ChecklistAction {
  label: string
  icon: typeof QueueListIcon
  active?: (target: ChecklistTarget) => boolean
  isEnabled: (editor: Editor, target: ChecklistTarget) => boolean
  run: (editor: Editor, target: ChecklistTarget) => void
}

function getChecklistTarget(editor: Editor): ChecklistTarget | null {
  if (!editor.isActive('taskItem')) return null
  const { from } = editor.state.selection
  const coords = editor.view.coordsAtPos(from)
  const attrs = editor.getAttributes('taskItem') as { checked?: boolean }
  return {
    checked: Boolean(attrs.checked),
    rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top),
  }
}

const checklistActions: ChecklistAction[] = [
  {
    label: 'Mark checked',
    icon: CheckIcon,
    active: (target) => target.checked,
    isEnabled: (_editor, target) => !target.checked,
    run: (editor) => editor.chain().focus().updateAttributes('taskItem', { checked: true }).run(),
  },
  {
    label: 'Mark unchecked',
    icon: XMarkIcon,
    active: (target) => !target.checked,
    isEnabled: (_editor, target) => target.checked,
    run: (editor) => editor.chain().focus().updateAttributes('taskItem', { checked: false }).run(),
  },
  {
    label: 'Indent checklist item',
    icon: ArrowRightIcon,
    isEnabled: (editor) => editor.can().chain().focus().sinkListItem('taskItem').run(),
    run: (editor) => editor.chain().focus().sinkListItem('taskItem').run(),
  },
  {
    label: 'Outdent checklist item',
    icon: ArrowLeftIcon,
    isEnabled: (editor) => editor.can().chain().focus().liftListItem('taskItem').run(),
    run: (editor) => editor.chain().focus().liftListItem('taskItem').run(),
  },
  {
    label: 'Convert to text',
    icon: QueueListIcon,
    isEnabled: (editor) => editor.can().chain().focus().toggleTaskList().run(),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
]

function ChecklistActionButton({
  action,
  editor,
  target,
  children,
}: {
  action: ChecklistAction
  editor: Editor
  target: ChecklistTarget
  children: ReactNode
}) {
  const disabled = !action.isEnabled(editor, target)
  const active = action.active?.(target) ?? false
  return (
    <button
      type="button"
      aria-label={action.label}
      aria-pressed={active}
      title={action.label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        if (!disabled) action.run(editor, target)
      }}
      className={`flex size-9 items-center justify-center rounded-[8px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-35 ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function SheetActionButton({
  action,
  editor,
  target,
  onRun,
}: {
  action: ChecklistAction
  editor: Editor
  target: ChecklistTarget
  onRun: () => void
}) {
  const disabled = !action.isEnabled(editor, target)
  const active = action.active?.(target) ?? false
  const Icon = action.icon
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        action.run(editor, target)
        onRun()
      }}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[8px] border border-[var(--app-border)] px-4 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 ${
        active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-[var(--app-subtle)]'
      }`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span>{action.label}</span>
    </button>
  )
}

export function ChecklistActionsMenu({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<ChecklistTarget | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  useEffect(() => {
    const update = () => setTarget(getChecklistTarget(editor))
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

  const top = Math.max(140, target.rect.top)
  const left = Math.max(8, Math.min(target.rect.left - 52, window.innerWidth - 232))

  return (
    <>
      <div
        className="fixed z-40 hidden gap-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)] md:flex"
        style={{ top, left }}
        role="toolbar"
        aria-label="Checklist actions"
      >
        {checklistActions.map((action) => (
          <ChecklistActionButton key={action.label} action={action} editor={editor} target={target}>
            <action.icon aria-hidden="true" className="size-4" />
          </ChecklistActionButton>
        ))}
      </div>

      <div className="fixed left-[4.75rem] z-40 md:hidden" style={{ bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 5.5rem + env(safe-area-inset-bottom))' }}>
        <MobileBottomSheet
          title="Checklist actions"
          triggerLabel="Open checklist actions"
          isOpen={isMobileSheetOpen}
          onOpenChange={setIsMobileSheetOpen}
          trigger={
            <span className="flex size-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
              <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
            </span>
          }
          triggerClassName="rounded-full"
        >
          <div className="grid grid-cols-1 gap-2 pb-2">
            {checklistActions.map((action) => (
              <SheetActionButton key={action.label} action={action} editor={editor} target={target} onRun={() => setIsMobileSheetOpen(false)} />
            ))}
          </div>
        </MobileBottomSheet>
      </div>
    </>
  )
}
