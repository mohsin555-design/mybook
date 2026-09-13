import type { Meta, StoryObj } from '@storybook/react-vite'
import { PopoverExample } from '../shadcnExamples'

const meta = { title: 'Components/Popover' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <PopoverExample /> }
