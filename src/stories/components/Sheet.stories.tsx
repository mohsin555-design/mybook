import type { Meta, StoryObj } from '@storybook/react-vite'
import { SheetExample } from '../shadcnExamples'

const meta = { title: 'Components/Sheet' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <SheetExample /> }
