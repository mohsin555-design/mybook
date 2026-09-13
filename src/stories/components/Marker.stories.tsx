import type { Meta, StoryObj } from '@storybook/react-vite'
import { MarkerExample } from '../shadcnExamples'

const meta = { title: 'Components/Marker' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <MarkerExample /> }
