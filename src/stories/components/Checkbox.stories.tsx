import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckboxExample } from '../shadcnExamples'

const meta = { title: 'Components/Checkbox' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <CheckboxExample /> }
