import type { Meta, StoryObj } from '@storybook/react-vite'
import { LabelExample } from '../shadcnExamples'

const meta = { title: 'Components/Label' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <LabelExample /> }
