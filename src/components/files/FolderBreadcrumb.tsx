import { Fragment } from 'react'

import type { MyBookFolder } from '../../types/files'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'

interface FolderBreadcrumbProps {
  currentFolderId: string | null
  folders: MyBookFolder[]
  includeCurrent?: boolean
  currentPageLabel?: string
  onNavigate: (path: string) => void
}

export function FolderBreadcrumb({
  currentFolderId,
  folders,
  includeCurrent = true,
  currentPageLabel,
  onNavigate,
}: FolderBreadcrumbProps) {
  const path = currentFolderId ? getFolderPath(currentFolderId, folders) : []
  const hasCurrentPage = Boolean(currentPageLabel?.trim())

  return (
    <Breadcrumb aria-label="Folder path" className="max-w-full overflow-hidden">
      <BreadcrumbList className="max-w-full flex-nowrap overflow-x-auto whitespace-nowrap rounded-md pb-1 text-xs sm:text-sm">
        <BreadcrumbItem>
          {currentFolderId || hasCurrentPage ? (
            <BreadcrumbLink
              href="/folders"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/folders')
              }}
              className="inline-flex min-h-8 max-w-24 items-center rounded-md px-1.5 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:max-w-36"
            >
              Library
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="inline-flex min-h-8 max-w-24 items-center truncate px-1.5 font-medium text-foreground sm:max-w-36">
              Library
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {path.map((folder, index) => {
          const isCurrent = !hasCurrentPage && includeCurrent && index === path.length - 1

          return (
            <Fragment key={folder.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {isCurrent ? (
                  <BreadcrumbPage className="inline-flex min-h-8 max-w-32 items-center truncate px-1.5 font-medium text-foreground sm:max-w-56">
                    {folder.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={`/folders/${folder.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      onNavigate(`/folders/${folder.id}`)
                    }}
                    className="inline-flex min-h-8 max-w-32 items-center rounded-md px-1.5 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:max-w-56"
                  >
                    <span className="truncate">{folder.name}</span>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
        {hasCurrentPage ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="inline-flex min-h-8 max-w-32 items-center truncate px-1.5 font-medium text-foreground sm:max-w-56">
                {currentPageLabel}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function getFolderPath(currentFolderId: string, folders: MyBookFolder[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: MyBookFolder[] = []
  const visited = new Set<string>()
  let cursor = byId.get(currentFolderId)

  while (cursor && !visited.has(cursor.id)) {
    path.unshift(cursor)
    visited.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }

  return path
}
