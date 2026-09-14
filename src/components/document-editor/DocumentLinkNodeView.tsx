import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { useDocumentLinkContext } from './DocumentLinkContext'
import { normalizeDocumentLinkAttrs } from './documentLinkModel'

export function DocumentLinkNodeView({ node, selected }: NodeViewProps) {
  const context = useDocumentLinkContext()
  const attrs = normalizeDocumentLinkAttrs(node.attrs)
  const target = attrs && context ? context.files.find((file) => file.id === attrs.targetId && ['document', 'spreadsheet'].includes(file.type)) : undefined
  const isUnavailable = !target || target.isDeleted
  const title = target && !target.isDeleted ? target.name : attrs?.label || 'Missing page'
  const iconSrc = target?.type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'

  const open = () => {
    if (!attrs || isUnavailable) return
    context?.openDocument(attrs.targetId)
  }

  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      data-document-link-block="true"
      className={`mybook-document-link my-2 ${selected ? 'mybook-document-link-selected' : ''}`}
      contentEditable={false}
    >
      <button
        type="button"
        onClick={open}
        disabled={!attrs || isUnavailable}
        aria-label={isUnavailable ? `${title} unavailable` : `Open page ${title}`}
        className={`mybook-document-link-button ${isUnavailable ? 'cursor-default text-muted-foreground' : 'text-foreground'}`}
      >
        <img src={iconSrc} alt="" aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 break-words font-medium">
          {title}
          {isUnavailable ? <span className="font-normal text-muted-foreground"> — unavailable</span> : null}
        </span>
      </button>
    </NodeViewWrapper>
  )
}
