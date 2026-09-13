import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemExample } from '../shadcnExamples'

const meta = { title: 'Components/Item' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <ItemExample /> }
