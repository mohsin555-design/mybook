import type { Meta, StoryObj } from '@storybook/react-vite'
import { KbdExample } from '../shadcnExamples'

const meta = { title: 'Components/Kbd' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <KbdExample /> }
