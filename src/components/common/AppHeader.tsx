import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  MoreHorizontalIcon,
  Share08Icon,
  SidebarLeft01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '../../lib/utils'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '../ui/popover'

export interface AppHeaderBreadcrumb {
  label: string
  onPress?: () => void
}

export interface AppHeaderAction {
  id: string
  icon: IconSvgElement
  label: string
  isActive?: boolean
  isDisabled?: boolean
  onPress?: () => void
}

export interface AppHeaderProps {
  title?: string
  heading?: string
  breadcrumbs?: AppHeaderBreadcrumb[]
  leadingAction?: 'sidebar' | 'back'
  onBack?: () => void
  onSidebarToggle?: () => void
  centerLeftActions?: AppHeaderAction[]
  status?: 'saving' | 'saved'
  shareAction?: boolean
  favoriteAction?: boolean
  moreAction?: boolean
  isFavorite?: boolean
  onShare?: () => void
  onFavorite?: () => void
  onMore?: () => void
  onRename?: (name: string) => void
  toolbar?: ReactNode
  segmentControl?: ReactNode
}

/** Responsive application header matching the expanded desktop/mobile and compact mobile scroll states. */
export function AppHeader({
  title,
  heading,
  breadcrumbs = [],
  leadingAction = 'sidebar',
  onBack,
  onSidebarToggle,
  centerLeftActions = [],
  status,
  shareAction = false,
  favoriteAction = false,
  moreAction = false,
  isFavorite = false,
  onShare,
  onFavorite,
  onMore,
  onRename,
  toolbar,
  segmentControl,
}: AppHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const currentPage = breadcrumbs.at(-1)
  const [renameValue, setRenameValue] = useState(currentPage?.label ?? '')
  const compactTitle = title || heading || breadcrumbs.at(-1)?.label || 'Page'
  const leadingHandler = leadingAction === 'back' ? onBack : onSidebarToggle

  useEffect(() => setRenameValue(currentPage?.label ?? ''), [currentPage?.label])

  useEffect(() => {
    const scrollContainer = headerRef.current?.closest<HTMLElement>('[data-app-header-scroll], main')
    const updateFromContainer = () => setIsCompact((scrollContainer?.scrollTop ?? 0) > 12)
    const updateFromWindow = () => setIsCompact(window.scrollY > 12)

    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
      updateFromContainer()
      scrollContainer.addEventListener('scroll', updateFromContainer, { passive: true })
      return () => scrollContainer.removeEventListener('scroll', updateFromContainer)
    }

    updateFromWindow()
    window.addEventListener('scroll', updateFromWindow, { passive: true })
    return () => window.removeEventListener('scroll', updateFromWindow)
  }, [])

  return (
    <header
      ref={headerRef}
      data-compact={isCompact}
      className="group/app-header sticky top-0 z-40 flex w-full flex-col gap-2 bg-background/95 px-4 py-3 text-foreground backdrop-blur data-[compact=true]:gap-0 md:gap-1 md:px-4 md:py-4"
    >
      <div className="flex w-full items-start gap-2 group-data-[compact=true]/app-header:items-center md:items-center md:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Go back"
          disabled={!onBack}
          onClick={onBack}
          className="rounded-lg md:hidden"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={leadingAction === 'back' ? 'Go back' : 'Open navigation'}
          disabled={!leadingHandler}
          onClick={leadingHandler}
          className="hidden rounded-lg md:inline-flex"
        >
          <HugeiconsIcon icon={leadingAction === 'back' ? ArrowLeft01Icon : SidebarLeft01Icon} strokeWidth={2} className="size-5" />
        </Button>

        <div className="hidden min-w-0 flex-1 group-data-[compact=true]/app-header:block md:hidden">
          <p className="truncate text-sm font-bold leading-5">{compactTitle}</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 group-data-[compact=true]/app-header:hidden md:flex md:flex-row md:items-center md:gap-3 md:group-data-[compact=true]/app-header:flex">
          <div className="min-w-0">
            {breadcrumbs.length ? (
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((breadcrumb, index) => {
                    const isCurrent = index === breadcrumbs.length - 1
                    const isCollapsed = breadcrumbs.length > 2 && index > 0 && index < breadcrumbs.length - 1
                    if (isCollapsed && index > 1) return null

                    return (
                      <Fragment key={`${breadcrumb.label}:${index}`}>
                        {index ? <BreadcrumbSeparator /> : null}
                        <BreadcrumbItem>
                          {isCollapsed ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<button type="button" aria-label="More breadcrumbs" />}>
                                <BreadcrumbEllipsis />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {breadcrumbs.slice(1, -1).map((hiddenBreadcrumb, hiddenIndex) => (
                                  <DropdownMenuItem
                                    key={`${hiddenBreadcrumb.label}:${hiddenIndex}`}
                                    disabled={!hiddenBreadcrumb.onPress}
                                    onClick={hiddenBreadcrumb.onPress}
                                  >
                                    {hiddenBreadcrumb.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : isCurrent ? (
                            <Popover open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                              <PopoverTrigger
                                render={<button type="button" aria-label={`Rename ${breadcrumb.label}`} />}
                                className="font-normal text-foreground transition-colors hover:text-foreground"
                              >
                                {breadcrumb.label}
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64 gap-3 rounded-xl p-3">
                                <PopoverHeader><PopoverTitle>Rename file</PopoverTitle></PopoverHeader>
                                <form
                                  className="flex gap-2"
                                  onSubmit={(event) => {
                                    event.preventDefault()
                                    const nextName = renameValue.trim()
                                    if (nextName) onRename?.(nextName)
                                    setIsRenameOpen(false)
                                  }}
                                >
                                  <Input aria-label="File name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
                                  <Button type="submit" size="sm">Save</Button>
                                </form>
                              </PopoverContent>
                            </Popover>
                          ) : breadcrumb.onPress ? (
                            <BreadcrumbLink render={<button type="button" />} onClick={breadcrumb.onPress}>
                              {breadcrumb.label}
                            </BreadcrumbLink>
                          ) : <BreadcrumbLink>{breadcrumb.label}</BreadcrumbLink>}
                        </BreadcrumbItem>
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}

            {title ? <h1 className="truncate text-sm font-bold leading-5 tracking-tight md:text-2xl md:leading-7">{title}</h1> : null}
            {heading ? title ? (
              <h2 className="truncate text-sm font-semibold leading-5 text-muted-foreground md:text-lg md:leading-6">{heading}</h2>
            ) : (
              <h1 className="truncate text-sm font-bold leading-5 tracking-tight md:text-2xl md:leading-7">{heading}</h1>
            ) : null}
          </div>

          {centerLeftActions.length ? (
            <div className="hidden shrink-0 items-center gap-1 md:flex" aria-label="Page actions">
              {centerLeftActions.map((action) => (
                <Button key={action.id} type="button" variant="ghost" size="icon-sm" aria-label={action.label} aria-pressed={action.isActive} disabled={action.isDisabled} onClick={action.onPress} className={cn('rounded-lg', action.isActive && 'bg-muted text-foreground')}>
                  <HugeiconsIcon icon={action.icon} strokeWidth={2} className="size-4" />
                </Button>
              ))}
            </div>
          ) : null}

          {status ? (
            <div className="flex h-7 shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
              <HugeiconsIcon icon={status === 'saving' ? Loading03Icon : CheckmarkCircle02Icon} strokeWidth={2} className={cn('size-4', status === 'saving' && 'animate-spin')} />
              <span>{status === 'saving' ? 'Saving…' : 'Saved'}</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1" aria-label="Header actions">
          {shareAction ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Share" onClick={onShare} className="rounded-lg"><HugeiconsIcon icon={Share08Icon} strokeWidth={2} className="size-4" /></Button> : null}
          {favoriteAction ? <Button type="button" variant="ghost" size="icon-sm" aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite} onClick={onFavorite} className={cn('rounded-lg', isFavorite && 'bg-muted text-foreground')}><HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-4" /></Button> : null}
          {moreAction ? <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions" onClick={onMore} className="rounded-lg"><HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" /></Button> : null}
        </div>
      </div>

      {toolbar ? <div className="min-w-0 overflow-x-auto group-data-[compact=true]/app-header:hidden">{toolbar}</div> : null}
      {segmentControl ? <div className="min-w-0 overflow-x-auto group-data-[compact=true]/app-header:hidden">{segmentControl}</div> : null}
    </header>
  )
}
