import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppFilesExample } from '../shadcnExamples'

const meta = { title: 'App Components/Files' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = { render: () => <AppFilesExample /> }
