import { ArrowExpandIcon, ArrowShrink02Icon, CopyIcon, Copy02Icon, Refresh01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

import { getBookmarkMetadata } from '../../services/bookmarkMetadata'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { enterVideoFullscreen } from './videoFullscreen'
import { copyEmbedToClipboard } from './embedClipboard'
import { LinkBlockActions } from './LinkBlockActions'

export function EmbedBlockNodeView({ editor, getPos, node, selected, updateAttributes }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const embedUrl = String(node.attrs.embedUrl ?? '')
  const title = String(node.attrs.title ?? '') || 'Embedded content'
  const description = String(node.attrs.description ?? '')
  const provider = String(node.attrs.provider ?? 'embed')
  const isVideo = provider === 'youtube' || provider === 'vimeo'
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])
  const [menuOpen, setMenuOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const exitFullscreenRef = useRef<HTMLButtonElement>(null)
  const [pageFullscreen, setPageFullscreen] = useState(false)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setPageFullscreen(Boolean(cardRef.current && document.fullscreenElement === cardRef.current))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])
  useEffect(() => {
    if (pageFullscreen) exitFullscreenRef.current?.focus()
  }, [pageFullscreen])
  const enterPageFullscreen = async () => {
    try {
      if (!cardRef.current?.requestFullscreen) throw new Error('Fullscreen unavailable')
      await cardRef.current.requestFullscreen()
      setFullscreenFailed(false)
    } catch {
      setFullscreenFailed(true)
    }
  }
  const exitPageFullscreen = async () => {
    try {
      await document.exitFullscreen()
      setFullscreenFailed(false)
    } catch {
      setFullscreenFailed(true)
    }
  }
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [fullscreenFailed, setFullscreenFailed] = useState(false)
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

  const actions = (
    <>
            <Button type="button" variant="ghost" size="icon-sm" className="mybook-image-toolbar-button" aria-label={isVideo ? 'Reload video' : 'Reload'} title="Reload" onClick={() => setIframeKey((key) => key + 1)}>
              <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="mybook-image-toolbar-button" aria-label="Full screen" title="Full screen" onClick={async () => {
              if (isVideo) setFullscreenFailed(!await enterVideoFullscreen(iframeRef.current))
              else await enterPageFullscreen()
            }}>
              <HugeiconsIcon icon={ArrowExpandIcon} strokeWidth={2} className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="mybook-image-toolbar-button" aria-label={copied ? 'Copied' : 'Copy block'} title={copied ? 'Copied' : 'Copy block'} onClick={async () => {
              const success = await copyEmbedToClipboard(node)
              setCopied(success)
              setCopyFailed(!success)
            }}>
              <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="mybook-image-toolbar-button" aria-label="Duplicate" title="Duplicate" onClick={() => {
              const pos = getPos()
              if (pos !== undefined) editor.commands.insertContentAt(pos + node.nodeSize, node.toJSON())
            }}>
              <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" />
            </Button>
            <LinkBlockActions editor={editor} getPos={getPos} metadata={{ kind: 'embed', url, title, domain: provider, description }} node={node} onOpen={open} embedToolbar onMenuOpenChange={setMenuOpen} />
    </>
  )

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className="mybook-link-node-view"
      contentEditable={false}
    >
      <Card ref={cardRef} size="sm" data-page-fullscreen={pageFullscreen || undefined} data-menu-open={menuOpen} className={`${isVideo ? 'mybook-video-embed' : ''} mybook-embed-block rounded-[10px] py-0 gap-0 ring-0 shadow-none data-[size=sm]:[--card-spacing:0px] ${selected ? 'ProseMirror-selectednode' : ''}`}>
        {isVideo ? (
          <div className="mybook-image-block-toolbar">
            {actions}
          </div>
        ) : <CardHeader className="mybook-embed-card-header rounded-t-none !px-4 !py-2.5">
          <CardTitle className="mybook-embed-card-title">
            <button type="button" className="mybook-embed-title" onClick={open}>{title}</button>
            {description ? <div className="mybook-embed-description" title={description}>{description}</div> : null}
          </CardTitle>
          <CardAction className="mybook-embed-header-actions">
            {pageFullscreen ? (
              <Button ref={exitFullscreenRef} type="button" variant="ghost" size="icon-sm" aria-label="Exit fullscreen" title="Exit fullscreen" onClick={() => { void exitPageFullscreen() }}>
                <HugeiconsIcon icon={ArrowShrink02Icon} strokeWidth={2} className="size-4" />
              </Button>
            ) : actions}
          </CardAction>
        </CardHeader>}
        {copyFailed ? <p role="alert" className="px-3 text-xs text-destructive">Could not copy embed. Please try again.</p> : null}
        <CardContent className="mybook-embed-content">
          <div className="mybook-embed-frame">
            {embedUrl ? (
              <iframe
                ref={iframeRef}
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
        {fullscreenFailed ? <p role="alert">{isVideo ? "Fullscreen is unavailable. Try the player’s fullscreen control." : "Could not change fullscreen. Try again or use your browser’s fullscreen controls."}</p> : null}
      </Card>
    </NodeViewWrapper>
  )
}
