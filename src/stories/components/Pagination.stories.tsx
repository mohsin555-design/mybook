import type { Meta, StoryObj } from '@storybook/react-vite'
import { PaginationExample } from '../shadcnExamples'

const meta = { title: 'Components/Pagination' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <PaginationExample /> }
