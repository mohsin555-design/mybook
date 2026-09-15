import {
  Link03Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'

import { AppHeader, type AppHeaderProps } from '../../components/common/AppHeader'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'

const noop = () => undefined

const toolbar = (
  <div className="flex w-max items-center gap-1 bg-background">
    <Button size="sm" variant="secondary">Heading 1</Button>
    <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
    {[
      { label: 'Bold', icon: TextBoldIcon },
      { label: 'Underline', icon: TextUnderlineIcon },
      { label: 'Italic', icon: TextItalicIcon },
      { label: 'Insert link', icon: Link03Icon },
    ].map(({ label, icon }) => (
      <Button key={label} size="icon-sm" variant="ghost" aria-label={label}>
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
      </Button>
    ))}
  </div>
)

const segmentControl = (
  <Tabs defaultValue="write">
    <TabsList aria-label="Document views">
      <TabsTrigger value="write">Write</TabsTrigger>
      <TabsTrigger value="outline">Outline</TabsTrigger>
      <TabsTrigger value="comments">Comments</TabsTrigger>
    </TabsList>
  </Tabs>
)

const commonArgs: AppHeaderProps = {
  title: 'Welcome to Writin',
  breadcrumbs: [{ label: 'Home', onPress: noop }, { label: 'Documents', onPress: noop }, { label: 'Drafts', onPress: noop }, { label: 'Eight', onPress: noop }, { label: 'Untitled' }],
  leadingAction: 'sidebar',
  onBack: noop,
  onSidebarToggle: noop,
  shareAction: true,
  favoriteAction: true,
  moreAction: true,
  onShare: noop,
  onFavorite: noop,
  onMore: noop,
}

function AutosaveHeader(args: AppHeaderProps) {
  const [status, setStatus] = useState<'saving' | 'saved'>('saving')

  useEffect(() => {
    const timer = window.setInterval(() => setStatus((current) => current === 'saving' ? 'saved' : 'saving'), 1800)
    return () => window.clearInterval(timer)
  }, [])

  return <AppHeader {...args} status={status} />
}

const meta = {
  title: 'App Components/App Header',
  component: AppHeader,
  args: commonArgs,
  argTypes: {
    title: { control: 'text' },
    heading: { control: 'text' },
    leadingAction: { control: 'inline-radio', options: ['sidebar', 'back'] },
    breadcrumbs: { control: 'object' },
    centerLeftActions: { control: 'object' },
    shareAction: { control: 'boolean' },
    favoriteAction: { control: 'boolean' },
    moreAction: { control: 'boolean' },
    isFavorite: { control: 'boolean' },
    status: { control: false },
    toolbar: { control: 'boolean', mapping: { true: toolbar, false: undefined } },
    segmentControl: { control: 'boolean', mapping: { true: segmentControl, false: undefined } },
    onBack: { control: false },
    onSidebarToggle: { control: false },
    onShare: { control: false },
    onFavorite: { control: false },
    onMore: { control: false },
    onRename: { control: false },
  },
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="min-h-[36rem] bg-background"><Story /></div>],
} satisfies Meta<typeof AppHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = { render: (args) => <AutosaveHeader {...args} /> }

export const WithConsumerSlots: Story = {
  args: { toolbar, segmentControl },
  render: (args) => <AutosaveHeader {...args} />,
}

export const Mobile: Story = {
  render: (args) => <AutosaveHeader {...args} leadingAction="back" />,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}

export const MobileScrollBehavior: Story = {
  render: (args) => (
    <div data-app-header-scroll className="h-80 overflow-y-auto bg-background">
      <AutosaveHeader {...args} leadingAction="back" />
      <div className="h-[48rem] px-4 py-8 text-sm text-muted-foreground">Scroll to collapse the header.</div>
    </div>
  ),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}

export const TitleAndHeading: Story = {
  args: { title: 'Product brief', heading: 'Welcome to Writin' },
  render: (args) => <AutosaveHeader {...args} />,
}

export const TitleOnly: Story = { args: { title: 'Welcome to Writin', heading: undefined }, render: (args) => <AutosaveHeader {...args} /> }

export const HeadingOnly: Story = { args: { title: undefined, heading: 'Welcome to Writin' }, render: (args) => <AutosaveHeader {...args} /> }

export const StandardPage: Story = {
  args: {
    title: 'Home',
    breadcrumbs: [],
    centerLeftActions: [],
    shareAction: false,
    favoriteAction: false,
    toolbar: undefined,
    segmentControl: undefined,
  },
}

export const LongContent: Story = {
  args: {
    title: 'A very long document title that must remain usable on narrow screens',
    breadcrumbs: [
      { label: 'Home', onPress: noop },
      { label: 'Research projects', onPress: noop },
      { label: 'Quarterly planning', onPress: noop },
      { label: 'A very long document title' },
    ],
  },
  render: (args) => <AutosaveHeader {...args} />,
}
