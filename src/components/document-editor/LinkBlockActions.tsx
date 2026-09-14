import { ArrowTopRightOnSquareIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon, LinkSlashIcon, TrashIcon } from '@heroicons/react/24/outline'
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

export type LinkBlockKind = 'bookmark' | 'embed' | 'page'

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
}: {
  editor: Editor
  getPos: (() => number | undefined) | boolean
  metadata: LinkBlockMetadata
  node: ProseMirrorNode
  onOpen: () => void
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
  const changeToBookmark = () => {
    if (!range) return
    const info = analyzePastedUrl(metadata.url)
    editor.commands.insertContentAt(range, bookmarkBlockNode({
      href: metadata.url,
      title: metadata.title || info?.title || metadata.url,
      domain: metadata.domain || info?.domain || '',
      description: metadata.description ?? '',
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
        <DropdownMenuItem onClick={onOpen}><ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />Open</DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}><ClipboardDocumentIcon aria-hidden="true" className="size-4" />Copy link</DropdownMenuItem>
        <DropdownMenuItem onClick={duplicate}><DocumentDuplicateIcon aria-hidden="true" className="size-4" />Duplicate</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={changeToLink}>Link</DropdownMenuItem>
            <DropdownMenuItem onClick={changeToBookmark}>Bookmark</DropdownMenuItem>
            <DropdownMenuItem disabled={!canEmbed} onClick={changeToEmbed}>Embed</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={removeLink}><LinkSlashIcon aria-hidden="true" className="size-4" />Remove link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={deleteBlock}><TrashIcon aria-hidden="true" className="size-4" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function blockRange(getPos: (() => number | undefined) | boolean, node: ProseMirrorNode) {
  if (typeof getPos !== 'function') return null
  const from = getPos()
  return typeof from === 'number' ? { from, to: from + node.nodeSize } : null
}
