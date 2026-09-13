import type { Meta, StoryObj } from '@storybook/react-vite'
import { SkeletonExample } from '../shadcnExamples'

const meta = { title: 'Components/Skeleton' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <SkeletonExample /> }
