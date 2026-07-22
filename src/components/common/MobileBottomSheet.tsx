import { Drawer } from '@heroui/react'
import type { ReactNode } from 'react'

interface MobileBottomSheetProps {
  trigger: ReactNode
  triggerLabel?: string
  triggerClassName?: string
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function MobileBottomSheet({
  trigger,
  triggerLabel,
  triggerClassName = '',
  title,
  children,
  footer,
}: MobileBottomSheetProps) {
  return (
    <Drawer>
      <Drawer.Trigger
        aria-label={triggerLabel}
        className={`min-h-11 rounded-[var(--radius-control)] ${triggerClassName}`}
      >
        {trigger}
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom" className="max-h-[85vh] rounded-t-[var(--radius-dialog)] border border-[var(--app-border)] bg-[var(--app-surface)]">
          <Drawer.Dialog>
            <Drawer.Handle />
            <Drawer.Header>
              <Drawer.Heading className="text-lg">{title}</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="Close bottom sheet" />
            </Drawer.Header>
            <Drawer.Body className="text-base leading-7">{children}</Drawer.Body>
            {footer ? <Drawer.Footer>{footer}</Drawer.Footer> : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
