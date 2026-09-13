import type { Meta, StoryObj } from '@storybook/react-vite'
import { DatePickerExample } from '../shadcnExamples'

const meta = { title: 'Components/Date Picker' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Popover: Story = { render: () => <DatePickerExample /> }
