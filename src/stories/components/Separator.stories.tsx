import type { Meta, StoryObj } from '@storybook/react-vite'
import { SeparatorExample } from '../shadcnExamples'

const meta = { title: 'Components/Separator' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Orientations: Story = { render: () => <SeparatorExample /> }
