import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

interface IconButtonProps extends Omit<ComponentProps<typeof Button>, 'children' | 'disabled' | 'onClick' | 'variant'> {
  label: string
  children: ReactNode
  isDisabled?: boolean
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
}

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
} as const

export function IconButton({
  label,
  children,
  className,
  isDisabled = false,
  onPress,
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      className={cn('size-11 min-h-11 min-w-11', className)}
      disabled={isDisabled}
      onClick={onPress}
      size="icon-lg"
      variant={variantMap[variant]}
      {...props}
    >
      {children}
    </Button>
  )
}
