import { Drawer } from '@heroui/react'
import type { ReactNode } from 'react'

interface MobileBottomSheetProps {
  trigger: ReactNode
  triggerLabel?: string
  triggerClassName?: string
  title: string
  children: ReactNode
  footer?: ReactNode
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export function MobileBottomSheet({
  trigger,
  triggerLabel,
  triggerClassName = '',
  title,
  children,
  footer,
  isOpen,
  onOpenChange,
}: MobileBottomSheetProps) {
  return (
    <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Trigger
        aria-label={triggerLabel}
        className={`min-h-11 rounded-[var(--radius-control)] ${triggerClassName}`}
      >
        {trigger}
      </Drawer.Trigger>
      <Drawer.Backdrop className="bg-black/50">
        <Drawer.Content placement="bottom" className="mybook-bottom-sheet min-h-0 max-h-[85vh] rounded-t-2xl border-0 bg-[var(--app-surface)] shadow-[0_-6px_12px_rgba(0,0,0,0.03),0_14px_28px_rgba(0,0,0,0.08)]">
          <Drawer.Dialog className="p-0">
            <Drawer.Handle />
            <Drawer.Header className="min-h-0 px-3 pb-0 pt-1">
              <Drawer.Heading className="sr-only">{title}</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="Close bottom sheet" className="ml-auto rounded-full bg-default" />
            </Drawer.Header>
            <Drawer.Body className="max-h-[calc(85vh-5rem)] overflow-y-auto overscroll-contain px-6 pb-6 pt-0 text-base leading-7">{children}</Drawer.Body>
            {footer ? <Drawer.Footer>{footer}</Drawer.Footer> : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
