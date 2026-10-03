import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { DateTimePicker } from '@/components/document-editor/DateTimePicker'

const meta = { title: 'Components/Date & Time Picker', parameters: { layout: 'centered' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function InteractivePicker({ initialValue, initialIncludeTime = false }: { initialValue: string | null; initialIncludeTime?: boolean }) {
  const [value, setValue] = useState(initialValue)
  const [includeTime, setIncludeTime] = useState(initialIncludeTime)
  return <div className="rounded-lg border border-border p-6"><DateTimePicker value={value} includeTime={includeTime} onChange={(nextValue, nextIncludeTime) => { setValue(nextValue); setIncludeTime(nextIncludeTime) }} onIncludeTimeChange={setIncludeTime} /></div>
}

export const DateOnly: Story = { render: () => <InteractivePicker initialValue="2026-10-03" /> }
export const DateAndTime: Story = { render: () => <InteractivePicker initialValue="2026-10-03T14:30:00.000Z" initialIncludeTime /> }
export const Empty: Story = { render: () => <InteractivePicker initialValue={null} /> }
