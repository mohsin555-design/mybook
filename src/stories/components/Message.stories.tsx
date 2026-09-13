import type { Meta, StoryObj } from '@storybook/react-vite'
import { MessageExample } from '../shadcnExamples'

const meta = { title: 'Components/Message' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Thread: Story = { render: () => <MessageExample /> }
