import {
  Copy02Icon,
  CopyIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  SquareArrowOutUpRightIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useDeviceMode } from '../../hooks/useDeviceMode'
import { Button } from '../ui/button'
import { Card, CardAction, CardContent } from '../ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useDocumentLinkContext } from './DocumentLinkContext'
import { normalizeDocumentLinkAttrs } from './documentLinkModel'

export function DocumentLinkNodeView({
  editor,
  getPos,
  node,
  selected,
  deleteNode,
}: NodeViewProps) {
  const { isTouch } = useDeviceMode()
  const context = useDocumentLinkContext()
  const attrs = normalizeDocumentLinkAttrs(node.attrs)
  const target = attrs && context ? context.files.find((file) => file.id === attrs.targetId && ['document', 'spreadsheet'].includes(file.type)) : undefined
  const isUnavailable = !target || target.isDeleted
  const title = target && !target.isDeleted ? target.name : attrs?.label || 'Missing page'
  const docType = isUnavailable ? 'Unavailable' : target?.type === 'spreadsheet' ? 'Spreadsheet' : 'Document'
  const iconSrc = target?.type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'
  const [copied, setCopied] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const open = () => {
    if (!attrs || isUnavailable) return
    context?.openDocument(attrs.targetId)
  }

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(title)
      }
    } catch {
      // ignore
    }
    setCopied(true)
  }

  const handleDuplicate = () => {
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos === undefined || !editor) return
    if (editor.commands?.insertContentAt) {
      editor.commands.insertContentAt(pos + node.nodeSize, node.toJSON())
    } else if (editor.chain) {
      editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
    }
  }

  const handleDelete = () => {
    if (deleteNode) {
      deleteNode()
      return
    }
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos !== undefined && editor) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    }
  }

  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      data-document-link-block="true"
      className="mybook-link-node-view relative my-2"
      contentEditable={false}
      data-menu-open={isMoreOpen ? 'true' : 'false'}
    >
      <Card
        size="sm"
        data-menu-open={isMoreOpen}
        className={`mybook-bookmark-block mybook-document-link-block rounded-[10px] py-0 gap-0 ring-0 shadow-none data-[size=sm]:[--card-spacing:0px] ${
          selected ? 'ProseMirror-selectednode' : ''
        }`}
      >
        <CardContent className="mybook-bookmark-content px-0">
          <button
            type="button"
            onClick={open}
            disabled={!attrs || isUnavailable}
            aria-label={isUnavailable ? `${title} unavailable` : `Open page ${title}`}
            className={`mybook-bookmark-card mybook-document-link-button ${
              isUnavailable ? 'cursor-default text-muted-foreground' : 'text-foreground'
            }`}
          >
            <span className="mybook-bookmark-logo" aria-hidden="true">
              <img src={iconSrc} alt="" aria-hidden="true" className="size-5 shrink-0 is-loaded" />
            </span>
            <span className="mybook-bookmark-body">
              <span className="mybook-mention-name" title={title}>
                {title}
              </span>
              <span className="mybook-mention-title" title={docType}>
                {docType}
              </span>
            </span>
          </button>
        </CardContent>

        <CardAction className="mybook-link-card-action-slot">
          {/* Desktop inline buttons */}
          <span className="mybook-desktop-only-action">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copied ? 'Copied' : 'Copy block'}
              title={copied ? 'Copied' : 'Copy block'}
              onClick={handleCopy}
              className="mybook-image-toolbar-button"
            >
              <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4" />
            </Button>
          </span>
          <span className="mybook-desktop-only-action">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Duplicate"
              title="Duplicate"
              onClick={handleDuplicate}
              className="mybook-image-toolbar-button"
            >
              <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" />
            </Button>
          </span>
          <span className="mybook-desktop-only-action">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              title="Delete"
              onClick={handleDelete}
              className="mybook-image-toolbar-button text-muted-foreground hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
            </Button>
          </span>

          {/* Mobile/Tablet More Dropdown -> Bottom Sheet */}
          <span className="mybook-mobile-only-action">
            <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More options for ${title}`}
                    title="More options"
                    className="mybook-image-toolbar-button"
                  />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent bottomSheet={isTouch} align="end" sideOffset={6} className="min-w-44 rounded-xl p-1.5 shadow-lg">
                {!isUnavailable ? (
                  <DropdownMenuItem
                    onClick={() => {
                      open()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={SquareArrowOutUpRightIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">Open</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={() => {
                    void handleCopy()
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy block'}</span>
                </DropdownMenuItem>
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
          </span>
        </CardAction>
      </Card>
    </NodeViewWrapper>
  )
}
