import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardExample } from '../shadcnExamples'

const meta = { title: 'Components/Card' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <CardExample /> }
