import type { Meta, StoryObj } from '@storybook/react-vite'
import { MenubarExample } from '../shadcnExamples'

const meta = { title: 'Components/Menubar' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <MenubarExample /> }
