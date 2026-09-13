import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonExample } from '../shadcnExamples'

const meta = { title: 'Components/Button' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = { render: () => <ButtonExample /> }
