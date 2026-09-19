import {
  Cancel01Icon,
  Delete02Icon,
  Download01Icon,
  MinusSignIcon,
  PlusSignIcon,
  Refresh01Icon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '../ui/button'
import { ImageBlockPicker } from './ImageBlockPicker'

export interface ImageFullscreenViewerProps {
  src: string
  alt?: string
  caption?: string
  onClose: () => void
  onReplace?: (newSrc: string, newAlt?: string) => void
  onDownload?: () => void
  onDelete?: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5.0
const SCALE_STEP = 0.25

export function ImageFullscreenViewer({
  src,
  alt = '',
  caption = '',
  onClose,
  onReplace,
  onDownload,
  onDelete,
}: ImageFullscreenViewerProps) {
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [showReplacePicker, setShowReplacePicker] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, Math.round((prev + SCALE_STEP) * 100) / 100))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Math.round((prev - SCALE_STEP) * 100) / 100)
      if (next <= 1) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomOut()
      } else if (event.key === '0') {
        event.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, zoomIn, zoomOut, resetZoom])

  // Mouse wheel zoom
  const handleWheel = (event: ReactWheelEvent) => {
    event.preventDefault()
    const delta = -event.deltaY * 0.0015
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta))
      if (next <= 1) setPan({ x: 0, y: 0 })
      return Math.round(next * 100) / 100
    })
  }

  // Pointer drag panning
  const handlePointerDown = (event: ReactPointerEvent) => {
    if (scale <= 1) return
    event.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!isDragging) return
    const dx = event.clientX - dragStartRef.current.x
    const dy = event.clientY - dragStartRef.current.y
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    })
  }

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      ;(event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
    } catch {
      // ignore
    }
  }

  const handleDoubleClick = () => {
    if (scale !== 1) {
      resetZoom()
    } else {
      setScale(2)
    }
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image full screen preview"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/90 backdrop-blur-md select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top Header Bar */}
      <div className="flex w-full items-center justify-between px-6 py-4 text-white/90">
        <div className="min-w-0 max-w-lg truncate text-xs font-medium text-white/80">
          {caption || alt || 'Image Preview'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close full screen"
            title="Close (Esc)"
            onClick={onClose}
            className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div
        className="relative flex flex-1 w-full items-center justify-center overflow-hidden p-6"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[80vh] max-w-[88vw] object-contain transition-transform duration-75 select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Bottom Floating Toolbar: Zoom Controls & Additional Actions */}
      <div className="flex flex-col items-center gap-3 pb-6">
        {caption ? (
          <p className="max-w-2xl text-left text-xs text-white/70 px-4 line-clamp-2">
            {caption}
          </p>
        ) : null}

        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-neutral-900/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-lg text-white">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom out"
            title="Zoom out (-)"
            disabled={scale <= MIN_SCALE}
            onClick={zoomOut}
            className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          >
            <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} className="size-4" />
          </Button>

          <span
            className="min-w-12 text-center text-xs font-semibold tabular-nums text-white"
            aria-label={`Current zoom: ${Math.round(scale * 100)}%`}
          >
            {Math.round(scale * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom in"
            title="Zoom in (+)"
            disabled={scale >= MAX_SCALE}
            onClick={zoomIn}
            className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
          </Button>

          <div className="mx-1 h-3.5 w-px bg-white/20" />

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Reset zoom"
            title="Reset zoom (0)"
            onClick={resetZoom}
            className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          >
            <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} className="size-3.5" />
          </Button>

          {/* Additional Actions: Replace, Download, Delete */}
          {onReplace ? (
            <>
              <div className="mx-1 h-3.5 w-px bg-white/20" />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Replace image"
                title="Replace image"
                onClick={() => setShowReplacePicker((prev) => !prev)}
                className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-3.5" />
              </Button>
            </>
          ) : null}

          {onDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Download image"
              title="Download image"
              onClick={onDownload}
              className="rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}

          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete image"
              title="Delete image"
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

        {/* Replace Image Popover rendered right above the fullscreen bottom controls */}
        {showReplacePicker ? (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
            <ImageBlockPicker
              isInline
              className="relative z-50 w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.5)] outline-none"
              title="Replace image"
              submitLabel="Replace"
              initialTab={src.startsWith('data:') ? 'upload' : 'embed'}
              initialUrl={src.startsWith('data:') ? '' : src}
              onClose={() => setShowReplacePicker(false)}
              onInsert={(newSrc, newAlt) => {
                onReplace?.(newSrc, newAlt)
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
