import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToastExample } from '../shadcnExamples'

const meta = { title: 'Components/Toast' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ToastExample /> }
