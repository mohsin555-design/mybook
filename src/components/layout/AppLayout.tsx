import {
  BookOpenIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { navigationItems } from '../../utils/navigation'
import { IconButton } from '../common/IconButton'
import { PwaStatus } from '../common/PwaStatus'
import { MobileBottomNavigation } from './MobileBottomNavigation'

export function AppLayout() {
  const { theme, toggleTheme } = useAppStore()
  const { email, isAuthenticated } = useAuthStore()
  useDriveBootstrap()
  const { pathname } = useLocation()
  const isEditor = pathname.startsWith('/document/') || pathname.startsWith('/spreadsheet/')

  return (
    <div className="flex h-dvh min-h-[480px] flex-col overflow-hidden bg-background text-foreground">
      <PwaStatus />
      {!isEditor ? <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--app-border)] bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <NavLink to="/home" className="flex items-center gap-2 font-semibold">
            <BookOpenIcon aria-hidden="true" className="size-7 text-accent" />
            <span className="text-lg">MyBook</span>
          </NavLink>
          <div className="ml-auto flex items-center gap-2">
            <span className={`hidden max-w-[16rem] rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${isAuthenticated ? 'bg-success/10 text-success' : 'bg-default text-muted'}`}>
              {isAuthenticated ? `Signed in${email ? ` as ${email}` : ''}` : 'Not signed in'}
            </span>
            <IconButton
              label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              variant="ghost"
              onPress={toggleTheme}
            >
              {theme === 'light' ? (
                <MoonIcon className="size-5" />
              ) : (
                <SunIcon className="size-5" />
              )}
            </IconButton>
          </div>
        </div>
      </header> : null}

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1">
        <aside className={`${isEditor ? 'hidden' : 'hidden lg:flex'} w-60 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)] p-4`}>
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted hover:bg-default hover:text-foreground'
                  }`
                }
              >
                <item.icon aria-hidden="true" className="size-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/trash" className={({ isActive }) => `mt-auto flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted hover:bg-default hover:text-foreground'}`}><TrashIcon aria-hidden="true" className="size-5" />Trash</NavLink>
        </aside>

        <main className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8 ${isEditor ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8'}`}>
          <div className={isEditor ? 'w-full' : 'mx-auto w-full max-w-6xl'}>
            <Outlet />
          </div>
        </main>
      </div>
      {!isEditor ? <MobileBottomNavigation /> : null}
    </div>
  )
}
