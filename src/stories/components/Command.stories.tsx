import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommandExample } from '../shadcnExamples'

const meta = { title: 'Components/Command' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Palette: Story = { render: () => <CommandExample /> }
