import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppButtonExample } from '../shadcnExamples'

const meta = { title: 'App Components/App Button' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <AppButtonExample /> }
