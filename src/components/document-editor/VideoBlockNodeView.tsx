import {
  ArrowExpandIcon,
  CaptionsIcon,
  CaptionsOffIcon,
  Copy02Icon,
  CopyIcon,
  CopyLinkIcon,
  Delete02Icon,
  Download01Icon,
  LinkIcon,
  MoreHorizontalIcon,
  ReloadIcon,
  SquareArrowOutUpRightIcon,
  TextAlignCenterIcon,
  TextAlignEndIcon,
  TextAlignLeftIcon,
  Tick02Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useDeviceMode } from '../../hooks/useDeviceMode'
import { downloadVideo, parseVideoUrl } from './videoClipboard'
import { VideoBlockPicker } from './VideoBlockPicker'
import { VideoEditLinkPopover } from './VideoEditLinkPopover'
import { enterVideoFullscreen } from './videoFullscreen'

const MIN_WIDTH_PERCENT = 15
const MAX_WIDTH_PERCENT = 100

export function VideoBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const {
    src = '',
    alt = '',
    width = '100%',
    align = 'left',
    caption = '',
    showCaption = true,
    provider = 'html5',
  } = node.attrs

  // Older insertions accidentally stored the provider in the width attribute.
  const displayWidth = /^(?:html5|youtube|vimeo|embed)$/.test(width) ? '100%' : width || '100%'

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const { isTouch } = useDeviceMode()
  const [isAlignOpen, setIsAlignOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [fullscreenFailed, setFullscreenFailed] = useState(false)
  const [showReplacePicker, setShowReplacePicker] = useState(false)
  const [showEditLinkPopover, setShowEditLinkPopover] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)

  const isToolbarActive = isAlignOpen || isMoreOpen || showReplacePicker || showEditLinkPopover

  const resizeStateRef = useRef<{
    startX: number
    startWidthPx: number
    containerWidthPx: number
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  } | null>(null)

  // Copy timeout
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  // Copy link timeout
  useEffect(() => {
    if (!copiedLink) return
    const timer = window.setTimeout(() => setCopiedLink(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copiedLink])

  const keepEditorFocus = (event: MouseEvent | ReactPointerEvent) => event.preventDefault()

  // Resizing handlers
  const handleResizeStart = (
    event: ReactPointerEvent,
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const container = containerRef.current
    const wrapper = containerRef.current?.parentElement
    if (!container || !wrapper) return

    const containerRect = container.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()

    setIsResizing(true)
    resizeStateRef.current = {
      startX: event.clientX,
      startWidthPx: containerRect.width,
      containerWidthPx: wrapperRect.width,
      handle,
    }

    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const handleResizeMove = (event: ReactPointerEvent) => {
    if (!isResizing || !resizeStateRef.current) return

    const { startX, startWidthPx, containerWidthPx, handle } = resizeStateRef.current
    const deltaX = event.clientX - startX

    const isLeftHandle = handle === 'nw' || handle === 'sw' || handle === 'w'
    const adjustedDelta = isLeftHandle ? -deltaX : deltaX

    const newWidthPx = Math.max(80, startWidthPx + adjustedDelta)
    const newWidthPercent = Math.min(
      MAX_WIDTH_PERCENT,
      Math.max(MIN_WIDTH_PERCENT, Math.round((newWidthPx / containerWidthPx) * 100))
    )

    updateAttributes({ width: `${newWidthPercent}%` })
  }

  const handleResizeEnd = (event: ReactPointerEvent) => {
    if (!isResizing) return
    setIsResizing(false)
    resizeStateRef.current = null
    try {
      ;(event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
    } catch {
      // ignore
    }
  }

  // Open Replace popover
  const handleOpenReplace = (event?: MouseEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    setShowReplacePicker(true)
  }

  const handleReplaceVideo = (
    newSrc: string,
    newAlt: string,
    newProvider: 'html5' | 'youtube' | 'vimeo' | 'embed' = 'html5'
  ) => {
    updateAttributes({
      src: newSrc,
      alt: newAlt || alt,
      provider: newProvider,
    })
    setShowReplacePicker(false)
    editor.view.focus()
  }

  // Copy video URL to clipboard
  const handleCopy = async (event?: MouseEvent) => {
    if (event) {
      keepEditorFocus(event)
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(src)
        setCopied(true)
      }
    } catch {
      // ignore
    }
  }

  const handleDuplicate = () => {
    const pos = getPos()
    if (pos === undefined) return
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
  }

  const handleDownload = () => {
    downloadVideo(src, alt)
  }

  const handleDelete = () => {
    deleteNode()
  }

  const handleAddCaption = () => {
    setIsEditingCaption(true)
    updateAttributes({ showCaption: true })
    setTimeout(() => captionInputRef.current?.focus(), 50)
  }

  const handleToggleShowCaption = (event?: MouseEvent) => {
    event?.stopPropagation()
    updateAttributes({ showCaption: !showCaption })
  }

  const handleDeleteCaption = () => {
    setIsEditingCaption(false)
    updateAttributes({ caption: '', showCaption: false })
  }

  const handleCopySrcLink = async () => {
    if (!src || !isVideoFromLink) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(src)
        setCopiedLink(true)
      }
    } catch {
      // ignore
    }
  }

  const hasCaptionContent = Boolean(caption?.trim()) || isEditingCaption
  const isEmbed = provider === 'youtube' || provider === 'vimeo' || provider === 'embed'
  // Link-related menu items only make sense when the video came in via a URL (not file upload)
  const isVideoFromLink = Boolean(src && !src.startsWith('data:') && !src.startsWith('blob:'))

  // Alignment container classes
  const alignmentClass =
    align === 'left'
      ? 'items-start text-left'
      : align === 'right'
        ? 'items-end text-right'
        : 'items-center text-center'

  const alignIcon =
    align === 'left'
      ? TextAlignLeftIcon
      : align === 'right'
        ? TextAlignEndIcon
        : TextAlignCenterIcon

  return (
    <NodeViewWrapper
      as="figure"
      className={`mybook-video-block not-prose group/video relative my-4 flex flex-col select-none ${alignmentClass} ${
        selected ? 'ProseMirror-selectednode' : ''
      }`}
      data-type="video"
      data-align={align}
      data-caption={caption || undefined}
      data-show-caption={showCaption ? 'true' : 'false'}
      data-provider={provider}
      data-menu-open={isToolbarActive ? 'true' : 'false'}
    >
      <div className={`relative flex w-full flex-col ${alignmentClass}`}>
        <div
          ref={containerRef}
          className="relative inline-block max-w-full"
          style={{ width: displayWidth }}
        >
          {/* Action Toolbar */}
          <div
            ref={toolbarRef}
            contentEditable={false}
            data-testid="video-toolbar"
            data-state={isToolbarActive ? 'open' : 'closed'}
            className={`mybook-image-block-toolbar group-hover/video:opacity-100 group-hover/video:pointer-events-auto ${isToolbarActive ? 'is-open' : ''}`}
          >
            {/* Desktop Only: 1. Replace Video Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Replace video"
                title="Replace video"
                onClick={handleOpenReplace}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 2. Full Screen Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Full screen"
                title="Full screen"
                onClick={async () => setFullscreenFailed(!await enterVideoFullscreen(isEmbed ? iframeRef.current : videoRef.current))}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={ArrowExpandIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 3. Copy Video Link/Content */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copied ? 'Copied' : 'Copy block'}
                title={copied ? 'Copied' : 'Copy block'}
                onClick={handleCopy}
                className="mybook-image-toolbar-button"
              >
                {copied ? (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-primary" />
                ) : (
                  <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
                )}
              </Button>
            </div>

            {/* Desktop Only: 4. Align Dropdown */}
            <div className="mybook-desktop-only-action">
              <DropdownMenu open={isAlignOpen} onOpenChange={setIsAlignOpen}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Align video"
                      title="Align video"
                      className="mybook-image-toolbar-button"
                    />
                  }
                >
                  <HugeiconsIcon icon={alignIcon} strokeWidth={2} className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={6} className="min-w-36 rounded-xl p-1.5 shadow-lg">
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'left' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignLeftIcon} strokeWidth={2} className="size-4" />
                    <span>Left</span>
                    {align === 'left' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'center' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignCenterIcon} strokeWidth={2} className="size-4" />
                    <span>Center</span>
                    {align === 'center' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'right' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignEndIcon} strokeWidth={2} className="size-4" />
                    <span>Right</span>
                    {align === 'right' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 5. More Dropdown / Mobile Bottom Sheet */}
            <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More video options"
                    title="More options"
                    className="mybook-image-toolbar-button"
                  />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                bottomSheet={isTouch}
                align="end"
                sideOffset={6}
                className="min-w-56 rounded-xl p-1.5 shadow-lg"
              >
                {/* On mobile/touch, expose Replace, Fullscreen, Copy, and Alignment */}
                {isTouch ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        handleOpenReplace()
                        setIsMoreOpen(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Replace</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        setIsMoreOpen(false)
                        setFullscreenFailed(!await enterVideoFullscreen(isEmbed ? iframeRef.current : videoRef.current))
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={ArrowExpandIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Full screen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      closeOnClick={false}
                      onClick={() => {
                        void handleCopy()
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                      <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy video'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
                        updateAttributes({ align: nextAlign })
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={alignIcon} strokeWidth={2} className="size-4 shrink-0" />
                        <span>Align</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{align}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                {isVideoFromLink ? (
                  <DropdownMenuItem
                    onClick={() => {
                      window.open(src, '_blank', 'noopener,noreferrer')
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={SquareArrowOutUpRightIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">Open</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => {
                    handleDuplicate()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDownload()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Download</span>
                </DropdownMenuItem>
                {isVideoFromLink ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setShowEditLinkPopover(true)
                        setIsMoreOpen(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                      <span className="whitespace-nowrap">Edit link</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      closeOnClick={false}
                      onClick={() => {
                        void handleCopySrcLink()
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={copiedLink ? Tick02Icon : CopyLinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                      <span className="whitespace-nowrap">{copiedLink ? 'Copied' : 'Copy link'}</span>
                    </DropdownMenuItem>
                  </>
                ) : null}

                {hasCaptionContent ? (
                  <DropdownMenuItem
                    onClick={() => {
                      handleDeleteCaption()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center justify-between text-destructive focus:text-destructive whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={CaptionsOffIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Remove caption</span>
                    </div>
                    <button
                      type="button"
                      aria-label={showCaption ? 'Hide caption' : 'Show caption'}
                      title={showCaption ? 'Hide caption' : 'Show caption'}
                      onClick={(e) => {
                        handleToggleShowCaption(e)
                      }}
                      className="ml-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                    >
                      <HugeiconsIcon
                        icon={showCaption ? ViewIcon : ViewOffSlashIcon}
                        strokeWidth={2}
                        className="size-4"
                      />
                    </button>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      handleAddCaption()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={CaptionsIcon} strokeWidth={2} className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">Add caption</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    handleDelete()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Actual Video View */}
          {isEmbed ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/40 bg-black">
              <iframe
                ref={iframeRef}
                src={src}
                title={alt || 'Embedded video'}
                className="size-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={src}
              controls
              playsInline
              preload="metadata"
              aria-label={alt || 'Video player'}
              className={`mybook-video block w-full rounded-lg bg-black object-contain transition-shadow duration-150 ${
                selected ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
            />
          )}

          {/* 4 Corner and 2 Side Resize Handles */}
          <div
            role="slider"
            aria-label="Resize top left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'nw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-nw group-hover/video:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize top right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'ne')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-ne group-hover/video:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'se')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-se group-hover/video:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'sw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-sw group-hover/video:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'w')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-w group-hover/video:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'e')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-e group-hover/video:opacity-100"
          />

          {/* Inline Editable Caption */}
          {hasCaptionContent && showCaption ? (
            <figcaption className="mt-2 w-full text-left" contentEditable={false}>
              <input
                ref={captionInputRef}
                type="text"
                value={caption}
                onChange={(e) => updateAttributes({ caption: e.target.value })}
                onBlur={() => {
                  if (!caption.trim()) setIsEditingCaption(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    editor.view.focus()
                  }
                }}
                placeholder="Write a caption"
                aria-label="Video caption"
                className="w-full bg-transparent text-left text-xs text-muted-foreground placeholder:text-muted-foreground/60 outline-none hover:text-foreground focus:text-foreground border-b border-transparent focus:border-border transition-colors py-0.5"
              />
            </figcaption>
          ) : null}

          {/* Replace Video Popover */}
          {showReplacePicker ? (
            <VideoBlockPicker
              isInline
              title="Replace video"
              submitLabel="Replace"
              initialTab="embed"
              initialUrl={src.startsWith('data:') || src.startsWith('blob:') ? '' : src}
              onClose={() => setShowReplacePicker(false)}
              onInsert={handleReplaceVideo}
            />
          ) : null}

          {/* Edit link popover */}
          {showEditLinkPopover ? (
            <VideoEditLinkPopover
              initialUrl={src}
              onSave={(newUrl) => {
                const parsed = parseVideoUrl(newUrl)
                if (parsed) {
                  updateAttributes({ src: parsed.embedUrl, provider: parsed.provider })
                }
              }}
              onClose={() => setShowEditLinkPopover(false)}
            />
          ) : null}
        </div>
      </div>

      {fullscreenFailed ? <p role="alert">Fullscreen is unavailable. Try the player’s fullscreen control.</p> : null}
    </NodeViewWrapper>
  )
}
