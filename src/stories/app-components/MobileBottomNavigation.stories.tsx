import type { Meta, StoryObj } from '@storybook/react-vite'
import { MobileBottomNavigationExample } from '../shadcnExamples'

const meta = {
  title: 'App Components/Bottom Navigation',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Mobile: Story = { render: () => <MobileBottomNavigationExample /> }
