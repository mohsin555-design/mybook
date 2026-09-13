import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResizableExample } from '../shadcnExamples'

const meta = { title: 'Components/Resizable' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Panels: Story = { render: () => <ResizableExample /> }
