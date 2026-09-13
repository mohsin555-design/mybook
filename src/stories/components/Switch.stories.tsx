import type { Meta, StoryObj } from '@storybook/react-vite'
import { SwitchExample } from '../shadcnExamples'

const meta = { title: 'Components/Switch' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <SwitchExample /> }
