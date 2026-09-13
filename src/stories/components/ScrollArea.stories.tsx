import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollAreaExample } from '../shadcnExamples'

const meta = { title: 'Components/Scroll Area' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ScrollAreaExample /> }
