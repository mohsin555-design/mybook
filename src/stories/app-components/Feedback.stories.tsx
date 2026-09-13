import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppFeedbackExample } from '../shadcnExamples'

const meta = { title: 'App Components/Feedback' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = { render: () => <AppFeedbackExample /> }
