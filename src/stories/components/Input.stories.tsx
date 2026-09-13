import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputExample } from '../shadcnExamples'

const meta = { title: 'Components/Input' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <InputExample /> }
