import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppDialogsExample } from '../shadcnExamples'

const meta = { title: 'App Components/Dialogs' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Examples: Story = { render: () => <AppDialogsExample /> }
