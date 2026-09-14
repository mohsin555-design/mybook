import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { InternetIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { getBookmarkMetadata } from '../../services/bookmarkMetadata'
import { Card, CardAction, CardContent } from '../ui/card'
import { LinkBlockActions } from './LinkBlockActions'

export function BookmarkBlockNodeView({ editor, getPos, node, selected, updateAttributes }: NodeViewProps) {
  const href = String(node.attrs.href ?? '')
  const title = String(node.attrs.title ?? '') || href
  const domain = String(node.attrs.domain ?? '') || domainFromHref(href)
  const description = String(node.attrs.description ?? '')
  const image = String(node.attrs.image ?? '')
  const isMention = node.attrs.appearance === 'mention'
  const siteName = String(node.attrs.siteName ?? '')
  const websiteName = siteName || domain
  const thumbnail = isMention ? (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '') : image
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  useEffect(() => {
    let active = true
    void getBookmarkMetadata(href).then((metadata) => {
      if (active && metadata && (metadata.title !== title || metadata.description !== description || metadata.image !== image || (metadata.siteName && metadata.siteName !== siteName))) updateAttributes(metadata)
    })
    return () => { active = false }
  }, [href, title, description, image, siteName, updateAttributes])
  const open = () => {
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className="mybook-link-node-view"
      contentEditable={false}
    >
      <Card size="sm" className={`mybook-bookmark-block ${isMention ? 'mybook-mention-block' : ''} rounded-[10px] py-0 gap-0 ring-0 shadow-none data-[size=sm]:[--card-spacing:0px] ${selected ? 'ProseMirror-selectednode' : ''}`}>
        <CardContent className="mybook-bookmark-content px-0">
          <button type="button" className="mybook-bookmark-card" onClick={open} aria-label={`Open ${title}`}>
            <span className="mybook-bookmark-logo" aria-hidden="true">
              {!thumbnail || loadedImage !== thumbnail || failedImage === thumbnail ? <HugeiconsIcon icon={InternetIcon} strokeWidth={1.5} className="size-6" /> : null}
              {thumbnail && failedImage !== thumbnail ? <img key={thumbnail} src={thumbnail} alt="" referrerPolicy="no-referrer" className={loadedImage === thumbnail ? 'is-loaded' : ''} onLoad={() => setLoadedImage(thumbnail)} onError={() => setFailedImage(thumbnail)} /> : null}
            </span>
            <span className="mybook-bookmark-body">
              {isMention ? <>
                <span className="mybook-mention-name" title={websiteName}>{websiteName}</span>
                <span className="mybook-mention-title" title={title}>{title}</span>
              </> : <>
                <span className="mybook-bookmark-title">{title}</span>
                {description ? <span className="mybook-bookmark-description" title={description}>{description}</span> : null}
                <span className="mybook-bookmark-domain" title={href}>{href}</span>
              </>}
            </span>
          </button>
        </CardContent>
        <CardAction className="mybook-link-card-action-slot">
          <LinkBlockActions
            editor={editor}
            getPos={getPos}
            metadata={{ kind: isMention ? 'mention' : 'bookmark', url: href, title, domain, description }}
            node={node}
            onOpen={open}
          />
        </CardAction>
      </Card>
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
