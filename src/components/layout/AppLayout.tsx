import {
  BookOpenIcon,
  DocumentTextIcon,
  FolderIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { useLibraryData } from '../../hooks/useLibraryData'
import { activeFavoriteItems } from '../../utils/favorites'
import { navigationItems } from '../../utils/navigation'
import { IconButton } from '../common/IconButton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '../ui/sidebar'
import { MobileBottomNavigation } from './MobileBottomNavigation'

export function AppLayout() {
  const { theme, toggleTheme } = useAppStore()
  const { email, isAuthenticated } = useAuthStore()
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const { files, folders } = useLibraryData()
  useDriveBootstrap()
  const { pathname } = useLocation()
  const isEditor = pathname.startsWith('/document/') || pathname.startsWith('/spreadsheet/')
  const favorites = activeFavoriteItems(files, folders)
  const sidebarFavorites = favorites.slice(0, 5)

  if (isEditor) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <main className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain bg-background p-0">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <SidebarProvider className="h-full min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink to="/home" />}
                size="lg"
                tooltip="MyBook"
              >
                <BookOpenIcon aria-hidden="true" className="size-5 text-sidebar-primary" />
                <span className="font-semibold">MyBook</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      render={<NavLink to={item.path} />}
                      isActive={pathname === item.path}
                      size="lg"
                      tooltip={item.label}
                    >
                      <img src={item.iconSrc} alt="" aria-hidden="true" className="size-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Favorites</SidebarGroupLabel>
            {favorites.length > 5 ? (
              <SidebarGroupAction
                render={<NavLink to="/favorites" />}
                aria-label="See all favorites"
                title="See all favorites"
                className="aspect-auto h-6 w-auto px-2 text-xs"
              >
                More
              </SidebarGroupAction>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarFavorites.map((favorite) => {
                  const path = favorite.kind === 'folder'
                    ? `/folders/${favorite.item.id}`
                    : `/${favorite.item.type}/${favorite.item.id}`
                  const Icon = favorite.kind === 'folder' ? FolderIcon : DocumentTextIcon
                  const label = favorite.kind === 'folder'
                    ? `Open favorite folder ${favorite.item.name}`
                    : `Open favorite ${favorite.item.type} ${favorite.item.name}`

                  return (
                    <SidebarMenuItem key={`${favorite.kind}:${favorite.item.id}`}>
                      <SidebarMenuButton
                        render={<NavLink to={path} aria-label={label} />}
                        isActive={pathname === path}
                        tooltip={favorite.item.name}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        <span>{favorite.item.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink to="/trash" />}
                isActive={pathname === '/trash'}
                size="lg"
                tooltip="Trash"
              >
                <TrashIcon aria-hidden="true" className="size-5" />
                <span>Trash</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 hidden shrink-0 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur md:block">
          <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="ml-auto flex items-center gap-2">
              <span className={`hidden max-w-[16rem] rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${isAuthenticated || workspaceMode === 'local' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                {isAuthenticated ? `Signed in${email ? ` as ${email}` : ''}` : workspaceMode === 'local' ? 'Local workspace' : 'Not signed in'}
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
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-background px-0 pb-4 md:px-8 md:pb-8 md:pt-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
        <MobileBottomNavigation />
      </SidebarInset>
    </SidebarProvider>
  )
}
