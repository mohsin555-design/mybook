import type { Meta, StoryObj } from '@storybook/react-vite'
import { BadgeExample } from '../shadcnExamples'

const meta = { title: 'Components/Badge' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <BadgeExample /> }
