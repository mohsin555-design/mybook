import type { ToastManagerAddOptions } from '@base-ui/react/toast'

interface DeleteToastOptions {
  itemName: string
  onUndo: () => void
}

export function deletedToast({ itemName, onUndo }: DeleteToastOptions): ToastManagerAddOptions<object> {
  return {
    title: `"${itemName}" deleted`,
    type: 'success',
    priority: 'low',
    actionProps: {
      children: 'Undo',
      'aria-label': `Undo deleting ${itemName}`,
      onClick: onUndo,
    },
  }
}
