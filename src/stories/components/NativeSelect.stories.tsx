import type { Meta, StoryObj } from '@storybook/react-vite'
import { NativeSelectExample } from '../shadcnExamples'

const meta = { title: 'Components/Native Select' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Sizes: Story = { render: () => <NativeSelectExample /> }
