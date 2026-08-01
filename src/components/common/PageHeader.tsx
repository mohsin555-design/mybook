import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  leading?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  eyebrow,
  leading,
  actions,
}: PageHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const scrollContainer = headerRef.current?.closest('main')
    if (!scrollContainer) return

    const updateShadow = () => setIsScrolled(scrollContainer.scrollTop > 0)
    updateShadow()
    scrollContainer.addEventListener('scroll', updateShadow, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', updateShadow)
  }, [])

  return (
    <header
      ref={headerRef}
      data-scrolled={isScrolled}
      className="sticky top-0 z-30 -mx-4 flex min-h-[calc(4.25rem+env(safe-area-inset-top))] items-start justify-between gap-4 bg-white px-4 pb-3 pt-[calc(1.5rem+env(safe-area-inset-top))] text-zinc-900 transition-shadow duration-200 data-[scrolled=true]:shadow-[0_4px_12px_rgba(17,24,39,0.10)] lg:mx-0 lg:min-h-11 lg:px-0 lg:pb-3 lg:pt-0"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-sm font-medium text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="truncate text-2xl font-bold leading-8">{title}</h1>
          {description ? (
            <p className="mt-1 hidden max-w-2xl text-base leading-7 text-muted sm:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
