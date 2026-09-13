import type { Meta, StoryObj } from '@storybook/react-vite'
import { ContextMenuExample } from '../shadcnExamples'

const meta = { title: 'Components/Context Menu' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ContextMenuExample /> }
