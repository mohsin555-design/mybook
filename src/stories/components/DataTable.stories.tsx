import type { Meta, StoryObj } from '@storybook/react-vite'
import { DataTableExample } from '../shadcnExamples'

const meta = { title: 'Components/Data Table' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <DataTableExample /> }
