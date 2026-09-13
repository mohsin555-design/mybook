import type { Meta, StoryObj } from '@storybook/react-vite'
import { BreadcrumbExample } from '../shadcnExamples'

const meta = { title: 'Components/Breadcrumb' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <BreadcrumbExample /> }
