import { Button, type ButtonProps } from '@heroui/react'
import type { ReactNode } from 'react'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'isIconOnly'> {
  label: string
  children: ReactNode
}

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <Button
      isIconOnly
      aria-label={label}
      className={`size-11 min-h-11 min-w-11 rounded-[var(--radius-control)] ${className}`}
      {...props}
    >
      {children}
    </Button>
  )
}
