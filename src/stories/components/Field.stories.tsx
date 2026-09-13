import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldExample } from '../shadcnExamples'

const meta = { title: 'Components/Field' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <FieldExample /> }
