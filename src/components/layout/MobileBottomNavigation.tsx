import { NavLink } from 'react-router-dom'

import { navigationItems } from '../../utils/navigation'

export function MobileBottomNavigation() {
  return (
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--app-border)] bg-[var(--app-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 text-xs font-medium sm:text-sm ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <item.icon aria-hidden="true" className="size-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
