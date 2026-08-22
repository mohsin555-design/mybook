import type { ComponentProps } from 'react'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

type ShadcnButtonProps = ComponentProps<typeof Button>

interface AppButtonProps extends Omit<ShadcnButtonProps, 'disabled' | 'onClick' | 'variant'> {
  fullWidth?: boolean
  isDisabled?: boolean
  isLoading?: boolean
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'link'
}

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
  link: 'link',
} as const

export function AppButton({
  children,
  className,
  fullWidth = false,
  isDisabled = false,
  isLoading = false,
  onPress,
  variant = 'primary',
  ...props
}: AppButtonProps) {
  return (
    <Button
      className={cn('min-h-11 px-4 text-base font-medium', fullWidth && 'w-full', className)}
      disabled={isDisabled || isLoading}
      onClick={onPress}
      variant={variantMap[variant]}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </Button>
  )
}
