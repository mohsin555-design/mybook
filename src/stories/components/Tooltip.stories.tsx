import type { Meta, StoryObj } from '@storybook/react-vite'
import { TooltipExample } from '../shadcnExamples'

const meta = { title: 'Components/Tooltip' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <TooltipExample /> }
