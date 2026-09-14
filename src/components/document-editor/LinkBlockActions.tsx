import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { ArrowReloadHorizontalIcon, Copy02Icon, CopyLinkIcon, Delete02Icon, ReloadIcon, SquareArrowOutUpRightIcon, Unlink02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'

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
  onReload,
}: {
  editor: Editor
  getPos: (() => number | undefined) | boolean
  metadata: LinkBlockMetadata
  node: ProseMirrorNode
  onOpen: () => void
  onReload?: () => void
}) {
  const range = blockRange(getPos, node)
  const canEmbed = Boolean(analyzePastedUrl(metadata.url)?.embedUrl)
  const copyLink = () => {
    void navigator.clipboard?.writeText(metadata.url)
  }
  const duplicate = () => {
    if (!range) return
    editor.commands.insertContentAt(range.to, node.toJSON())
  }
  const removeLink = () => {
    if (!range) return
    editor.commands.insertContentAt(range, {
      type: 'paragraph',
      content: [{ type: 'text', text: metadata.title || metadata.url }],
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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`More actions for ${metadata.title || metadata.url}`}
        className="mybook-link-card-actions"
      >
        <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={onOpen}><HugeiconsIcon icon={SquareArrowOutUpRightIcon} strokeWidth={2} className="size-4" />Open</DropdownMenuItem>
        {metadata.kind === 'embed' && onReload ? <DropdownMenuItem onClick={onReload}><HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4" />Reload</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={copyLink}><HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} className="size-4" />Copy link</DropdownMenuItem>
        <DropdownMenuItem onClick={duplicate}><HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" />Duplicate</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} />Change to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {metadata.kind !== 'page' ? <DropdownMenuItem onClick={changeToLink}>Link</DropdownMenuItem> : null}
            {metadata.kind !== 'bookmark' ? <DropdownMenuItem onClick={() => changeToBookmark()}>Bookmark</DropdownMenuItem> : null}
            {metadata.kind !== 'mention' ? <DropdownMenuItem onClick={() => changeToBookmark('mention')}>Mention</DropdownMenuItem> : null}
            {metadata.kind !== 'embed' ? <DropdownMenuItem disabled={!canEmbed} onClick={changeToEmbed}>Embed</DropdownMenuItem> : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={removeLink}><HugeiconsIcon icon={Unlink02Icon} strokeWidth={2} />Remove link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={deleteBlock}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function blockRange(getPos: (() => number | undefined) | boolean, node: ProseMirrorNode) {
  if (typeof getPos !== 'function') return null
  const from = getPos()
  return typeof from === 'number' ? { from, to: from + node.nodeSize } : null
}
