import type { Meta, StoryObj } from '@storybook/react-vite'
import { TableExample } from '../shadcnExamples'

const meta = { title: 'Components/Table' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <TableExample /> }
