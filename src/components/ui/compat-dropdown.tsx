import type { Key, ReactNode } from 'react'
import { createContext, useContext } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

type Placement = 'bottom end' | 'bottom start' | 'bottom' | 'top end' | 'top start' | 'top'

const DropdownActionContext = createContext<((key: Key) => void) | null>(null)

function getPlacement(placement: Placement = 'bottom start') {
  const [side, align] = placement.split(' ')
  return {
    side: side === 'top' ? 'top' as const : 'bottom' as const,
    align: align === 'end' ? 'end' as const : 'start' as const,
  }
}

function Root({ children }: { children: ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>
}

function Trigger({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return <DropdownMenuTrigger {...props}>{children}</DropdownMenuTrigger>
}

function Popover({
  children,
  placement = 'bottom start',
}: {
  children: ReactNode
  placement?: Placement
}) {
  const { side, align } = getPlacement(placement)
  return (
    <DropdownMenuContent side={side} align={align} className="w-auto min-w-48">
      {children}
    </DropdownMenuContent>
  )
}

function Menu({
  children,
  onAction,
}: {
  children: ReactNode
  'aria-label'?: string
  onAction?: (key: Key) => void
}) {
  return (
    <DropdownActionContext.Provider value={onAction ?? null}>
      {children}
    </DropdownActionContext.Provider>
  )
}

function Item({
  children,
  id,
  isDisabled = false,
  variant = 'default',
}: {
  children: ReactNode
  id: Key
  isDisabled?: boolean
  variant?: 'default' | 'danger'
}) {
  const onAction = useContext(DropdownActionContext)

  return (
    <DropdownMenuItem
      disabled={isDisabled}
      variant={variant === 'danger' ? 'destructive' : 'default'}
      onClick={() => onAction?.(id)}
    >
      {children}
    </DropdownMenuItem>
  )
}

export const Dropdown = Object.assign(Root, {
  Trigger,
  Popover,
  Menu,
  Item,
})
