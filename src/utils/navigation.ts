import type { NavigationItem } from '../types/navigation'

export const navigationItems: NavigationItem[] = [
  { label: 'Home', path: '/home', iconSrc: '/icons/house.svg' },
  { label: 'Library', path: '/folders', iconSrc: '/icons/folder-small.svg' },
  { label: 'Preferences', path: '/settings', iconSrc: '/icons/gear.svg' },
  { label: 'Search', path: '/search', iconSrc: '/icons/magnifier.svg' },
]
