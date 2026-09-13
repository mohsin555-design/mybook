import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComboboxExample } from '../shadcnExamples'

const meta = { title: 'Components/Combobox' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ComboboxExample /> }
