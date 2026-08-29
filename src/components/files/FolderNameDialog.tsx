import { FolderIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'

import { AppButton } from '../common/AppButton'
import { FieldError } from '../ui/field'

type FolderNameDialogResult = {
  success: boolean
  error?: string
  data?: { id: string; name: string } | void
}

interface FolderNameDialogProps {
  isOpen: boolean
  title: string
  submitLabel: string
  initialName?: string
  existingFolderNames?: string[]
  onClose: () => void
  onSubmit: (name: string) => Promise<FolderNameDialogResult>
  onSuccess?: (result: FolderNameDialogResult) => void
}

export function FolderNameDialog({
  isOpen,
  title,
  submitLabel,
  initialName = '',
  existingFolderNames = [],
  onClose,
  onSubmit,
  onSuccess,
}: FolderNameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const normalizedName = cleanFolderName(name)
  const duplicateFolderName = existingFolderNames.find((folderName) =>
    cleanFolderName(folderName).toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  )
  const hasDuplicateName = normalizedName.length > 0 && Boolean(duplicateFolderName)
  const validationError = hasDuplicateName ? `"${duplicateFolderName ?? normalizedName}" already exists. Use a different name.` : null
  const displayedError = error ?? (isSubmitting ? null : validationError)

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen && dialog && !dialog.open) {
      setName(initialName)
      setError(null)
      setIsSubmitting(false)
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
          if (!isSubmitting && validationError) {
            setError(validationError)
            return
          }
          setIsSubmitting(true)
          const result = await onSubmit(name)
          if (result.success) {
            close()
            onSuccess?.(result)
          } else {
            setIsSubmitting(false)
            setError(result.error ?? 'Unable to save this folder.')
          }
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
            setIsSubmitting(false)
          }}
          aria-describedby={displayedError ? 'folder-name-error' : undefined}
          aria-invalid={Boolean(displayedError)}
          className="mt-2 min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-background px-3 text-base outline-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
        {displayedError ? <FieldError id="folder-name-error" className="mt-2">{displayedError}</FieldError> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AppButton type="button" variant="secondary" onPress={close}>Cancel</AppButton>
          <AppButton type="submit" variant="primary" isLoading={isSubmitting} loadingLabel="Creating...">{submitLabel}</AppButton>
        </div>
      </form>
    </dialog>
  )
}

function cleanFolderName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}
