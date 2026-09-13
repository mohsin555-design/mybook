import type { Meta, StoryObj } from '@storybook/react-vite'
import { TabsExample } from '../shadcnExamples'

const meta = { title: 'Components/Tabs' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <TabsExample /> }
