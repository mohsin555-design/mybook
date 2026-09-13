import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputOTPExample } from '../shadcnExamples'

const meta = { title: 'Components/Input OTP' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <InputOTPExample /> }
