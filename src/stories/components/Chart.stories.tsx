import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChartExample } from '../shadcnExamples'

const meta = { title: 'Components/Chart' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Bar: Story = { render: () => <ChartExample /> }
