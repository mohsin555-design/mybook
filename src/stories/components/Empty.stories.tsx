import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmptyExample } from '../shadcnExamples'

const meta = { title: 'Components/Empty' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <EmptyExample /> }
