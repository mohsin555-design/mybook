import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToggleGroupExample } from '../shadcnExamples'

const meta = { title: 'Components/Toggle Group' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ToggleGroupExample /> }
