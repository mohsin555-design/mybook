import { useEffect, useState } from 'react'
import { Delete02Icon, File01Icon, Folder01Icon, HelpCircleIcon, Home01Icon, Logout01Icon, Moon01Icon, MoreHorizontalIcon, Search01Icon, Settings01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { useLibraryData } from '../../hooks/useLibraryData'
import { activeFavoriteItems } from '../../utils/favorites'
import { IconButton } from '../common/IconButton'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
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
  SidebarTrigger,
} from '../ui/sidebar'
import { MobileBottomNavigation } from './MobileBottomNavigation'

export function AppLayout() {
  const { theme, toggleTheme } = useAppStore()
  const { email, displayName: accountDisplayName, isAuthenticated, logout } = useAuthStore()
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const { files, folders } = useLibraryData()
  useDriveBootstrap()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isEditor = pathname.startsWith('/document/') || pathname.startsWith('/spreadsheet/')
  const favorites = activeFavoriteItems(files, folders)
  const sidebarFavorites = favorites.slice(0, 5)
  const recentFiles = files.filter((file) => !file.isDeleted).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const isLocalWorkspace = workspaceMode === 'local' || !isAuthenticated
  const displayName = isLocalWorkspace ? 'Local workspace' : accountDisplayName || email || 'Google account'
  const profileEmail = isLocalWorkspace ? null : email
  const initials = isLocalWorkspace ? 'LW' : displayName.split(/\s+/u).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const navigateToSearch = () => {
    navigate(searchQuery.trim() ? `/search?query=${encodeURIComponent(searchQuery.trim())}` : '/search')
    setSearchOpen(false)
  }
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const searchResults = normalizedSearchQuery
    ? [
        ...files.filter((file) => !file.isDeleted && file.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type })),
        ...folders.filter((folder) => !folder.isDeleted && folder.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((folder) => ({ kind: 'folder' as const, id: folder.id, name: folder.name, type: 'folder' as const })),
      ].slice(0, 8)
    : recentFiles.map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type }))
  const openSearchResult = (result: (typeof searchResults)[number]) => {
    setSearchOpen(false)
    navigate(result.kind === 'folder' ? `/folders/${result.id}` : `/${result.type}/${result.id}`)
  }

  useEffect(() => {
    const openSearchWithShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchQuery('')
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearchWithShortcut)
    return () => window.removeEventListener('keydown', openSearchWithShortcut)
  }, [])

  return (
    <SidebarProvider className="h-full min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background" aria-hidden="true">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</p>
              {profileEmail ? <p className="truncate text-xs text-sidebar-foreground/60">{profileEmail}</p> : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" />} aria-label="Account options" title="Account options" className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={() => void logout()}><HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="px-2 pb-2">
            <label className="sr-only" htmlFor="sidebar-search">Search</label>
            <div className="relative">
              <button type="button" id="sidebar-search" aria-label="Open search" onClick={() => setSearchOpen(true)} className="flex h-11 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-white px-3 pl-9 text-left text-sm text-slate-500 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white dark:text-slate-500">
                <span className="pointer-events-none absolute ml-[-1.5rem]"><HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" /></span>
                <span>Search</span>
                <kbd className="pointer-events-none ml-auto rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
              </button>
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] text-sidebar-foreground/60">⌘K</kbd>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/home" />} isActive={pathname === '/home'} size="lg" tooltip="Home"><HugeiconsIcon icon={Home01Icon} strokeWidth={2} /><span>Home</span></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/folders" />} isActive={pathname === '/folders' || pathname.startsWith('/folders/')} size="lg" tooltip="Library"><HugeiconsIcon icon={Folder01Icon} strokeWidth={2} /><span>Library</span></SidebarMenuButton></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentFiles.map((file) => <SidebarMenuItem key={`recent:${file.id}`}><SidebarMenuButton render={<NavLink to={`/${file.type}/${file.id}`} />} isActive={pathname === `/${file.type}/${file.id}`} tooltip={file.name}><HugeiconsIcon icon={File01Icon} strokeWidth={2} /><span>{file.name}</span></SidebarMenuButton></SidebarMenuItem>)}
                {files.filter((file) => !file.isDeleted).length > 5 ? <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/home" />} tooltip="View more recent documents"><HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} /><span className="font-semibold">View more</span></SidebarMenuButton></SidebarMenuItem> : null}
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
                        <HugeiconsIcon icon={favorite.kind === 'folder' ? Folder01Icon : File01Icon} strokeWidth={2} />
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
            <SidebarMenuItem><div className="flex items-center justify-between px-3 py-2 text-sm text-sidebar-foreground"><span className="flex items-center gap-2"><HugeiconsIcon icon={Sun01Icon} strokeWidth={2} className="size-4" />Theme</span><div className="flex rounded-lg bg-sidebar-accent p-0.5"><button type="button" aria-label="Use light theme" aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()} className={`rounded-md px-2 py-1 text-xs ${theme === 'light' ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/60'}`}>Light</button><button type="button" aria-label="Use dark theme" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()} className={`rounded-md px-2 py-1 text-xs ${theme === 'dark' ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/60'}`}>Dark</button></div></div></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/settings" />} isActive={pathname === '/settings'} tooltip="Preferences"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /><span>Preferences</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/settings" />} tooltip="Help"><HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} /><span>Help</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/trash" />} isActive={pathname === '/trash'} size="lg" tooltip="Trash"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} /><span>Trash</span></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 hidden shrink-0 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur md:block">
          <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
            <SidebarTrigger aria-label="Open navigation" title="Open navigation" className="hidden md:inline-flex" />
            <div className="ml-auto flex items-center gap-2">
              <IconButton
                label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                variant="ghost"
                onPress={toggleTheme}
                className="hidden md:inline-flex"
              >
                {theme === 'light' ? (
                  <HugeiconsIcon icon={Moon01Icon} strokeWidth={2} className="size-5" />
                ) : (
                  <HugeiconsIcon icon={Sun01Icon} strokeWidth={2} className="size-5" />
                )}
              </IconButton>
            </div>
          </div>
        </header>

        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-background ${isEditor ? 'p-0' : 'px-0 pb-4 md:px-8 md:pb-8 md:pt-6'}`}>
          <div className={isEditor ? 'h-full w-full' : 'mx-auto w-full max-w-6xl'}>
            <Outlet />
          </div>
        </main>
        {!isEditor ? <MobileBottomNavigation /> : null}
      </SidebarInset>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl gap-4 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search your documents and folders.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); navigateToSearch() }}>
            <label className="sr-only" htmlFor="global-search">Search documents and folders</label>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input id="global-search" autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents and folders..." className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-500 dark:bg-white dark:text-slate-900" />
            </div>
          </form>
          <div className="max-h-80 overflow-y-auto">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{normalizedSearchQuery ? 'Results' : 'Recent'}</p>
            {searchResults.length ? (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button key={`${result.kind}:${result.id}`} type="button" onClick={() => openSearchResult(result)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <HugeiconsIcon icon={result.kind === 'folder' ? Folder01Icon : File01Icon} strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{result.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={1.8} className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try a different document or folder name.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
