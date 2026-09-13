import type { Meta, StoryObj } from '@storybook/react-vite'
import { TypographyExample } from '../shadcnExamples'

const meta = { title: 'Components/Typography' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Scale: Story = { render: () => <TypographyExample /> }
