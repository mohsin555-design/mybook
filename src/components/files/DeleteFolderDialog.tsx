import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

import { AppButton } from '../common/AppButton'

interface DeleteFolderDialogProps {
  isOpen: boolean
  folderName: string
  onClose: () => void
  onConfirm: () => void
}

export function DeleteFolderDialog({ isOpen, folderName, onClose, onConfirm }: DeleteFolderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
      aria-labelledby="delete-folder-title"
      aria-describedby="delete-folder-description"
      onCancel={(event) => { event.preventDefault(); close() }}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="p-5">
        <ExclamationTriangleIcon aria-hidden="true" className="size-7 text-danger" />
        <h2 id="delete-folder-title" className="mt-3 text-lg font-semibold">Delete “{folderName}”?</h2>
        <p id="delete-folder-description" className="mt-2 text-base leading-7 text-muted-foreground">
          This folder is not empty. Its files and nested folders will also be deleted. This cannot be undone.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" onPress={close}>Cancel</AppButton>
          <AppButton variant="danger" onPress={() => { onConfirm(); close() }}>Delete folder</AppButton>
        </div>
      </div>
    </dialog>
  )
}
