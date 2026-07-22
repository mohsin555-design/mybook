import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Modal } from '@heroui/react'
import type { ReactNode } from 'react'

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
  return (
    <Modal>
      <Modal.Trigger>{trigger}</Modal.Trigger>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-4">
          <Modal.Dialog className="w-full max-w-md rounded-[var(--radius-dialog)] border border-[var(--app-border)] bg-[var(--app-surface)]">
            {({ close }) => (
              <>
                <Modal.Header>
                  <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                    <ExclamationTriangleIcon aria-hidden="true" className="size-6" />
                  </Modal.Icon>
                  <Modal.Heading className="text-lg">{title}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="text-base leading-7 text-muted">{description}</Modal.Body>
                <Modal.Footer>
                  <AppButton variant="secondary" onPress={close}>Cancel</AppButton>
                  <AppButton
                    variant="danger"
                    onPress={() => {
                      onConfirm()
                      close()
                    }}
                  >
                    {confirmLabel}
                  </AppButton>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
