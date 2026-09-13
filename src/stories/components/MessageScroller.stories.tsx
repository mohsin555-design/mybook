import type { Meta, StoryObj } from '@storybook/react-vite'
import { MessageScrollerExample } from '../shadcnExamples'

const meta = { title: 'Components/Message Scroller' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <MessageScrollerExample /> }
