import type { Meta, StoryObj } from '@storybook/react-vite'

const colorTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
] as const

const appTokens = ['focus-ring', 'app-border', 'app-surface', 'app-subtle'] as const
const radiusTokens = ['radius', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'radius-2xl', 'radius-3xl', 'radius-4xl', 'radius-control', 'radius-surface', 'radius-dialog'] as const
const spacingScale = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

function TokenSwatch({ name }: { name: string }) {
  const value = cssVar(name)

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div
        className="h-14 rounded-md border border-[var(--app-border)]"
        style={{ background: `var(--${name})` }}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">--{name}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

function TokenValue({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] py-2 text-sm">
      <span className="font-medium">--{name}</span>
      <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{cssVar(name)}</code>
    </div>
  )
}

const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    docs: {
      description: {
        component: 'Live design-token reference sourced from the application CSS variables in `src/styles/globals.css`.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Colors: Story = {
  render: () => (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Theme colors</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {colorTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">App surface tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {appTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>
    </div>
  ),
}

export const RadiusAndTypography: Story = {
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Radius</h2>
        {radiusTokens.map((token) => (
          <div key={token} className="flex items-center gap-4 border-b border-[var(--app-border)] py-2">
            <div className="size-12 border border-primary bg-primary/10" style={{ borderRadius: `var(--${token})` }} />
            <TokenValue name={token} />
          </div>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Typography</h2>
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <p className="text-xs text-muted-foreground">--font-sans</p>
          <p className="mt-1 text-2xl font-semibold">{cssVar('font-sans')}</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            MyBook uses the same global font stack in Storybook as the production app.
          </p>
        </div>
      </section>
    </div>
  ),
}

export const Spacing: Story = {
  render: () => (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Tailwind spacing scale used by components</h2>
      {spacingScale.map((step) => (
        <div key={step} className="grid grid-cols-[4rem_1fr_5rem] items-center gap-4 text-sm">
          <code className="rounded bg-muted px-2 py-1 text-xs">{step}</code>
          <div className="h-4 rounded bg-primary" style={{ width: `calc(var(--spacing) * ${step})` }} />
          <span className="text-muted-foreground">var(--spacing) * {step}</span>
        </div>
      ))}
    </div>
  ),
}
