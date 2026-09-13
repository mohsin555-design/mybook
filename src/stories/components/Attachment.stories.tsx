import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttachmentExample } from '../shadcnExamples'

const meta = { title: 'Components/Attachment' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <AttachmentExample /> }
