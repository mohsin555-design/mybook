import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { SearchField } from '@heroui/react'

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
    <SearchField
      aria-label={label}
      value={value}
      onChange={onChange}
      fullWidth
      className="rounded-[var(--radius-control)]"
    >
      <SearchField.Group className="min-h-11 rounded-[var(--radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)]">
        <SearchField.SearchIcon>
          <MagnifyingGlassIcon aria-hidden="true" className="size-5" />
        </SearchField.SearchIcon>
        <SearchField.Input className="text-base" placeholder={placeholder} />
        <SearchField.ClearButton aria-label="Clear search" />
      </SearchField.Group>
    </SearchField>
  )
}
