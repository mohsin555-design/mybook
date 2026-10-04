import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { DateTimePicker } from '@/components/document-editor/DateTimePicker'

const meta = { title: 'Components/Date & Time Picker', parameters: { layout: 'centered' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function InteractivePicker({ initialValue, initialIncludeTime = false }: { initialValue: string | null; initialIncludeTime?: boolean }) {
  const [value, setValue] = useState(initialValue)
  const [includeTime, setIncludeTime] = useState(initialIncludeTime)
  const [endDateEnabled, setEndDateEnabled] = useState(false)
  const [endValue, setEndValue] = useState<string | null>(null)
  const [use24Hour, setUse24Hour] = useState(false)
  const [dateFormat, setDateFormat] = useState<import('@/components/document-editor/DateTimePicker').DateFormat>('relative')
  return <div className="rounded-lg border border-border p-6"><DateTimePicker value={value} endDateEnabled={endDateEnabled} endValue={endValue} includeTime={includeTime} use24Hour={use24Hour} dateFormat={dateFormat} onChange={(nextValue, nextIncludeTime) => { setValue(nextValue); setIncludeTime(nextIncludeTime) }} onEndDateChange={(enabled, nextValue) => { setEndDateEnabled(enabled); setEndValue(nextValue) }} onIncludeTimeChange={setIncludeTime} onTimeFormatChange={setUse24Hour} onDateFormatChange={setDateFormat} onClear={() => { setValue(null); setEndDateEnabled(false); setEndValue(null); setIncludeTime(false) }} /></div>
}

export const DateOnly: Story = { render: () => <InteractivePicker initialValue="2026-10-03" /> }
export const DateAndTime: Story = { render: () => <InteractivePicker initialValue="2026-10-03T14:30:00.000Z" initialIncludeTime /> }
export const Empty: Story = { render: () => <InteractivePicker initialValue={null} /> }
