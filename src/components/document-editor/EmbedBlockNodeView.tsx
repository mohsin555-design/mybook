import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { getBookmarkMetadata } from '../../services/bookmarkMetadata'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card'
import { LinkBlockActions } from './LinkBlockActions'

export function EmbedBlockNodeView({ editor, getPos, node, selected, updateAttributes }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const embedUrl = String(node.attrs.embedUrl ?? '')
  const title = String(node.attrs.title ?? '') || 'Embedded content'
  const description = String(node.attrs.description ?? '')
  const provider = String(node.attrs.provider ?? 'embed')
  const [iframeKey, setIframeKey] = useState(0)
  useEffect(() => {
    let active = true
    void getBookmarkMetadata(url).then((metadata) => {
      if (active && metadata && (metadata.title !== title || metadata.description !== description)) updateAttributes({ title: metadata.title, description: metadata.description })
    })
    return () => { active = false }
  }, [url, title, description, updateAttributes])
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
      <Card size="sm" className={`mybook-embed-block rounded-[10px] py-0 gap-0 ring-0 shadow-none data-[size=sm]:[--card-spacing:0px] ${selected ? 'ProseMirror-selectednode' : ''}`}>
        <CardHeader className="mybook-embed-card-header rounded-t-none py-2 pl-3 pr-11 max-sm:pr-13">
          <CardTitle className="mybook-embed-card-title">
            <button type="button" className="mybook-embed-title" onClick={open}>{title}</button>
            {description ? <div className="mybook-embed-description" title={description}>{description}</div> : null}
          </CardTitle>
          <CardAction className="mybook-link-card-action-slot">
            <LinkBlockActions
              editor={editor}
              getPos={getPos}
              metadata={{ kind: 'embed', url, title, domain: provider, description }}
              node={node}
              onOpen={open}
              onReload={() => setIframeKey((key) => key + 1)}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="mybook-embed-content">
          <div className="mybook-embed-frame">
            {embedUrl ? (
              <iframe
                key={iframeKey}
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
