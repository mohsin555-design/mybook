import type { Meta, StoryObj } from '@storybook/react-vite'
import { DirectionExample } from '../shadcnExamples'

const meta = { title: 'Components/Direction' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Directions: Story = { render: () => <DirectionExample /> }
