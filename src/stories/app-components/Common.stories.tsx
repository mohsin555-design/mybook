import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppCommonExample } from '../shadcnExamples'

const meta = { title: 'App Components/Common' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = { render: () => <AppCommonExample /> }
