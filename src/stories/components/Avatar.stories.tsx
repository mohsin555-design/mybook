import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarExample } from '../shadcnExamples'

const meta = { title: 'Components/Avatar' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <AvatarExample /> }
