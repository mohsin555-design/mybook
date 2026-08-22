import type { ComponentType, SVGProps } from 'react'

interface PagePlaceholderProps {
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="page-title">
      <div className="mb-5 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h1 id="page-title" className="text-2xl font-semibold sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </section>
  )
}
