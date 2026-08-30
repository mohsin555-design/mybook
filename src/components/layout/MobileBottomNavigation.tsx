import { NavLink } from 'react-router-dom'

import { navigationItems } from '../../utils/navigation'

export function MobileBottomNavigation() {
  return (
    <nav aria-label="Primary navigation" className="shrink-0 bg-background px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:hidden">
      <div className="mx-auto grid max-w-[22rem] grid-cols-4 gap-0.5 rounded-full bg-muted p-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex min-h-13 min-w-0 flex-col items-center justify-center gap-1.5 rounded-[2rem] px-1 py-2 text-xs font-medium transition-[background-color,box-shadow,color] ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <img src={item.iconSrc} alt="" aria-hidden="true" className="size-4" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
