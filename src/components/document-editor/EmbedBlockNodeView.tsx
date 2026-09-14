import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { LinkBlockActions } from './LinkBlockActions'

export function EmbedBlockNodeView({ editor, getPos, node, selected }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const embedUrl = String(node.attrs.embedUrl ?? '')
  const title = String(node.attrs.title ?? '') || 'Embedded content'
  const provider = String(node.attrs.provider ?? 'embed')
  const open = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className={`mybook-embed-block ${selected ? 'ProseMirror-selectednode' : ''}`}
      contentEditable={false}
    >
      <div className="mybook-embed-card-header">
        <button type="button" className="mybook-embed-title" onClick={open}>{title}</button>
        <LinkBlockActions
          editor={editor}
          getPos={getPos}
          metadata={{ kind: 'embed', url, title, domain: provider }}
          node={node}
          onOpen={open}
        />
      </div>
      <div className="mybook-embed-frame">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button type="button" className="mybook-embed-fallback" onClick={open}>Open embedded content</button>
        )}
      </div>
    </NodeViewWrapper>
  )
}
