import type { Meta, StoryObj } from '@storybook/react-vite'
import { BubbleExample } from '../shadcnExamples'

const meta = { title: 'Components/Bubble' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <BubbleExample /> }
