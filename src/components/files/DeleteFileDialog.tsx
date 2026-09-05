import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

import { AppButton } from '../common/AppButton'

interface DeleteFileDialogProps {
  isOpen: boolean
  fileName: string
  itemKind?: 'file' | 'folder'
  mode?: 'trash' | 'permanent'
  onClose: () => void
  onConfirm: () => void
}

export function DeleteFileDialog({
  isOpen,
  fileName,
  itemKind = 'file',
  mode = 'trash',
  onClose,
  onConfirm,
}: DeleteFileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isPermanent = mode === 'permanent'

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen && dialog && !dialog.open) dialog.showModal()
    else if (!isOpen && dialog?.open) dialog.close()
  }, [isOpen])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-file-title"
      aria-describedby="delete-file-description"
      onCancel={(event) => { event.preventDefault(); close() }}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="p-5">
        <ExclamationTriangleIcon aria-hidden="true" className="size-7 text-danger" />
        <h2 id="delete-file-title" className="mt-3 text-lg font-semibold">
          {isPermanent ? `Delete "${fileName}" permanently?` : `Move "${fileName}" to Trash?`}
        </h2>
        <p id="delete-file-description" className="mt-2 text-base leading-7 text-muted-foreground">
          {isPermanent
            ? `This ${itemKind} will be permanently deleted and cannot be restored.`
            : `This ${itemKind} will move to Trash, where you can restore it later.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" onPress={close}>Cancel</AppButton>
          <AppButton variant="danger" onPress={() => { onConfirm(); close() }}>
            {isPermanent ? 'Delete permanently' : 'Move to Trash'}
          </AppButton>
        </div>
      </div>
    </dialog>
  )
}
