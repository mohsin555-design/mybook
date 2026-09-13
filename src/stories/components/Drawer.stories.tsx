import type { Meta, StoryObj } from '@storybook/react-vite'
import { DrawerExample } from '../shadcnExamples'

const meta = { title: 'Components/Drawer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <DrawerExample /> }
