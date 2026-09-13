import type { Meta, StoryObj } from '@storybook/react-vite'
import { SelectExample } from '../shadcnExamples'

const meta = { title: 'Components/Select' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <SelectExample /> }
