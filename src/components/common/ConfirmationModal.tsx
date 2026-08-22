import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { AppButton } from './AppButton'

interface ConfirmationModalProps {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmationModal({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
}: ConfirmationModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ExclamationTriangleIcon aria-hidden="true" className="size-6" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AppButton variant="secondary" onPress={() => setOpen(false)}>Cancel</AppButton>
          <AppButton
            variant="danger"
            onPress={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
