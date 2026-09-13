import type { Meta, StoryObj } from '@storybook/react-vite'
import { DropdownMenuExample } from '../shadcnExamples'

const meta = { title: 'Components/Dropdown Menu' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <DropdownMenuExample /> }
