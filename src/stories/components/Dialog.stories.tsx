import type { Meta, StoryObj } from '@storybook/react-vite'
import { DialogExample } from '../shadcnExamples'

const meta = { title: 'Components/Dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <DialogExample /> }
