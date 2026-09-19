import {
  ArrowReloadHorizontalIcon,
  Copy02Icon,
  CopyIcon,
  CopyLinkIcon,
  Delete02Icon,
  LinkOffIcon,
  MoreHorizontalIcon,
  SquareArrowOutUpRightIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useDeviceMode } from '../../hooks/useDeviceMode'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { bookmarkBlockNode } from './extensions/BookmarkBlock'
import { embedBlockNode } from './extensions/EmbedBlock'
import { analyzePastedUrl } from './pasteUrlModel'

export type LinkBlockKind = 'bookmark' | 'embed' | 'page' | 'mention'

export interface LinkBlockMetadata {
  kind: LinkBlockKind
  url: string
  title: string
  domain?: string
  description?: string
}

export function LinkBlockActions({
  editor,
  getPos,
  metadata,
  node,
  onOpen,
  embedToolbar = false,
  onMenuOpenChange,
  onCopyBlock,
  onDuplicate,
  isBlockCopied = false,
}: {
  editor: Editor
  getPos: (() => number | undefined) | boolean
  metadata: LinkBlockMetadata
  node: ProseMirrorNode
  onOpen: () => void
  embedToolbar?: boolean
  onMenuOpenChange?: (open: boolean) => void
  onCopyBlock?: () => void | Promise<void>
  onDuplicate?: () => void
  isBlockCopied?: boolean
}) {
  const { isTouch } = useDeviceMode()
  const range = blockRange(getPos, node)
  const canEmbed = Boolean(analyzePastedUrl(metadata.url)?.embedUrl)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (!copiedLink) return
    const timer = window.setTimeout(() => setCopiedLink(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copiedLink])

  const copyLink = (event?: React.MouseEvent) => {
    event?.preventDefault()
    void navigator.clipboard?.writeText(metadata.url)
    setCopiedLink(true)
  }
  const removeLink = () => {
    if (!range) return
    editor.commands.insertContentAt(range, {
      type: 'paragraph',
      content: [{ type: 'text', text: embedToolbar ? metadata.url : metadata.title || metadata.url }],
    })
  }
  const deleteBlock = () => {
    if (!range) return
    editor.chain().focus().deleteRange(range).run()
  }
  const changeToLink = () => {
    if (!range) return
    editor.commands.insertContentAt(range, {
      type: 'paragraph',
      content: [{
        type: 'text',
        text: metadata.title || metadata.url,
        marks: [{ type: 'link', attrs: { href: metadata.url } }],
      }],
    })
  }
  const changeToBookmark = (appearance: 'bookmark' | 'mention' = 'bookmark') => {
    if (!range) return
    const info = analyzePastedUrl(metadata.url)
    editor.commands.insertContentAt(range, bookmarkBlockNode({
      href: metadata.url,
      title: metadata.title || info?.title || metadata.url,
      domain: metadata.domain || info?.domain || '',
      description: metadata.description ?? '',
      appearance,
    }))
  }
  const changeToEmbed = () => {
    if (!range) return
    const info = analyzePastedUrl(metadata.url)
    if (!info?.embedUrl || !info.embedProvider) {
      changeToBookmark()
      return
    }
    editor.commands.insertContentAt(range, embedBlockNode({
      provider: info.embedProvider,
      url: info.url,
      embedUrl: info.embedUrl,
      title: metadata.title || info.title,
    }))
  }

  return (
    <DropdownMenu onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${metadata.title || metadata.url}`}
            title="More options"
            className="mybook-image-toolbar-button"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent bottomSheet={isTouch} align="end" sideOffset={6} className="min-w-44 rounded-xl p-1.5 shadow-lg">
        {isTouch && (onCopyBlock || onDuplicate) ? (
          <>
            {onCopyBlock ? (
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => {
                  void onCopyBlock()
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={isBlockCopied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{isBlockCopied ? 'Copied' : 'Copy block'}</span>
              </DropdownMenuItem>
            ) : null}
            {onDuplicate ? (
              <DropdownMenuItem
                onClick={() => {
                  onDuplicate()
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4 shrink-0" />
                <span className="whitespace-nowrap">Duplicate</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={onOpen} className="flex items-center gap-2"><HugeiconsIcon icon={SquareArrowOutUpRightIcon} strokeWidth={2} className="size-4" /><span>Open</span></DropdownMenuItem>
        <DropdownMenuItem closeOnClick={false} onClick={copyLink} className="flex items-center gap-2">
          <HugeiconsIcon icon={copiedLink ? Tick02Icon : CopyLinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
          <span className="whitespace-nowrap">{copiedLink ? 'Copied' : 'Copy link'}</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} />Change to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {metadata.kind !== 'page' ? <DropdownMenuItem onClick={changeToLink}>Link</DropdownMenuItem> : null}
            {metadata.kind !== 'bookmark' ? <DropdownMenuItem onClick={() => changeToBookmark()}>Bookmark</DropdownMenuItem> : null}
            {metadata.kind !== 'mention' ? <DropdownMenuItem onClick={() => changeToBookmark('mention')}>Mention</DropdownMenuItem> : null}
            {metadata.kind !== 'embed' ? <DropdownMenuItem disabled={!canEmbed} onClick={changeToEmbed}>Embed</DropdownMenuItem> : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={removeLink} className="flex items-center gap-2"><HugeiconsIcon icon={LinkOffIcon} strokeWidth={2} /><span>Remove link</span></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={deleteBlock} className="flex items-center gap-2"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function blockRange(getPos: (() => number | undefined) | boolean, node: ProseMirrorNode) {
  if (typeof getPos !== 'function') return null
  const from = getPos()
  return typeof from === 'number' ? { from, to: from + node.nodeSize } : null
}
