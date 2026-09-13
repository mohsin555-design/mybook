import type { Meta, StoryObj } from '@storybook/react-vite'
import { CalendarExample } from '../shadcnExamples'

const meta = { title: 'Components/Calendar' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = { render: () => <CalendarExample /> }
