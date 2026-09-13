import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertExample } from '../shadcnExamples'

const meta = { title: 'Components/Alert' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <AlertExample /> }
