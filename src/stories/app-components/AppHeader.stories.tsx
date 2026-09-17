import { Link03Icon, TextBoldIcon, TextItalicIcon, TextUnderlineIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import React, { useEffect, useRef, useState } from 'react'

import { AppHeader, type AppHeaderProps } from '../../components/common/AppHeader'
import { Button } from '../../components/ui/button'
import { DropdownMenuItem } from '../../components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'

const noop = () => undefined

function FormattingToolbar() {
  const [active, setActive] = useState<string[]>([])
  return (
    <div className="flex w-max items-center gap-1 bg-background">
      <Button size="sm" variant="secondary">Heading 1</Button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      {[
        { label: 'Bold', icon: TextBoldIcon },
        { label: 'Underline', icon: TextUnderlineIcon },
        { label: 'Italic', icon: TextItalicIcon },
        { label: 'Insert link', icon: Link03Icon },
      ].map(({ label, icon }) => (
        <Button key={label} size="icon-sm" variant="ghost" aria-label={label}
          aria-pressed={active.includes(label)}
          onClick={() => setActive((values) => values.includes(label) ? values.filter((value) => value !== label) : [...values, label])}>
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
        </Button>
      ))}
    </div>
  )
}

const toolbar = <FormattingToolbar />
const segmentControl = (
  <Tabs defaultValue="write" className="w-max min-w-full">
    <TabsList aria-label="Document views" className="w-max shrink-0">
      {['Write', 'Outline', 'Comments', 'Version history', 'Attachments', 'Activity'].map((label) => (
        <TabsTrigger key={label} value={label.toLowerCase()} className="shrink-0 px-4">{label}</TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
)

const commonArgs: AppHeaderProps = {
  title: 'Project brief',
  showTitle: false,
  breadcrumbs: [{ label: 'Home', onPress: noop }, { label: 'Documents', onPress: noop }, { label: 'Project brief' }],
  leadingAction: 'sidebar',
  onBack: noop,
  onSidebarToggle: noop,
  addNewAction: true,
  shareAction: false,
  favoriteAction: false,
  moreAction: false,
  onFavorite: noop,
  moreContent: <DropdownMenuItem onClick={noop}>Save now</DropdownMenuItem>,
  onRename: true,
  status: 'saved',
}

function InteractiveHeader({ cycleStatus = false, ...args }: AppHeaderProps & { cycleStatus?: boolean }) {
  const [status, setStatus] = useState(args.status)
  const [favorite, setFavorite] = useState(args.isFavorite)
  const [renamedTitle, setRenamedTitle] = useState<string>()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [activeActions, setActiveActions] = useState<string[]>([])
  useEffect(() => setStatus(args.status), [args.status])
  useEffect(() => setFavorite(args.isFavorite), [args.isFavorite])
  useEffect(() => setRenamedTitle(undefined), [args.title])
  useEffect(() => {
    if (!cycleStatus) return
    const timer = window.setInterval(() => setStatus((current) => current === 'saving' ? 'saved' : 'saving'), 1800)
    return () => window.clearInterval(timer)
  }, [cycleStatus])

  return (
    <>
      <AppHeader {...args} title={renamedTitle ?? args.title} status={status} isFavorite={favorite}
        centerLeftActions={args.centerLeftActions?.map((action) => ({ ...action, isActive: activeActions.includes(action.id), onPress: () => setActiveActions((values) => values.includes(action.id) ? values.filter((value) => value !== action.id) : [...values, action.id]) }))}
        breadcrumbs={args.breadcrumbs?.map((item, index, all) => index === all.length - 1 ? { ...item, label: renamedTitle ?? item.label } : { ...item, onPress: () => setMessage(`Opened ${item.label}`) })}
        onBreadcrumbRename={setRenamedTitle}
        onSidebarToggle={() => setNavigationOpen((open) => !open)}
        onBack={() => setMessage('Returned to Documents')}
        onFavorite={() => setFavorite((value) => !value)}
        moreContent={<DropdownMenuItem onClick={() => setStatus('saved')}>Save now</DropdownMenuItem>} />
      {navigationOpen ? <aside aria-label="Demo navigation" className="bg-muted p-4"><p>Documents</p><Button variant="ghost" onClick={() => setNavigationOpen(false)}>Close navigation</Button></aside> : null}
      {message ? <p role="status" className="px-4 py-2 text-sm">{message}</p> : null}
    </>
  )
}

function ScrollExample(args: AppHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <div data-app-header-scroll className="h-[100dvh] overflow-y-auto bg-background">
      <AppHeader {...args} showTitle={false} titleRef={titleRef} />
      <article className="px-6 py-12 md:px-16">
        <h1 ref={titleRef} className="text-3xl font-bold">{args.title}</h1>
        <p className="mt-4 text-muted-foreground">Scroll until this title reaches the header. Scroll back to reveal it again.</p>
        {Array.from({ length: 24 }, (_, index) => <p key={index} className="my-8 leading-7 text-muted-foreground">Section {index + 1} — Notes, ideas, and details for the project brief.</p>)}
      </article>
    </div>
  )
}

const meta = {
  title: 'App Components/App Header',
  component: AppHeader,
  tags: ['autodocs'],
  args: commonArgs,
  argTypes: {
    title: { control: 'text', description: 'The document / page title. Used in the compact scroll header on mobile and as the `<h1>` when `showTitle` is true.' },
    showTitle: { control: 'boolean', description: 'When `true`, renders the title as a large `<h1>` below the breadcrumbs on desktop. Useful for Page-style layouts.' },
    titleRef: { control: false, description: 'A ref attached to the in-content `<h1>`. When provided the header watches its position and shows the compact title on mobile once it scrolls behind the header.' },
    leadingAction: { control: 'inline-radio', options: ['sidebar', 'back', 'none'], description: '`sidebar` shows a hamburger on desktop and a back-arrow on mobile. `back` always shows an arrow. `none` hides the leading button entirely.' },
    breadcrumbs: { control: 'object', description: 'Ordered list of breadcrumb items. The last item is the current page. Pass an empty array to hide the breadcrumb trail.' },
    showCenterLeftActions: { control: 'boolean', description: 'Show or hide the entire center-left icon action group.' },
    centerLeftActions: { control: 'object', description: 'Icon buttons placed in the center-left zone (e.g. formatting shortcuts). Each item needs `id`, `icon`, `label` and an optional `onPress`.' },
    showTrailingActions: { control: 'boolean', description: 'Show or hide the entire trailing actions group (Add New, Share, Favorite, More + slot).' },
    addNewAction: { control: 'boolean', description: '**Trailing action.** Shows a (+) button that opens a dropdown to create a new Document. Defaults to `true`.' },
    shareAction: { control: 'boolean', description: '**Trailing action.** Shows a share button that opens a dialog to copy the current page URL.' },
    favoriteAction: { control: 'boolean', description: '**Trailing action.** Shows a star button. Controlled via `isFavorite` and `onFavorite`.' },
    moreAction: { control: 'boolean', description: '**Trailing action.** Shows a ••• button that opens a dropdown. Populate it via `moreContent`.' },
    isFavorite: { control: 'boolean', description: 'Whether the document is currently favorited. Passed to the Favorite button.' },
    status: { control: 'inline-radio', options: [undefined, 'saving', 'saved'], description: 'Autosave status indicator. Rendered **outside** the trailing actions group, separated by 12 px. `undefined` hides the indicator.' },
    trailingActionsSlot: { control: false, table: { disable: true }, description: 'Extra `ReactNode` rendered inside the trailing actions group after the four built-in icons. Use this for custom icon buttons.' },
    toolbar: { control: false, table: { disable: true }, description: 'A `ReactNode` rendered in a scrollable row below the main header row, aligned with the breadcrumb / title area.' },
    segmentControl: { control: false, table: { disable: true }, description: 'A `ReactNode` rendered in a scrollable row below the toolbar (or below the main row if no toolbar), aligned with the breadcrumb / title area.' },
    onBack: { control: false, table: { disable: true } },
    onSidebarToggle: { control: false, table: { disable: true } },
    onFavorite: { control: false, table: { disable: true } },
    moreContent: { control: false, table: { disable: true }, description: 'Dropdown menu items rendered inside the More (•••) dropdown.' },
    onRename: { control: 'boolean', description: 'When `true` (default), the last breadcrumb is a clickable button that opens a rename popover.' },
    onBreadcrumbRename: { control: false, table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    fullWidth: true,
    docs: {
      description: {
        component: `
**AppHeader** is the sticky top bar used across all document and page views.

## Structure

The header is divided into three horizontal zones:

| Zone | Description |
|---|---|
| **Leading Actions** | Sidebar toggle (desktop) / back arrow (mobile), or \`none\`. |
| **Center-left** | Breadcrumb trail + optional page title, then an optional group of icon buttons (\`centerLeftActions\`). |
| **Trailing Actions** | Four built-in icon buttons — **Add New**, **Share**, **Favorite**, **More** — plus an optional \`trailingActionsSlot\` for custom icons. Each is toggled via a \`boolean\` prop. |

A **Status** indicator (saving / saved) sits to the left of the trailing actions group, separated by 12 px. The four actions inside the group have an 8 px gap between them.

## Slot alignment

The optional \`toolbar\` and \`segmentControl\` rows are indented on desktop to align their leading edge with the breadcrumb / title content area (not the sidebar icon).

## Mobile scroll behaviour

When a \`titleRef\` is provided the header watches the in-content document title. On **mobile only** (< 768 px), once that title scrolls behind the header a compact one-line title appears inside the header. It disappears again when the original title scrolls back into view. This behaviour is intentionally suppressed on tablet and desktop.
        `.trim(),
      },
    },
  },
} satisfies Meta<typeof AppHeader>

export default meta
type Story = StoryObj<typeof meta>

// ─── Helper: section wrappers used only inside the Overview doc story ──────────
function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-8">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function PropRow({ name, type, defaultVal, description }: { name: string; type: string; defaultVal?: string; description: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-mono text-xs text-sky-600 dark:text-sky-400 whitespace-nowrap">{name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{type}</td>
      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{defaultVal ?? '—'}</td>
      <td className="py-2 text-sm text-foreground">{description}</td>
    </tr>
  )
}

export const Overview: Story = {
  name: '📖 Overview',
  parameters: {
    layout: 'padded',
    fullWidth: false,
    controls: { disable: true },
    docs: { disable: true },
  },
  render: () => (
    <div className="mx-auto max-w-3xl space-y-10 py-6 text-foreground">

      {/* Title */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">App Components</p>
        <h1 className="text-3xl font-bold tracking-tight">App Header</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          A sticky, responsive top bar used across all document and page views. It organises navigation, identity, and actions into three horizontal zones that adapt to context.
        </p>
      </div>

      {/* Anatomy */}
      <DocSection title="Anatomy">
        <p className="mb-4 text-sm text-muted-foreground">The header row is divided into three zones. Slot rows sit below it.</p>
        <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
          <AppHeader
            title="Project brief"
            breadcrumbs={[{ label: 'Home' }, { label: 'Documents' }, { label: 'Project brief' }]}
            leadingAction="sidebar"
            status="saved"
            addNewAction
            shareAction
            favoriteAction
            moreAction
          />
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center text-xs text-muted-foreground">
            <div className="p-2">① Leading Actions</div>
            <div className="p-2">② Center-left (breadcrumb + title + shortcuts)</div>
            <div className="p-2">③ Status · Trailing Actions</div>
          </div>
        </div>
      </DocSection>

      {/* Zones */}
      <DocSection title="The Three Zones">
        <div className="space-y-6">

          <div>
            <h3 className="mb-1 text-sm font-semibold">① Leading Actions</h3>
            <p className="text-sm text-muted-foreground">Controlled by <code className="rounded bg-muted px-1 py-0.5 text-xs">leadingAction</code>. On desktop the sidebar toggle is shown; on mobile it becomes a back arrow. Set to <code className="rounded bg-muted px-1 py-0.5 text-xs">"none"</code> to hide it entirely.</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <AppHeader title="Back layout" breadcrumbs={[{ label: 'Home' }, { label: 'Project brief' }]} leadingAction="back" addNewAction />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">② Center-left</h3>
            <p className="text-sm text-muted-foreground">Contains the breadcrumb trail, an optional large <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;h1&gt;</code> title (<code className="rounded bg-muted px-1 py-0.5 text-xs">showTitle</code>), and an optional group of icon shortcut buttons (<code className="rounded bg-muted px-1 py-0.5 text-xs">centerLeftActions</code>).</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <AppHeader
                title="Project brief"
                showTitle
                breadcrumbs={[{ label: 'Home' }, { label: 'Documents' }, { label: 'Project brief' }]}
                centerLeftActions={[
                  { id: 'bold', icon: TextBoldIcon, label: 'Toggle bold' },
                  { id: 'italic', icon: TextItalicIcon, label: 'Toggle italic' },
                ]}
                addNewAction
              />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">③ Status + Trailing Actions</h3>
            <p className="text-sm text-muted-foreground">
              The <strong>Status</strong> indicator (saving / saved) sits <em>outside</em> the Trailing Actions group with a 12 px gap between them.
              The four built-in icon buttons inside the group have an 8 px gap between them.
              An extra <code className="rounded bg-muted px-1 py-0.5 text-xs">trailingActionsSlot</code> can inject custom icons after the built-ins.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <AppHeader
                title="Project brief"
                breadcrumbs={[{ label: 'Home' }, { label: 'Project brief' }]}
                status="saving"
                addNewAction
                shareAction
                favoriteAction
                moreAction
              />
            </div>
          </div>
        </div>
      </DocSection>

      {/* Usage variants */}
      <DocSection title="Usage Variants">
        <div className="space-y-6">

          <div>
            <h3 className="mb-1 text-sm font-semibold">Editor layout</h3>
            <p className="text-sm text-muted-foreground mb-3">Breadcrumb visible, all trailing actions shown, autosave status present.</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <AppHeader
                title="Project brief"
                breadcrumbs={[{ label: 'Home', onPress: noop }, { label: 'Documents', onPress: noop }, { label: 'Project brief' }]}
                status="saved"
                addNewAction shareAction favoriteAction moreAction
              />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Page layout</h3>
            <p className="text-sm text-muted-foreground mb-3">No breadcrumb, large title shown, no status, only Add New visible.</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <AppHeader title="Settings" showTitle breadcrumbs={[]} addNewAction />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">With toolbar + segment control slots</h3>
            <p className="text-sm text-muted-foreground mb-3">Slot rows are indented on desktop so they align with the breadcrumb / title area, not the sidebar icon.</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <AppHeader
                title="Project brief"
                breadcrumbs={[{ label: 'Home' }, { label: 'Documents' }, { label: 'Project brief' }]}
                addNewAction shareAction favoriteAction moreAction
                toolbar={
                  <div className="flex w-max items-center gap-1 bg-background">
                    <Button size="sm" variant="secondary">Heading 1</Button>
                    <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                    {[{ label: 'Bold', icon: TextBoldIcon }, { label: 'Italic', icon: TextItalicIcon }].map(({ label, icon }) => (
                      <Button key={label} size="icon-sm" variant="ghost" aria-label={label}>
                        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
                      </Button>
                    ))}
                  </div>
                }
                segmentControl={
                  <Tabs defaultValue="write" className="w-max">
                    <TabsList>
                      {['Write', 'Outline', 'Comments'].map((label) => (
                        <TabsTrigger key={label} value={label.toLowerCase()} className="px-4">{label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                }
              />
            </div>
          </div>
        </div>
      </DocSection>

      {/* Props reference */}
      <DocSection title="Props Reference">

        <h3 className="mb-2 mt-0 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h3>
        <div className="overflow-x-auto rounded-lg border border-border mb-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Prop</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-border px-3">
              <PropRow name="title" type="string" description="Document / page title. Shown in the compact mobile header and as the <h1> when showTitle is true." />
              <PropRow name="showTitle" type="boolean" defaultVal="false" description="Render the title as a large <h1> below the breadcrumbs on desktop (Page layout)." />
              <PropRow name="titleRef" type="RefObject" description="Ref on the in-content <h1>. Enables the mobile-only compact scroll title." />
              <PropRow name="breadcrumbs" type="AppHeaderBreadcrumb[]" defaultVal="[]" description="Breadcrumb items. Last item is the current page. Empty array hides the trail." />
              <PropRow name="onRename" type="boolean" defaultVal="true" description="Makes the last breadcrumb a rename trigger (popover)." />
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Leading Actions</h3>
        <div className="overflow-x-auto rounded-lg border border-border mb-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Prop</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-border px-3">
              <PropRow name="leadingAction" type='"sidebar" | "back" | "none"' defaultVal='"sidebar"' description='Sidebar toggle on desktop / back arrow on mobile, always-back, or hidden.' />
              <PropRow name="onSidebarToggle" type="() => void" description="Called when the sidebar button is clicked." />
              <PropRow name="onBack" type="() => void" description="Called when the back button is clicked." />
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Center-left Actions</h3>
        <div className="overflow-x-auto rounded-lg border border-border mb-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Prop</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-border px-3">
              <PropRow name="showCenterLeftActions" type="boolean" defaultVal="true" description="Show or hide the entire center-left icon group." />
              <PropRow name="centerLeftActions" type="AppHeaderAction[]" defaultVal="[]" description="Icon shortcut buttons (id, icon, label, isActive, onPress)." />
              <PropRow name="toolbar" type="ReactNode" description="Scrollable toolbar row below the main row, aligned with the content area." />
              <PropRow name="segmentControl" type="ReactNode" description="Scrollable segment/tab row below the toolbar row." />
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status + Trailing Actions</h3>
        <div className="overflow-x-auto rounded-lg border border-border mb-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Prop</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-border px-3">
              <PropRow name="status" type='"saving" | "saved" | undefined' description="Autosave indicator. Sits outside the trailing group with a 12 px gap." />
              <PropRow name="showTrailingActions" type="boolean" defaultVal="true" description="Show or hide the entire trailing actions group." />
              <PropRow name="addNewAction" type="boolean" defaultVal="true" description="(+) button — opens a dropdown to create a new Document." />
              <PropRow name="shareAction" type="boolean" defaultVal="false" description="Share button — opens a link-copy dialog." />
              <PropRow name="favoriteAction" type="boolean" defaultVal="false" description="Star button — controlled via isFavorite + onFavorite." />
              <PropRow name="moreAction" type="boolean" defaultVal="false" description="••• button — opens a dropdown populated via moreContent." />
              <PropRow name="trailingActionsSlot" type="ReactNode" description="Extra custom icons injected after the four built-in trailing actions." />
            </tbody>
          </table>
        </div>
      </DocSection>

      {/* Notes */}
      <DocSection title="Implementation Notes">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>The <strong>compact mobile title</strong> only activates below <code className="rounded bg-muted px-1 py-0.5 text-xs">768 px</code> (Tailwind <code className="rounded bg-muted px-1 py-0.5 text-xs">md</code> breakpoint). On desktop it is always suppressed regardless of scroll.</li>
          <li>The <strong>Status</strong> element is rendered outside the Trailing Actions <code className="rounded bg-muted px-1 py-0.5 text-xs">role="group"</code> with a <code className="rounded bg-muted px-1 py-0.5 text-xs">gap-3</code> (12 px) separator. Items inside the group use <code className="rounded bg-muted px-1 py-0.5 text-xs">gap-2</code> (8 px).</li>
          <li><code className="rounded bg-muted px-1 py-0.5 text-xs">toolbar</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">segmentControl</code> rows are indented on <code className="rounded bg-muted px-1 py-0.5 text-xs">md+</code> by <code className="rounded bg-muted px-1 py-0.5 text-xs">2.5 rem</code> to align with the breadcrumb/title start edge.</li>
          <li>Breadcrumbs longer than 3 items automatically collapse middle items into a <strong>…</strong> dropdown.</li>
          <li>The last breadcrumb opens a <strong>rename popover</strong> by default (<code className="rounded bg-muted px-1 py-0.5 text-xs">onRename=true</code>). Set to <code className="rounded bg-muted px-1 py-0.5 text-xs">false</code> to make it a static label.</li>
        </ul>
      </DocSection>

    </div>
  ),
}

export const Editor: Story = {
  name: 'Editor',
  parameters: {
    docs: {
      description: {
        story: `
The **Editor** layout is used inside a document editing view. The breadcrumb trail is visible so the user always knows where they are. All four trailing actions — **Add New**, **Share**, **Favorite**, and **More** — are shown. An autosave **Status** indicator appears to the left of the actions.
        `.trim(),
      },
    },
  },
  args: {
    addNewAction: true,
    shareAction: true,
    favoriteAction: true,
    moreAction: true,
  },
}

export const Page: Story = {
  name: 'Page',
  parameters: {
    docs: {
      description: {
        story: `
The **Page** layout is used for non-editor content pages (dashboards, settings, etc.). The breadcrumb is hidden and the page title is shown as a large \`<h1>\`. No autosave status is needed, and by default only the **Add New** action is visible.
        `.trim(),
      },
    },
  },
  args: {
    showTitle: true,
    breadcrumbs: [],
    status: undefined,
    addNewAction: true,
    shareAction: false,
    favoriteAction: false,
    moreAction: false,
  },
}

export const WithSlots: Story = {
  name: 'With Slots',
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates all three action zones populated simultaneously:

- **Leading Actions** — sidebar toggle.
- **Center-left** — a formatting toolbar (\`toolbar\` slot), a tab segment control (\`segmentControl\` slot), and two icon shortcut buttons (\`centerLeftActions\`).
- **Trailing Actions** — all four built-in buttons visible (Add New, Favorite, Share, More).

The \`toolbar\` and \`segmentControl\` rows are indented on desktop so their leading edge aligns with the breadcrumb / title content, not the sidebar icon.

> **Tip:** Use \`trailingActionsSlot\` to inject additional custom icon buttons into the trailing actions group after the four built-in ones.
        `.trim(),
      },
    },
  },
  args: {
    showTitle: true,
    title: 'Project brief',
    toolbar,
    segmentControl,
    centerLeftActions: [
      { id: 'bold', icon: TextBoldIcon, label: 'Toggle bold', onPress: noop },
      { id: 'italic', icon: TextItalicIcon, label: 'Toggle italic', onPress: noop },
    ],
    addNewAction: true,
    favoriteAction: true,
    shareAction: true,
    moreAction: true,
  },
  render: (args) => <InteractiveHeader {...args} />,
}

export const ScrollBehavior: Story = {
  name: 'Scroll Behavior',
  parameters: {
    // Compact scroll title is mobile-only (< 768px). Default to a mobile
    // viewport so the behaviour is visible without manually switching devices.
    viewport: { defaultViewport: 'mobile2' },
    docs: {
      description: {
        story: `
**Mobile-only** scroll behaviour. Attach a \`titleRef\` to the in-content document \`<h1>\`. As the user scrolls down and that title passes behind the sticky header, a compact one-line title appears inside the header. When the original title scrolls back into view the compact title disappears.

> **Important:** This behaviour is gated behind \`window.innerWidth < 768\` (Tailwind's \`md\` breakpoint). On tablet and desktop the header never enters compact mode regardless of scroll position.

This story defaults to a **mobile viewport** (414 px). Switch to a larger viewport using the toolbar to confirm that compact mode is suppressed.
        `.trim(),
      },
    },
  },
  render: (args) => <ScrollExample {...args} />,
}

export const InteractiveControls: Story = {
  name: 'Interactive Controls',
  parameters: {
    docs: {
      description: {
        story: `
A fully wired-up interactive demo. Use the **Controls** panel to toggle every prop in real time.

Notable behaviours to try:
- Toggle **\`favoriteAction\`** on and change \`isFavorite\` to see the star fill.
- Toggle **\`shareAction\`** on and click Share to open the link-copy dialog.
- Toggle **\`moreAction\`** on and click ••• to open the dropdown.
- Switch **\`leadingAction\`** between \`sidebar\`, \`back\`, and \`none\`.
- Set **\`status\`** to \`saving\` to see the animated spinner, or \`saved\` for the cloud-check icon.
- The status cycles automatically between \`saving\` and \`saved\` every 1.8 s to demonstrate the animation.
        `.trim(),
      },
    },
  },
  args: {
    addNewAction: true,
    shareAction: true,
    favoriteAction: true,
    moreAction: true,
  },
  render: (args) => <InteractiveHeader {...args} cycleStatus />,
}
