import { XMarkIcon } from '@heroicons/react/20/solid'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface SearchInputProps {
  label: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export function SearchInput({
  label,
  placeholder = 'Search',
  value,
  onChange,
}: SearchInputProps) {
  return (
    <div className="relative">
      <img src="/icons/magnifier.svg" alt="" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
      <Input
        aria-label={label}
        className="min-h-10 rounded-2xl bg-muted pl-9 pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {value ? (
        <Button
          type="button"
          aria-label="Clear search"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
          size="icon"
          variant="ghost"
          onClick={() => onChange?.('')}
        >
          <XMarkIcon aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
