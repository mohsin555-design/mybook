import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextareaExample } from '../shadcnExamples'

const meta = { title: 'Components/Textarea' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <TextareaExample /> }
