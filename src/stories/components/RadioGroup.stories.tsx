import type { Meta, StoryObj } from '@storybook/react-vite'
import { RadioGroupExample } from '../shadcnExamples'

const meta = { title: 'Components/Radio Group' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <RadioGroupExample /> }
