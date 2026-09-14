import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { LinkBlockActions } from './LinkBlockActions'

export function BookmarkBlockNodeView({ editor, getPos, node, selected }: NodeViewProps) {
  const href = String(node.attrs.href ?? '')
  const title = String(node.attrs.title ?? '') || href
  const domain = String(node.attrs.domain ?? '') || domainFromHref(href)
  const description = String(node.attrs.description ?? '')
  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : ''
  const open = () => {
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className={`mybook-bookmark-block ${selected ? 'ProseMirror-selectednode' : ''}`}
      contentEditable={false}
    >
      <button type="button" className="mybook-bookmark-card" onClick={open} aria-label={`Open ${title}`}>
        <span className="mybook-bookmark-logo" aria-hidden="true">
          {favicon ? <img src={favicon} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
          <span>{domain.slice(0, 1).toUpperCase() || 'L'}</span>
        </span>
        <span className="mybook-bookmark-body">
          <span className="mybook-bookmark-title">{title}</span>
          {description ? <span className="mybook-bookmark-description">{description}</span> : null}
          <span className="mybook-bookmark-domain">{domain || href}</span>
        </span>
      </button>
      <LinkBlockActions
        editor={editor}
        getPos={getPos}
        metadata={{ kind: 'bookmark', url: href, title, domain, description }}
        node={node}
        onOpen={open}
      />
    </NodeViewWrapper>
  )
}

function domainFromHref(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./u, '')
  } catch {
    return ''
  }
}
