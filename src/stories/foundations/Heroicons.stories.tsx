import type { ComponentType, SVGProps } from 'react'
import * as OutlineIcons from '@heroicons/react/24/outline'
import * as SolidIcons from '@heroicons/react/24/solid'
import type { Meta, StoryObj } from '@storybook/react-vite'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

function IconGrid({ icons }: { icons: Record<string, IconComponent> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {Object.entries(icons).map(([name, Icon]) => (
        <div key={name} className="grid min-h-28 place-items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-center">
          <Icon aria-hidden="true" className="size-6 text-foreground" />
          <span className="max-w-full truncate text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  )
}

const outline = OutlineIcons as Record<string, IconComponent>
const solid = SolidIcons as Record<string, IconComponent>

const meta = { title: 'Foundations/Icons/Heroicons' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Outline: Story = { render: () => <IconGrid icons={outline} /> }
export const Solid: Story = { render: () => <IconGrid icons={solid} /> }
