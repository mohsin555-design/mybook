import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestionnaireExample } from '../shadcnExamples'

const meta = { title: 'Components/Questionnaire' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ChoiceStep: Story = { render: () => <QuestionnaireExample /> }
