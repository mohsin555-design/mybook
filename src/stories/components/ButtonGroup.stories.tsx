import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonGroupExample } from '../shadcnExamples'

const meta = { title: 'Components/Button Group' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ButtonGroupExample /> }
