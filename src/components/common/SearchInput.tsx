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
      className="rounded-xl"
    >
      <SearchField.Group className="min-h-9 rounded-xl border-0 bg-default px-3">
        <SearchField.SearchIcon>
          <img src="/icons/magnifier.svg" alt="" aria-hidden="true" className="size-4" />
        </SearchField.SearchIcon>
        <SearchField.Input className="text-sm" placeholder={placeholder} />
        <SearchField.ClearButton aria-label="Clear search" />
      </SearchField.Group>
    </SearchField>
  )
}
