import type { Meta, StoryObj } from '@storybook/react-vite'
import { SpinnerExample } from '../shadcnExamples'

const meta = { title: 'Components/Spinner' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Sizes: Story = { render: () => <SpinnerExample /> }
