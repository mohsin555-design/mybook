import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card'
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
      className="mybook-link-node-view"
      contentEditable={false}
    >
      <Card size="sm" className={`mybook-embed-block ${selected ? 'ProseMirror-selectednode' : ''}`}>
        <CardHeader className="mybook-embed-card-header">
          <CardTitle className="mybook-embed-card-title">
            <button type="button" className="mybook-embed-title" onClick={open}>{title}</button>
          </CardTitle>
          <CardAction className="mybook-link-card-action-slot">
            <LinkBlockActions
              editor={editor}
              getPos={getPos}
              metadata={{ kind: 'embed', url, title, domain: provider }}
              node={node}
              onOpen={open}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="mybook-embed-content">
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
        </CardContent>
      </Card>
    </NodeViewWrapper>
  )
}
