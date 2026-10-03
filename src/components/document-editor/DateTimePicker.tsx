import { Calendar01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { format } from 'date-fns'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const MONTHS = Array.from({ length: 12 }, (_, month) => format(new Date(2024, month, 1), 'MMMM'))
const YEAR_START = 1900
const YEAR_END = 2100

export interface DateTimePickerProps {
  value: string | null
  includeTime: boolean
  onChange: (value: string, includeTime: boolean) => void
  onIncludeTimeChange: (includeTime: boolean) => void
  className?: string
  disabled?: boolean
}

function validDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateValue(date: Date, includeTime: boolean) {
  if (includeTime) return date.toISOString()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromValue(value: string | null, includeTime: boolean) {
  const parsed = validDate(value)
  if (parsed) return parsed
  const now = new Date()
  if (!includeTime) return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  now.setSeconds(0, 0)
  return now
}

export function DateTimePicker({ value, includeTime, onChange, onIncludeTimeChange, className, disabled }: DateTimePickerProps) {
  const selected = validDate(value)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => selected ?? new Date())
  const [time, setTime] = useState(() => selected ? format(selected, 'HH:mm') : format(new Date(), 'HH:mm'))

  const setMonthAndYear = (month: number, year: number) => {
    setVisibleMonth((current) => new Date(year, month, Math.min(current.getDate(), new Date(year, month + 1, 0).getDate())))
  }

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    const next = new Date(date)
    if (includeTime) {
      const [hours = '0', minutes = '0'] = time.split(':')
      next.setHours(Number(hours), Number(minutes), 0, 0)
    }
    onChange(toDateValue(next, includeTime), includeTime)
  }

  const handleTimeChange = (nextTime: string) => {
    setTime(nextTime)
    const next = dateFromValue(value, true)
    const [hours = '0', minutes = '0'] = nextTime.split(':')
    next.setHours(Number(hours), Number(minutes), 0, 0)
    onChange(next.toISOString(), true)
  }

  const handleIncludeTime = (enabled: boolean) => {
    onIncludeTimeChange(enabled)
    const next = dateFromValue(value, enabled)
    if (enabled) {
      const [hours = '0', minutes = '0'] = time.split(':')
      next.setHours(Number(hours), Number(minutes), 0, 0)
      onChange(next.toISOString(), true)
    } else {
      onChange(toDateValue(next, false), false)
    }
  }

  const years = Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, index) => YEAR_START + index)

  return (
    <Popover modal="trap-focus" open={open} onOpenChange={(nextOpen, details) => {
      if (!nextOpen && details.reason === 'focus-out') return
      setOpen(nextOpen)
    }}>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" disabled={disabled} className={cn('h-8 gap-2 px-2 font-normal text-muted-foreground hover:text-foreground', className)} />}
        aria-label={selected ? `Date ${format(selected, 'MMM dd, yyyy')}` : 'Choose date'}
      >
        <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4" />
        <span>{selected ? format(selected, 'MMM dd, yyyy') : 'Set date'}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[304px] gap-0 rounded-xl p-0">
        <div className="flex items-center justify-between gap-2 px-3 pt-3" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Select value={String(visibleMonth.getMonth())} onValueChange={(value) => { if (value !== null) setMonthAndYear(Number(value), visibleMonth.getFullYear()) }}>
            <SelectTrigger aria-label="Month" className="h-8 w-[148px] border-0 bg-transparent px-2 font-medium shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent align="start" className="max-h-64">
              {MONTHS.map((month, index) => <SelectItem key={month} value={String(index)}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(visibleMonth.getFullYear())} onValueChange={(value) => { if (value !== null) setMonthAndYear(visibleMonth.getMonth(), Number(value)) }}>
            <SelectTrigger aria-label="Year" className="h-8 w-[86px] border-0 bg-transparent px-2 font-medium shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent align="end" className="max-h-64">
              {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={handleSelect}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            className="mx-auto p-2"
            classNames={{ month_caption: 'hidden' }}
          />
        </div>
        <div className="mx-3 border-t border-border" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <span>Include time</span>
            <Switch aria-label="Include time" checked={includeTime} onCheckedChange={handleIncludeTime} />
          </label>
        </div>
        {includeTime && (
          <div className="border-t border-border px-4 py-3" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <label htmlFor="datetime-time" className="mb-1.5 block text-xs font-medium text-muted-foreground">Time</label>
            <input id="datetime-time" type="time" value={time} onChange={(event) => handleTimeChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
