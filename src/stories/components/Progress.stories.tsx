import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProgressExample } from '../shadcnExamples'

const meta = { title: 'Components/Progress' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ProgressExample /> }
