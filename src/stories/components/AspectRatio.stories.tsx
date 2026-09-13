import type { Meta, StoryObj } from '@storybook/react-vite'
import { AspectRatioExample } from '../shadcnExamples'

const meta = { title: 'Components/Aspect Ratio' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Ratios: Story = { render: () => <AspectRatioExample /> }
