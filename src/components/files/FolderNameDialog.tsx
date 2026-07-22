import { FolderIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'

import { AppButton } from '../common/AppButton'

interface FolderNameDialogProps {
  isOpen: boolean
  title: string
  submitLabel: string
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => Promise<{ success: boolean; error?: string }>
}

export function FolderNameDialog({
  isOpen,
  title,
  submitLabel,
  initialName = '',
  onClose,
  onSubmit,
}: FolderNameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen && dialog && !dialog.open) {
      setName(initialName)
      setError(null)
      dialog.showModal()
    } else if (!isOpen && dialog?.open) {
      dialog.close()
    }
  }, [initialName, isOpen])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="folder-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-foreground backdrop:bg-black/50"
    >
      <form
        method="dialog"
        className="p-5"
        onSubmit={async (event) => {
          event.preventDefault()
          const result = await onSubmit(name)
          if (result.success) close()
          else setError(result.error ?? 'Unable to save this folder.')
        }}
      >
        <div className="flex items-center gap-3">
          <FolderIcon aria-hidden="true" className="size-6 text-warning" />
          <h2 id="folder-dialog-title" className="text-lg font-semibold">{title}</h2>
        </div>
        <label htmlFor="folder-name" className="mt-5 block text-sm font-medium">Folder name</label>
        <input
          id="folder-name"
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          aria-describedby={error ? 'folder-name-error' : undefined}
          aria-invalid={Boolean(error)}
          className="mt-2 min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-background px-3 text-base"
        />
        {error ? <p id="folder-name-error" role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <AppButton type="button" variant="secondary" onPress={close}>Cancel</AppButton>
          <AppButton type="submit" variant="primary">{submitLabel}</AppButton>
        </div>
      </form>
    </dialog>
  )
}
