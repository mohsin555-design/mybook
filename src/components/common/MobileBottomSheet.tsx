import type { ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'
import { cn } from '../../lib/utils'

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
  triggerClassName,
  title,
  children,
  footer,
  isOpen,
  onOpenChange,
}: MobileBottomSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger
        aria-label={triggerLabel}
        className={cn('min-h-11 rounded-2xl', triggerClassName)}
      >
        {trigger}
      </SheetTrigger>
      <SheetContent side="bottom" className="mybook-bottom-sheet min-h-0 max-h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="min-h-0 px-6 pb-0 pt-4">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div className="max-h-[calc(85vh-5rem)] overflow-y-auto overscroll-contain px-6 pb-6 pt-0 text-base leading-7">
          {children}
        </div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  )
}
