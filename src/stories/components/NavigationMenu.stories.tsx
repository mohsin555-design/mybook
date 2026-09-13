import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavigationMenuExample } from '../shadcnExamples'

const meta = { title: 'Components/Navigation Menu' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <NavigationMenuExample /> }
