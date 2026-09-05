import { DocumentTextIcon } from '@heroicons/react/24/outline'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { useDocumentLinkContext } from './DocumentLinkContext'
import { normalizeDocumentLinkAttrs } from './documentLinkModel'

export function DocumentLinkNodeView({ node, selected }: NodeViewProps) {
  const context = useDocumentLinkContext()
  const attrs = normalizeDocumentLinkAttrs(node.attrs)
  const target = attrs && context ? context.files.find((file) => file.id === attrs.targetId && file.type === 'document') : undefined
  const isUnavailable = !target || target.isDeleted
  const title = target && !target.isDeleted ? target.name : attrs?.label || 'Missing document'

  const open = () => {
    if (!attrs || isUnavailable) return
    context?.openDocument(attrs.targetId)
  }

  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      className={`mybook-document-link my-3 rounded-[8px] border bg-[var(--app-surface)] px-2 py-1.5 ${selected ? 'border-[var(--accent)] ring-2 ring-[var(--focus-ring)]' : 'border-transparent hover:border-[var(--app-border)]'}`}
      contentEditable={false}
    >
      <button
        type="button"
        onClick={open}
        disabled={!attrs || isUnavailable}
        aria-label={isUnavailable ? `${title} unavailable` : `Open document ${title}`}
        className={`flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${isUnavailable ? 'cursor-default text-muted-foreground' : 'text-foreground hover:bg-[var(--app-subtle)]'}`}
      >
        <DocumentTextIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-words font-medium">
          {title}
          {isUnavailable ? <span className="font-normal text-muted-foreground"> — unavailable</span> : null}
        </span>
      </button>
    </NodeViewWrapper>
  )
}
