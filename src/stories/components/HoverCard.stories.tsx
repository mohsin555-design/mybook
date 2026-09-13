import type { Meta, StoryObj } from '@storybook/react-vite'
import { HoverCardExample } from '../shadcnExamples'

const meta = { title: 'Components/Hover Card' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <HoverCardExample /> }
