import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToggleExample } from '../shadcnExamples'

const meta = { title: 'Components/Toggle' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <ToggleExample /> }
