import type { ComponentType, SVGProps } from 'react'

export interface NavigationItem {
  label: string
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}
