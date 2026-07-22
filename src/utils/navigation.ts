import {
  Cog6ToothIcon,
  FolderIcon,
  HomeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

import type { NavigationItem } from '../types/navigation'

export const navigationItems: NavigationItem[] = [
  { label: 'Home', path: '/home', icon: HomeIcon },
  { label: 'Folders', path: '/folders', icon: FolderIcon },
  { label: 'Search', path: '/search', icon: MagnifyingGlassIcon },
  { label: 'Settings', path: '/settings', icon: Cog6ToothIcon },
]
