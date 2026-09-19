import {
  Cancel01Icon,
  Delete02Icon,
  Download01Icon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '../ui/button'
import { VideoBlockPicker } from './VideoBlockPicker'

export interface VideoFullscreenViewerProps {
  src: string
  alt?: string
  caption?: string
  provider?: 'html5' | 'youtube' | 'vimeo' | 'embed'
  onClose: () => void
  onReplace?: (
    newSrc: string,
    newAlt?: string,
    newProvider?: 'html5' | 'youtube' | 'vimeo' | 'embed'
  ) => void
  onDownload?: () => void
  onDelete?: () => void
}

export function VideoFullscreenViewer({
  src,
  alt = '',
  caption = '',
  provider = 'html5',
  onClose,
  onReplace,
  onDownload,
  onDelete,
}: VideoFullscreenViewerProps) {
  const [showReplacePicker, setShowReplacePicker] = useState(false)

  // Keyboard navigation (Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isEmbed = provider === 'youtube' || provider === 'vimeo' || provider === 'embed'

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video full screen preview"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/90 backdrop-blur-md select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top Bar: Title / Caption + Close Button */}
      <div className="flex w-full items-center justify-between px-6 py-4 text-white/90">
        <div className="min-w-0 max-w-lg truncate text-xs font-medium text-white/80">
          {caption || alt || 'Video'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close full screen"
            title="Close (Esc)"
            onClick={onClose}
            className="rounded-full text-white/80 hover:bg-white/15 hover:text-white size-7"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex flex-1 w-full items-center justify-center overflow-hidden p-6">
        {isEmbed ? (
          <iframe
            src={src}
            title={alt || 'Video'}
            className="w-[85vw] max-w-4xl aspect-video rounded-xl shadow-2xl border border-white/10"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[80vh] max-w-[88vw] rounded-xl shadow-2xl border border-white/10"
          />
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="flex flex-col items-center gap-3 pb-6 relative">
        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-neutral-900/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-lg text-white">
          {/* Replace Button */}
          {onReplace ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Replace video"
              title="Replace video"
              onClick={() => setShowReplacePicker((prev) => !prev)}
              className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}

          {/* Download Button */}
          {onDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Download video"
              title="Download video"
              onClick={onDownload}
              className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}

          {/* Delete Button */}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete video"
              title="Delete video"
              onClick={() => {
                onClose()
                onDelete()
              }}
              className="rounded-full text-destructive hover:bg-destructive/20"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}
        </div>

        {/* Replace Video Popover rendered right above controls */}
        {showReplacePicker ? (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
            <VideoBlockPicker
              isInline
              className="relative z-50 w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.5)] outline-none"
              title="Replace video"
              submitLabel="Replace"
              initialTab={src.startsWith('data:') ? 'upload' : 'embed'}
              initialUrl={src.startsWith('data:') ? '' : src}
              onClose={() => setShowReplacePicker(false)}
              onInsert={(newSrc, newAlt, newProvider) => {
                onReplace?.(newSrc, newAlt, newProvider)
                setShowReplacePicker(false)
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
