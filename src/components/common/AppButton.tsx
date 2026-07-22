import { Button, type ButtonProps } from '@heroui/react'

type AppButtonProps = ButtonProps

export function AppButton({ className = '', ...props }: AppButtonProps) {
  return (
    <Button
      className={`min-h-11 rounded-[var(--radius-control)] px-4 text-base font-medium ${className}`}
      {...props}
    />
  )
}
