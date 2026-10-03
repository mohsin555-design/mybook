// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DateTimePicker } from './DateTimePicker'

describe('DateTimePicker', () => {
  afterEach(cleanup)
  it('shows the date and opens an interactive month calendar', async () => {
    render(<DateTimePicker value="2026-10-03" includeTime={false} onChange={vi.fn()} onIncludeTimeChange={vi.fn()} />)
    expect(screen.getByText('Oct 03, 2026')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /date oct 03, 2026/i })[0]!)
    expect(await screen.findByRole('grid')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Month' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Year' })).toBeTruthy()
  })

  it('switches to date and time and emits a stored ISO timestamp', async () => {
    const onChange = vi.fn()
    const onIncludeTimeChange = vi.fn()
    render(<DateTimePicker value="2026-10-03" includeTime={false} onChange={onChange} onIncludeTimeChange={onIncludeTimeChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /date oct 03, 2026/i })[0]!)
    fireEvent.click(await screen.findByText('Include time'))
    expect(onIncludeTimeChange).toHaveBeenCalledWith(true)
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^2026-10-03T/), true)
  })

  it('supports month navigation and selecting a new calendar day', async () => {
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-10-03" includeTime={false} onChange={onChange} onIncludeTimeChange={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: /date oct 03, 2026/i })[0]!)
    const nextMonth = await screen.findByRole('button', { name: 'Go to the Next Month' })
    fireEvent.click(nextMonth)
    expect((screen.getByRole('combobox', { name: 'Month' }) as HTMLButtonElement).textContent).toContain('10')
    fireEvent.click(screen.getByRole('button', { name: /November 12th, 2026/ }))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-12', false)
  })
})
