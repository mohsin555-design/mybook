import { NavLink } from 'react-router-dom'

import { navigationItems } from '../../utils/navigation'

export function MobileBottomNavigation() {
  return (
    <nav aria-label="Primary navigation" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 lg:hidden">
      <div className="pointer-events-auto mx-auto grid max-w-[22rem] grid-cols-4 gap-0.5 rounded-full bg-zinc-100 p-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex min-h-13 min-w-0 flex-col items-center justify-center gap-1.5 rounded-[2rem] px-1 py-2 text-xs font-medium transition-[background-color,box-shadow,color] ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-500 hover:text-zinc-900'
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
