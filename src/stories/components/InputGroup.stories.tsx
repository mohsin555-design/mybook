import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputGroupExample } from '../shadcnExamples'

const meta = { title: 'Components/Input Group' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <InputGroupExample /> }
