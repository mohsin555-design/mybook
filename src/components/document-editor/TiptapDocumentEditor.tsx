import { pastedEmbed } from './embedClipboard'
import { pastedBookmark } from './bookmarkClipboard'
import { ArrowReloadHorizontalIcon, CopyLinkIcon, Edit02Icon, Unlink02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Dropdown } from '../ui/compat-dropdown'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { Extension, InputRule } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { AllSelection, NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { isLocalWorkspace } from '../../stores/useWorkspaceStore'
import { useAutosave } from '../../hooks/useAutosave'
import { useLibraryData } from '../../hooks/useLibraryData'
import { useIsMobile } from '../../hooks/use-mobile'
import { backupDocumentToDrive, copyDriveFileLink, openDriveFileInBrowser } from '../../services/googleDrive'
import { documentToMyBookMarkdown, downloadMyBookMarkdown, myBookMarkdownToDocument } from '../../utils/mybookMarkdown'
import { EmptyState } from '../common/EmptyState'
import { AppHeader } from '../common/AppHeader'
import { DeleteFileDialog } from '../files/DeleteFileDialog'
import { getFolderPath } from '../files/FolderBreadcrumb'
import { ChecklistActionsMenu } from './ChecklistActionsMenu'
import { DocumentToolbar } from './DocumentToolbar'
import { EditorBlockControls } from './EditorBlockControls'
import { EditorStatus } from './EditorStatus'
import { BookmarkBlock, bookmarkBlockNode } from './extensions/BookmarkBlock'
import { Callout, calloutNode } from './extensions/Callout'
import { CodeBlock } from './extensions/CodeBlock'
import { DatabaseBlock } from './extensions/DatabaseBlock'
import { DocumentLink, documentLinkNode } from './extensions/DocumentLink'
import { EmbedBlock, embedBlockNode } from './extensions/EmbedBlock'
import { FileAttachment, fileAttachmentNode } from './extensions/FileAttachment'
import { FileBlockPicker } from './FileBlockPicker'
import { ImageBlock, imageBlockNode } from './extensions/ImageBlock'
import { ImageBlockPicker } from './ImageBlockPicker'
import { VideoBlock, videoBlockNode } from './extensions/VideoBlock'
import { VideoBlockPicker } from './VideoBlockPicker'
import { AudioBlock, audioBlockNode } from './extensions/AudioBlock'
import { AudioBlockPicker } from './AudioBlockPicker'
import { TableOfContents } from './extensions/TableOfContents'
import { ToggleBlock, toggleBlockNode } from './extensions/ToggleBlock'
import { FixedTable } from './extensions/FixedTable'
import { TableInteraction } from './extensions/TableInteraction'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { DocumentLinkProvider } from './DocumentLinkContext'
import { documentLinkLocation, documentLinkTargets } from './documentLinkModel'
import { clearTableSelection, isBlankEditorPoint, isEditorInteractiveTarget, keepEditorFocusedOnBlankClick } from './editorFocus'
import { MobileSlashCommandMenu, SlashCommandMenu } from './SlashCommandMenu'
import { analyzePastedUrl, type PasteUrlInfo } from './pasteUrlModel'
import { filterSlashCommands, getSlashMenuState, runSlashCommand, type SlashMenuState } from './slashCommands'
import { TableActionsMenu } from './TableActionsMenu'
import { devLog } from '../../utils/safeLog'
import { deletedToast } from '../../utils/deleteToast'
import { toast } from '../ui/toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] }
const documentViewModeStorageKey = 'mybook-document-view-mode'
const emptyBlockPlaceholderClass = 'mybook-empty-block-placeholder'
const quoteEmptyPlaceholderClass = 'mybook-quote-empty-placeholder'
const emptyBlockPlaceholderKey = new PluginKey<{ focused: boolean; pickerActive?: boolean }>('emptyBlockPlaceholder')
const listMarkerDepthKey = new PluginKey('listMarkerDepth')
const blankBlockSelectionKey = new PluginKey<{ anchor: number | null; head: number | null }>('blankBlockSelection')
const blankSelectableBlockSelector = ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote, :scope > pre, :scope > .mybook-toggle, :scope > ul > li, :scope > ol > li, :scope > [data-type="taskItem"]'

const MarkdownLinkShortcut = Extension.create({
  name: 'markdownLinkShortcut',
  addInputRules() {
    return [
      new InputRule({
        find: /!\[([^\]\n]*)\]\((https?:\/\/[^)\s]+)\)$/,
        handler: ({ state, range, match }) => {
          const alt = match[1] ?? ''
          const src = match[2]
          if (!src) return
          const imageNode = state.schema.nodes.imageBlock?.create({ src, alt })
          if (!imageNode) return
          const paragraphNode = state.schema.nodes.paragraph?.create()
          const nodesToInsert = paragraphNode ? [imageNode, paragraphNode] : [imageNode]
          state.tr.replaceWith(range.from, range.to, nodesToInsert)
        },
      }),
      new InputRule({
        find: /(?:^|[^!])\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)$/,
        handler: ({ state, range, match }) => {
          const label = match[1]
          const href = match[2]
          const linkMark = label && href ? state.schema.marks.link?.create({ href }) : null
          if (!linkMark || !label) return
          const fullMatch = match[0]
          const offset = fullMatch.startsWith('[') ? 0 : 1
          state.tr.replaceWith(range.from + offset, range.to, state.schema.text(label, [linkMark]))
        },
      }),
    ]
  },
})
interface PasteAsMenuState {
  urlInfo: PasteUrlInfo
  range: { from: number; to: number }
  position: { left: number; top: number }
  documentTarget?: { id: string; name: string }
}
interface InlineLinkToolbarState {
  href: string
  text: string
  anchor: HTMLAnchorElement
  range: { from: number; to: number }
  position: { left: number; top: number }
  canEmbed: boolean
  documentTarget?: { id: string; name: string }
}
interface DocumentLinkPickerState {
  query: string
  range: { from: number; to: number }
  position: { left: number; top: number }
}
interface ImagePickerState {
  range: { from: number; to: number }
  position: { left: number; top: number }
}
interface VideoPickerState {
  range: { from: number; to: number }
  position: { left: number; top: number }
}
interface AudioPickerState {
  range: { from: number; to: number }
  position: { left: number; top: number }
}
interface FilePickerState {
  range: { from: number; to: number }
  position: { left: number; top: number }
}

function blockPosAtPoint(view: EditorView, x: number, y: number) {
  const point = view.posAtCoords({ left: x, top: y })
  if (point) {
    const resolved = view.state.doc.resolve(point.pos)
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      if (resolved.node(depth).isBlock) return resolved.before(depth)
    }
  }

  const candidates: { pos: number; distance: number; size: number }[] = []
  view.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return
    const element = view.nodeDOM(pos)
    if (!(element instanceof Element)) return
    const rect = element.getBoundingClientRect()
    const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    candidates.push({ pos, distance, size: node.nodeSize })
  })
  return candidates.sort((a, b) => a.distance - b.distance || a.size - b.size)[0]?.pos ?? null
}
function emptyParagraphRangeForPaste(view: EditorView) {
  const { selection } = view.state
  if (!selection.empty || !selection.$from.parent.isTextblock || selection.$from.parent.type.name !== 'paragraph' || selection.$from.parent.content.size !== 0) return null
  const container = selection.$from.depth > 1 ? selection.$from.node(selection.$from.depth - 1) : null
  if (container && ['tableCell', 'tableHeader'].includes(container.type.name)) return null
  return {
    from: selection.$from.before(selection.$from.depth),
    to: selection.$from.after(selection.$from.depth),
  }
}
function linkRangeAtPosition(view: EditorView, position: number, href: string): { from: number; to: number; text: string } | null {
  let range: { from: number; to: number; text: string } | null = null
  view.state.doc.descendants((node, pos) => {
    if (range || !node.isText || !node.text) return
    const mark = node.marks.find((item) => item.type.name === 'link' && item.attrs.href === href)
    if (!mark) return
    const from = pos
    const to = pos + node.nodeSize
    if (position >= from && position <= to) range = { from, to, text: node.text ?? href }
  })
  if (range) return range
  view.state.doc.descendants((node, pos) => {
    if (range || !node.isText || !node.text) return
    const mark = node.marks.find((item) => item.type.name === 'link' && item.attrs.href === href)
    if (mark) range = { from: pos, to: pos + node.nodeSize, text: node.text ?? href }
  })
  return range
}

function documentLinkInsertionRange(editor: NonNullable<ReturnType<typeof useEditor>>, range: { from: number; to: number }) {
  const { doc } = editor.state
  const $from = doc.resolve(range.from)
  const $to = doc.resolve(range.to)
  if ($from.parent === $to.parent && $from.parent.isTextblock) {
    const query = doc.textBetween(range.from, range.to, '\n', '\0')
    if ($from.parent.textContent === query) return { from: $from.before($from.depth), to: $from.after($from.depth) }
  }
  return range
}

function insertDocumentLinkAt(editor: NonNullable<ReturnType<typeof useEditor>>, range: { from: number; to: number }, target: { id: string; name: string }) {
  editor.chain().focus().insertContentAt(range, [documentLinkNode({ targetId: target.id, label: target.name }), { type: 'paragraph' }]).run()
  const link = editor.state.doc.nodeAt(range.from)
  const paragraphPos = range.from + (link?.nodeSize ?? 1)
  const paragraph = editor.state.doc.nodeAt(paragraphPos)
  if (paragraph?.type.name !== 'paragraph') return
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, paragraphPos + 1)).scrollIntoView())
  editor.view.focus()
}

function clearBlankBlockHighlight(editor: NonNullable<ReturnType<typeof useEditor>>) {
  editor.view.dom.querySelectorAll('.mybook-blank-block-selected').forEach((element) => element.classList.remove('mybook-blank-block-selected'))
}
function createBlankBlockOverlay(editor: NonNullable<ReturnType<typeof useEditor>>, startY: number, headY: number) {
  const overlay = document.createElement('div')
  overlay.className = 'mybook-blank-block-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  const from = Math.min(startY, headY)
  const to = Math.max(startY, headY)
  const elements = Array.from(editor.view.dom.querySelectorAll(blankSelectableBlockSelector))
  elements.forEach((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.bottom < from - 8 || rect.top > to + 8) return
    const row = document.createElement('div')
    row.className = 'mybook-blank-block-overlay-row'
    row.style.left = `${rect.left}px`
    row.style.top = `${rect.top}px`
    row.style.width = `${rect.width}px`
    row.style.height = `${rect.height}px`
    overlay.append(row)
  })
  document.body.append(overlay)
  return overlay
}
function documentPositionForElement(editor: NonNullable<ReturnType<typeof useEditor>>, element: Element) {
  let position: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (position !== null) return
    if (editor.view.nodeDOM(pos) === element) position = pos
  })
  return position
}
function blockDocumentRangeBetweenY(editor: NonNullable<ReturnType<typeof useEditor>>, startY: number, headY: number) {
  const fromY = Math.min(startY, headY)
  const toY = Math.max(startY, headY)
  let from = Number.POSITIVE_INFINITY
  let to = 0
  editor.view.dom.querySelectorAll(blankSelectableBlockSelector).forEach((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.bottom < fromY - 8 || rect.top > toY + 8) return
    const pos = documentPositionForElement(editor, element)
    if (pos === null) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    from = Math.min(from, pos)
    to = Math.max(to, pos + node.nodeSize)
  })
  return Number.isFinite(from) && to > from ? { from, to } : null
}
const ListMarkerDepth = Extension.create({
  name: 'listMarkerDepth',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: listMarkerDepthKey,
      props: {
        decorations(state) {
          const decorations: Decoration[] = []

          state.doc.descendants((node, pos) => {
            if (!['bulletList', 'orderedList', 'taskList'].includes(node.type.name)) return

            const resolved = state.doc.resolve(pos + 1)
            let depth = 0
            for (let level = 0; level <= resolved.depth; level += 1) {
              if (['bulletList', 'orderedList', 'taskList'].includes(resolved.node(level).type.name)) depth += 1
            }
            const marker = node.type.name === 'orderedList'
              ? ['decimal', 'alpha', 'roman'][(depth - 1) % 3]
              : ['disc', 'circle', 'square'][(depth - 1) % 3]
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
              'data-list-depth': String(depth),
              'data-list-marker': marker,
            }))
          })

          return DecorationSet.create(state.doc, decorations)
        },
      },
    })]
  },
})
const BlankBlockSelection = Extension.create({
  name: 'blankBlockSelection',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: blankBlockSelectionKey,
      state: {
        init: (): { anchor: number | null; head: number | null } => ({ anchor: null, head: null }),
        apply(transaction, value) {
          const meta = transaction.getMeta(blankBlockSelectionKey) as { anchor?: number | null; head?: number | null; clear?: boolean } | undefined
          if (meta?.clear) return { anchor: null, head: null }
          if (meta && ('anchor' in meta || 'head' in meta)) {
            return { anchor: meta.anchor ?? value.anchor, head: meta.head ?? value.head }
          }
          return value
        },
      },
      props: {
        decorations(state) {
          const selection = blankBlockSelectionKey.getState(state)
          if (selection?.anchor === null || selection?.anchor === undefined || selection.head === null || selection.head === undefined) return DecorationSet.empty
          const from = Math.min(selection.anchor, selection.head)
          const to = Math.max(selection.anchor, selection.head)
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (!node.isBlock || pos > to || pos + node.nodeSize < from) return
            decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'mybook-blank-block-selected' }))
          })
          return DecorationSet.create(state.doc, decorations)
        },
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0) return false
            if (!event.shiftKey) return false
            const target = event.target
            if (!(target instanceof Element) || target.closest('button, input, textarea, a, [contenteditable="false"]')) return false
            const blockAtPointer = blockPosAtPoint(view, event.clientX, event.clientY)
            if (blockAtPointer === null) return false
            const $position = view.state.doc.resolve(blockAtPointer)
            let blockPos: number | null = null
            let blockNode: ProseMirrorNode | null = null
            for (let depth = $position.depth; depth > 0; depth -= 1) {
              const node = $position.node(depth)
              if (!node.isBlock) continue
              blockPos = $position.before(depth)
              blockNode = node
              if (node.type.name === 'taskItem') break
            }
            if (blockPos === null || !blockNode) blockPos = blockAtPointer
            const blockElement = target.closest('p, h1, h2, h3, h4, li, blockquote, pre, .mybook-callout, .mybook-toggle, .mybook-file-attachment, .mybook-image-block')
            const textRange = blockElement ? document.createRange() : null
            if (textRange && blockElement) textRange.selectNodeContents(blockElement)
            const textRects = textRange ? Array.from(textRange.getClientRects()) : []
            const isInsideText = textRects.some((rect) => event.clientX >= rect.left - 4 && event.clientX <= rect.right + 4 && event.clientY >= rect.top - 4 && event.clientY <= rect.bottom + 4)
            const isBlankArea = !blockElement || !blockElement.textContent?.trim() || !isInsideText
            if (!isBlankArea) {
              if (blankBlockSelectionKey.getState(view.state)?.anchor !== null) {
                view.dispatch(view.state.tr.setMeta(blankBlockSelectionKey, { clear: true }))
              }
              return false
            }

            event.preventDefault()
            const start = blockPos
            const updateHead = (moveEvent: MouseEvent) => {
              const nextBlockAtPointer = blockPosAtPoint(view, moveEvent.clientX, moveEvent.clientY)
              if (nextBlockAtPointer === null) return
              const nextResolved = view.state.doc.resolve(nextBlockAtPointer)
              let nextBlockPos: number | null = null
              for (let depth = nextResolved.depth; depth > 0; depth -= 1) {
                if (!nextResolved.node(depth).isBlock) continue
                nextBlockPos = nextResolved.before(depth)
                if (nextResolved.node(depth).type.name === 'taskItem') break
              }
              if (nextBlockPos === null) nextBlockPos = nextBlockAtPointer
              view.dispatch(view.state.tr.setMeta(blankBlockSelectionKey, { anchor: start, head: nextBlockPos }))
            }
            const finish = () => {
              window.removeEventListener('mousemove', updateHead)
              window.removeEventListener('mouseup', finish)
            }
            window.addEventListener('mousemove', updateHead)
            window.addEventListener('mouseup', finish, { once: true })
            view.dispatch(view.state.tr.setMeta(blankBlockSelectionKey, { anchor: start, head: start }))
            view.focus()
            return true
          },
        },
      },
    })]
  },
})
const EmptyBlockPlaceholder = Extension.create({
  name: 'emptyBlockPlaceholder',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: emptyBlockPlaceholderKey,
      state: {
        init: () => ({ focused: false, pickerActive: false }),
        apply(transaction, value) {
          const focused = transaction.getMeta(emptyBlockPlaceholderKey)?.focused
          const pickerActive = transaction.getMeta(emptyBlockPlaceholderKey)?.pickerActive
          return {
            focused: focused !== undefined ? focused : value.focused,
            pickerActive: pickerActive !== undefined ? pickerActive : value.pickerActive,
          }
        },
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          const pluginState = emptyBlockPlaceholderKey.getState(state)
          const isEditorFocused = pluginState?.focused === true || pluginState?.pickerActive === true
          const activeTextblockPos = isEditorFocused && state.selection.empty && state.selection.$from.parent.isTextblock && state.selection.$from.parent.content.size === 0
            ? state.selection.$from.before(state.selection.$from.depth)
            : null

          state.doc.descendants((node, pos, parent) => {
            if (!node.isTextblock || node.content.size !== 0) return
            if (parent?.type.name === 'tableCell' || parent?.type.name === 'tableHeader') return
            if (parent?.type.name === 'blockquote') {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: quoteEmptyPlaceholderClass,
                'data-placeholder': 'Quote',
              }))
              return
            }
            if (parent?.type.name === 'taskItem') {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: emptyBlockPlaceholderClass,
              }))
              return
            }
            if (node.type.name === 'heading' || (node.type.name !== 'paragraph' && pos === activeTextblockPos)) {
              const isHeading = node.type.name === 'heading'
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: isHeading ? `${emptyBlockPlaceholderClass} mybook-heading-placeholder` : emptyBlockPlaceholderClass,
                ...(isHeading ? { 'data-placeholder': `Heading ${node.attrs.level}` } : {}),
              }))
            }
          })

          if (isEditorFocused && state.selection.empty) {
            const { $from } = state.selection
            const grandparent = $from.depth > 1 ? $from.node($from.depth - 1) : null
            if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && !['tableCell', 'tableHeader'].includes(grandparent?.type.name ?? '')) {
              const pos = $from.before($from.depth)
              decorations.push(Decoration.node(pos, $from.after($from.depth), { class: emptyBlockPlaceholderClass }))
            }
          }
          return DecorationSet.create(state.doc, decorations)
        },
        handleDOMEvents: {
          focus(view) {
            view.dispatch(view.state.tr.setMeta(emptyBlockPlaceholderKey, { focused: true }))
            return false
          },
          blur(view) {
            view.dispatch(view.state.tr.setMeta(emptyBlockPlaceholderKey, { focused: false }))
            return false
          },
        },
      },
    })]
  },
})

function parseContent(content: string) {
  if (!content) return emptyDocument
  try { return JSON.parse(content) as object } catch { return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } }
}

function cleanPastedHtml(html: string) {
  if (!html || typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll('*').forEach((element) => {
    ;[
      'class',
      'style',
      'id',
      'lang',
      'dir',
      'width',
      'height',
      'face',
      'color',
      'bgcolor',
      'align',
    ].forEach((attribute) => element.removeAttribute(attribute))
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name)
    })
  })
  doc.body.querySelectorAll('meta, style, script, link, xml').forEach((element) => element.remove())
  doc.body.querySelectorAll('span').forEach((span) => {
    if (!span.attributes.length) span.replaceWith(...Array.from(span.childNodes))
  })
  return doc.body.innerHTML
}

function cleanPastedText(text: string) {
  return text.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n')
}

function isWholeDocumentSelection(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { doc, selection } = editor.state
  return selection.from <= 1 && selection.to >= doc.content.size
}

function resetEditorToEmptyDocument(editor: NonNullable<ReturnType<typeof useEditor>>) {
  editor.commands.setContent(emptyDocument, { emitUpdate: true })
  const selection = TextSelection.create(editor.state.doc, 1)
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
  editor.view.focus()
}

function titleInputValue(fileName: string) {
  return /^Untitled(?: Document)?(?: \d+)?$/u.test(fileName.trim()) ? '' : fileName
}

function DocumentLinkPicker({
  currentFileId,
  files,
  folders,
  onClose,
  onSelect,
  onSelectIndex,
  position,
  query,
  selectedIndex,
}: {
  currentFileId: string
  files: NonNullable<ReturnType<typeof useLibraryData>['files']>
  folders: NonNullable<ReturnType<typeof useLibraryData>['folders']>
  onClose: () => void
  onSelectIndex: (index: number) => void
  onSelect: (target: { id: string; name: string }) => void
  position: { left: number; top: number } | null
  query: string
  selectedIndex: number
}) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const selectedOptionRef = useRef<HTMLButtonElement>(null)

  const documents = useMemo(() => {
    return documentLinkTargets(files, currentFileId, query)
  }, [currentFileId, files, query])
  const groupedTargets = [
    { label: 'Documents', items: documents.filter((item) => item.type === 'document') },
    { label: 'Databases', items: documents.filter((item) => item.type === 'spreadsheet') },
  ].filter((group) => group.items.length)
  const flatTargets = groupedTargets.flatMap((group) => group.items)

  useEffect(() => {
    onSelectIndex(Math.min(selectedIndex, Math.max(0, flatTargets.length - 1)))
  }, [flatTargets.length, onSelectIndex, selectedIndex])

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && pickerRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('pointerdown', closeOnPointerDown)
    return () => window.removeEventListener('pointerdown', closeOnPointerDown)
  }, [onClose])

  useEffect(() => {
    if (!selectedOptionRef.current) return
    const scroller = selectedOptionRef.current.closest<HTMLElement>('[data-command-menu-scroller="true"]')
    if (!scroller) return
    const optionRect = selectedOptionRef.current.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    if (optionRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - optionRect.top
    else if (optionRect.bottom > scrollerRect.bottom) scroller.scrollTop += optionRect.bottom - scrollerRect.bottom
  }, [selectedIndex])

  if (!position) return null

  return (
    <div
      ref={pickerRef}
      role="listbox"
      aria-label="Link to Page options"
      className="fixed z-20 max-h-[min(22rem,calc(100dvh-1rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.14)] outline-none"
      data-document-link-picker="true"
      data-command-menu-scroller="true"
      style={{
        left: Math.max(8, Math.min(position.left, window.innerWidth - 320)),
        top: Math.max(8, Math.min(position.top, window.innerHeight - 360)),
      }}
    >
      {groupedTargets.length ? groupedTargets.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
            {group.items.map((item) => {
              const location = documentLinkLocation(item, folders)
              const isSelected = flatTargets[selectedIndex]?.id === item.id
              return (
                <button
                  key={item.id}
                  ref={isSelected ? selectedOptionRef : undefined}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => onSelectIndex(flatTargets.findIndex((target) => target.id === item.id))}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect({ id: item.id, name: item.name })
                  }}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'}`}
                  aria-label={`Link to page ${item.name}`}
                >
                  <img src={item.type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'} alt="" aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={location.isTruncated ? location.fullPath : undefined}>{location.displayPath}</span>
                  </span>
                </button>
              )
            })}
          </section>
        )) : (
          <div className="px-3 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">No pages found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different page name.</p>
          </div>
        )}
    </div>
  )
}

function DesktopMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`${label} menu`}>{label}</Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">{children}</Dropdown.Popover>
    </Dropdown>
  )
}

function PasteAsMenu({
  menu,
  onChoose,
  onClose,
}: {
  menu: PasteAsMenuState
  onChoose: (action: 'link' | 'bookmark' | 'mention' | 'embed' | 'image' | 'document-link') => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null
      if (menuRef.current && menuRef.current.contains(target)) return
      onClose()
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      data-paste-as-menu="true"
      role="menu"
      aria-label="Paste as"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      className="fixed z-20 min-w-48 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 text-sm shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
      style={{
        left: Math.min(menu.position.left, window.innerWidth - 216),
        top: Math.min(menu.position.top, window.innerHeight - 196),
      }}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Paste as</div>
      <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('link')}>Link</button>
      <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('bookmark')}>Bookmark</button>
      <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('mention')}>Mention</button>
      {menu.urlInfo.isImage ? <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('image')}>Image</button> : null}
      {menu.urlInfo.embedUrl && !menu.urlInfo.isImage ? <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('embed')}>Embed</button> : null}
      {menu.documentTarget ? <button type="button" role="menuitem" className="mybook-paste-as-item" onClick={() => onChoose('document-link')}>Link to page</button> : null}
    </div>
  )
}

function InlineLinkToolbar({
  toolbar,
  onAction,
  onClose,
}: {
  toolbar: InlineLinkToolbarState
  onAction: (action: 'copy' | 'edit' | 'bookmark' | 'mention' | 'embed' | 'image' | 'page' | 'remove', values?: { href: string; text: string }) => void
  onClose: () => void
}) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isChangeOpen, setIsChangeOpen] = useState(false)
  const [href, setHref] = useState(toolbar.href)
  const [text, setText] = useState(toolbar.text)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLFormElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])
  const scheduleClose = useCallback((delay = 100) => {
    cancelScheduledClose()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, delay)
  }, [cancelScheduledClose, onClose])
  useEffect(() => {
    const closeOnPointerMove = (event: PointerEvent) => {
      if (isEditOpen || isChangeOpen) {
        cancelScheduledClose()
        return
      }
      const target = event.target
      if (target instanceof Node && (toolbar.anchor.contains(target) || toolbarRef.current?.contains(target))) {
        cancelScheduledClose()
        return
      }
      scheduleClose()
    }
    const closeOnPointerOut = (event: PointerEvent) => {
      const target = event.target
      const related = event.relatedTarget
      const isInLinkOrToolbar = target instanceof Node && (toolbar.anchor.contains(target) || toolbarRef.current?.contains(target))
      const isMovingIntoLinkOrToolbar = related instanceof Node && (toolbar.anchor.contains(related) || toolbarRef.current?.contains(related))
      if (isInLinkOrToolbar && !isMovingIntoLinkOrToolbar && !isEditOpen && !isChangeOpen) {
        cancelScheduledClose()
        const anchorRect = toolbar.anchor.getBoundingClientRect()
        if (toolbar.anchor.contains(target) && event.clientY <= anchorRect.top + 4) scheduleClose(300)
        else onClose()
      }
    }
    document.addEventListener('pointermove', closeOnPointerMove)
    document.addEventListener('pointerout', closeOnPointerOut)
    return () => {
      document.removeEventListener('pointermove', closeOnPointerMove)
      document.removeEventListener('pointerout', closeOnPointerOut)
      cancelScheduledClose()
    }
  }, [cancelScheduledClose, isChangeOpen, isEditOpen, onClose, scheduleClose, toolbar.anchor])
  const closeIfOutside = (event: React.PointerEvent) => {
    const related = event.relatedTarget
    if (related instanceof Node && (toolbar.anchor.contains(related) || toolbarRef.current?.contains(related) || editRef.current?.contains(related))) return
    if (isEditOpen || isChangeOpen) return
    scheduleClose()
  }
  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault()
    onAction('edit', { href: href.trim(), text: text.trim() || href.trim() })
    setIsEditOpen(false)
  }

  return (
    <div
      ref={toolbarRef}
      className="mybook-inline-link-toolbar"
      role="toolbar"
      aria-label="Link actions"
      style={{
        left: Math.min(Math.max(8, toolbar.position.left), window.innerWidth - 220),
        top: Math.max(8, toolbar.position.top),
      }}
      onPointerLeave={closeIfOutside}
      onPointerEnter={cancelScheduledClose}
    >
      {!isEditOpen ? (
        <>
          <Button type="button" variant="ghost" size="icon-sm" title="Copy link" aria-label="Copy link" onClick={() => onAction('copy')}><HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Edit link" aria-label="Edit link" onClick={() => { setHref(toolbar.href); setText(toolbar.text); setIsEditOpen((open) => !open); setIsChangeOpen(false) }}><HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" /></Button>
          <DropdownMenu onOpenChange={setIsChangeOpen}>
            <DropdownMenuTrigger title="Change to" aria-label="Change link to" className="mybook-inline-link-toolbar-trigger" onClick={() => { setIsChangeOpen(true); setIsEditOpen(false) }}>
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuItem onClick={() => onAction('bookmark')}>Bookmark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('mention')}>Mention</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('image')}>Image</DropdownMenuItem>
              <DropdownMenuItem disabled={!toolbar.canEmbed} onClick={() => onAction('embed')}>Embed</DropdownMenuItem>
              {toolbar.documentTarget ? <DropdownMenuItem onClick={() => onAction('page')}>Link to Page</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="ghost" size="icon-sm" title="Remove link" aria-label="Remove link" onClick={() => onAction('remove')}><HugeiconsIcon icon={Unlink02Icon} strokeWidth={2} className="size-4" /></Button>
        </>
      ) : null}
      {isEditOpen ? (
        <form
          ref={editRef}
          className="mybook-inline-link-edit-popover"
          style={{ top: toolbar.anchor.getBoundingClientRect().bottom - toolbar.position.top + 8 }}
          onSubmit={submitEdit}
        >
          <label>Page or URL<Input value={href} onChange={(event) => setHref(event.target.value)} autoFocus /></label>
          <label>Link Name<Input value={text} onChange={(event) => setText(event.target.value)} /></label>
          <div className="mybook-inline-link-edit-actions">
            <Button type="button" variant="destructive" size="sm" className="mybook-inline-link-remove" onClick={() => { onAction('remove'); setIsEditOpen(false) }}>Remove link</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="default" size="sm" className="mybook-inline-link-apply">Apply</Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

export function TiptapDocumentEditor({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { files, folders } = useLibraryData(true)
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
    const { content, isHydrated, save, setContent, status } = useAutosave(file)
  const [title, setTitle] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [docxMessage, setDocxMessage] = useState('')
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [isFullWidth, setIsFullWidth] = useState(() => window.localStorage.getItem(documentViewModeStorageKey) === 'full')
  const [zoom, setZoom] = useState(100)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [documentLinkPicker, setDocumentLinkPicker] = useState<DocumentLinkPickerState | null>(null)
  const [documentLinkSelectedIndex, setDocumentLinkSelectedIndex] = useState<number>(0)
  const [imagePicker, setImagePicker] = useState<ImagePickerState | null>(null)
  const [videoPicker, setVideoPicker] = useState<VideoPickerState | null>(null)
  const [audioPicker, setAudioPicker] = useState<AudioPickerState | null>(null)
  const [filePicker, setFilePicker] = useState<FilePickerState | null>(null)
  const [pasteAsMenu, setPasteAsMenu] = useState<PasteAsMenuState | null>(null)
  const [inlineLinkToolbar, setInlineLinkToolbar] = useState<InlineLinkToolbarState | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pageTitleRef = useRef<HTMLTextAreaElement>(null)
  const cloudTimerRef = useRef<number | null>(null)
  const cloudFlightRef = useRef(false)
  const lastBackedUpContentRef = useRef<string | null>(null)
  const lastBackedUpTitleRef = useRef<string | null>(null)
  const lastBackedUpFileIdRef = useRef<string | null>(null)
  const editorContentRef = useRef('')
  const titleRef = useRef('')
  const lastSavedTitleRef = useRef('')
  const loadedTitleFileIdRef = useRef<string | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashMenuDismissedRef = useRef(false)
  const slashSelectedIndexRef = useRef(0)
  const documentLinkPickerRef = useRef<DocumentLinkPickerState | null>(null)
  const documentLinkSelectedIndexRef = useRef(0)
  const imagePickerRef = useRef<ImagePickerState | null>(null)
  const videoPickerRef = useRef<VideoPickerState | null>(null)
  const audioPickerRef = useRef<AudioPickerState | null>(null)
  const filePickerRef = useRef<FilePickerState | null>(null)
  const pasteAsMenuRef = useRef<PasteAsMenuState | null>(null)
  const inlineLinkToolbarRef = useRef<InlineLinkToolbarState | null>(null)
  const filesRef = useRef(files)
  const editorRef = useRef<NonNullable<ReturnType<typeof useEditor>> | null>(null)
  const blankOverlayRef = useRef<HTMLDivElement | null>(null)
  const blankSelectionRangeRef = useRef<{ from: number; to: number } | null>(null)
  const lastActiveSelectionRef = useRef({ from: 1, to: 1 })
  const restoreLastActiveSelection = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { doc } = currentEditor.state
    const maxPosition = Math.max(1, doc.content.size - 1)
    const from = Math.min(Math.max(1, lastActiveSelectionRef.current.from), maxPosition)
    const to = Math.min(Math.max(from, lastActiveSelectionRef.current.to), maxPosition)
    currentEditor.view.dispatch(currentEditor.state.tr.setSelection(TextSelection.create(doc, from, to)))
    currentEditor.view.focus()
  }, [])
  const updateTitle = useCallback((nextTitle: string) => {
    titleRef.current = nextTitle
    setTitle(nextTitle)
  }, [])
  const closeImagePicker = useCallback(() => {
    imagePickerRef.current = null
    setImagePicker(null)
    const currentEditor = editorRef.current
    if (currentEditor && !currentEditor.isDestroyed) {
      currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false }))
    }
  }, [])
  const closeVideoPicker = useCallback(() => {
    videoPickerRef.current = null
    setVideoPicker(null)
    const currentEditor = editorRef.current
    if (currentEditor && !currentEditor.isDestroyed) {
      currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false }))
    }
  }, [])
  const closeAudioPicker = useCallback(() => {
    audioPickerRef.current = null
    setAudioPicker(null)
    const currentEditor = editorRef.current
    if (currentEditor && !currentEditor.isDestroyed) {
      currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false }))
    }
  }, [])
  const closeFilePicker = useCallback(() => {
    filePickerRef.current = null
    setFilePicker(null)
    const currentEditor = editorRef.current
    if (currentEditor && !currentEditor.isDestroyed) {
      currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false }))
    }
  }, [])
  const updateSlashMenu = useCallback((currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
    if (slashMenuDismissedRef.current) {
      slashMenuRef.current = null
      setSlashMenu(null)
      return
    }
    if (documentLinkPickerRef.current || imagePickerRef.current || videoPickerRef.current || audioPickerRef.current || filePickerRef.current) {
      slashMenuRef.current = null
      setSlashMenu(null)
      return
    }
    const next = getSlashMenuState(currentEditor)
    slashMenuRef.current = next
    setSlashMenu(next)
    if (!next) {
      slashSelectedIndexRef.current = 0
      setSlashSelectedIndex(0)
      return
    }
    const commandCount = filterSlashCommands(next.query).length
    const nextIndex = Math.min(slashSelectedIndexRef.current, Math.max(0, commandCount - 1))
    slashSelectedIndexRef.current = nextIndex
    setSlashSelectedIndex(nextIndex)
  }, [])
  const closePasteAsMenu = useCallback(() => {
    pasteAsMenuRef.current = null
    setPasteAsMenu(null)
  }, [])
  const updatePasteAsMenu = useCallback((currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
    const menu = pasteAsMenuRef.current
    if (!menu) return
    const { selection, doc } = currentEditor.state
    if (doc.content.size < menu.range.from) {
      closePasteAsMenu()
      return
    }
    const $start = doc.resolve(Math.min(menu.range.from, doc.content.size))
    const currentText = $start.parent.isTextblock
      ? $start.parent.textBetween(0, $start.parent.content.size, '\n', '\0')
      : ''
    if (!currentText || (currentText !== menu.urlInfo.url && currentText !== menu.urlInfo.url.replace(/\/$/, ''))) {
      closePasteAsMenu()
      return
    }
    const $cursor = doc.resolve(selection.from)
    if (!$cursor.parent.isTextblock || $start.start() !== $cursor.start()) {
      closePasteAsMenu()
    }
  }, [closePasteAsMenu])
  const closeInlineLinkToolbar = useCallback(() => {
    inlineLinkToolbarRef.current = null
    setInlineLinkToolbar(null)
  }, [])
  const closeDocumentLinkPicker = useCallback(() => {
    documentLinkPickerRef.current = null
    setDocumentLinkPicker(null)
    documentLinkSelectedIndexRef.current = 0
    setDocumentLinkSelectedIndex(0)
    const currentEditor = editorRef.current
    if (currentEditor && !currentEditor.isDestroyed) {
      currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false }))
    }
  }, [])
  const updateDocumentLinkPicker = useCallback((currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
    const picker = documentLinkPickerRef.current
    if (!picker) return
    const { selection, doc } = currentEditor.state
    if (!selection.empty || selection.from < picker.range.from) {
      closeDocumentLinkPicker()
      return
    }
    const $start = doc.resolve(picker.range.from)
    const $cursor = doc.resolve(selection.from)
    if (!$cursor.parent.isTextblock || $start.start() !== $cursor.start()) {
      closeDocumentLinkPicker()
      return
    }
    const query = doc.textBetween(picker.range.from, selection.from, '\n', '\0')
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const next = {
      query,
      range: { from: picker.range.from, to: selection.from },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    documentLinkPickerRef.current = next
    setDocumentLinkPicker(next)
    const resultCount = documentLinkTargets(filesRef.current, fileId, query).length
    const nextIndex = Math.min(documentLinkSelectedIndexRef.current, Math.max(0, resultCount - 1))
    documentLinkSelectedIndexRef.current = nextIndex
    setDocumentLinkSelectedIndex(nextIndex)
  }, [closeDocumentLinkPicker, fileId])
  const showInlineLinkToolbar = useCallback((anchor: HTMLAnchorElement) => {
    const currentEditor = editorRef.current
    const href = anchor.getAttribute('href') ?? ''
    if (!currentEditor || !href) return
    const domPosition = currentEditor.view.posAtDOM(anchor.firstChild ?? anchor, 0)
    const range = linkRangeAtPosition(currentEditor.view, domPosition, href)
    if (!range) return
    const rect = anchor.getBoundingClientRect()
    const info = analyzePastedUrl(href)
    const documentTarget = info?.documentId
      ? filesRef.current.find((candidate) => candidate.id === info.documentId && !candidate.isDeleted)
      : undefined
    const nextToolbar = {
      href,
      text: range.text,
      anchor,
      range: { from: range.from, to: range.to },
      position: { left: rect.left, top: rect.top - 42 },
      canEmbed: Boolean(info?.embedUrl),
      documentTarget: documentTarget ? { id: documentTarget.id, name: documentTarget.name } : undefined,
    }
    inlineLinkToolbarRef.current = nextToolbar
    setInlineLinkToolbar(nextToolbar)
  }, [])
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: true,
          autolink: true,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        },
        heading: { levels: [1, 2, 3, 4] },
      }),
      MarkdownLinkShortcut,
      CodeBlock,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
      FixedTable.configure({ resizable: true, cellMinWidth: 96, handleWidth: 6 }),
      StyledTableCell,
      StyledTableHeader,
      TableInteraction,
      Underline,
      Callout,
      BookmarkBlock,
      EmbedBlock,
      FileAttachment,
      ImageBlock,
      VideoBlock,
      AudioBlock,
      ToggleBlock,
      DatabaseBlock,
      TableOfContents,
      DocumentLink,
      EmptyBlockPlaceholder,
      ListMarkerDepth,
      BlankBlockSelection,
    ],
    content: emptyDocument,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[65vh] outline-none',
        'aria-label': 'Document content',
        role: 'textbox',
      },
      transformPastedHTML: cleanPastedHtml,
      transformPastedText: cleanPastedText,
      handlePaste: (view, event) => {
        const copiedEmbed = pastedEmbed(event.clipboardData?.getData('text/html') ?? '')
        if (copiedEmbed) {
          event.preventDefault()
          editorRef.current?.commands.insertContent(copiedEmbed)
          closePasteAsMenu()
          closeInlineLinkToolbar()
          return true
        }
        const copiedBookmark = pastedBookmark(event.clipboardData?.getData('text/html') ?? '')
        if (copiedBookmark) {
          event.preventDefault()
          editorRef.current?.commands.insertContent(copiedBookmark)
          closePasteAsMenu()
          closeInlineLinkToolbar()
          return true
        }
        const rawUrl = event.clipboardData?.getData('text/plain') ?? ''
        const urlInfo = analyzePastedUrl(rawUrl)
        if (urlInfo && !view.state.selection.empty) {
          event.preventDefault()
          editorRef.current?.chain().focus().setLink({ href: urlInfo.url }).run()
          closePasteAsMenu()
          closeInlineLinkToolbar()
          return true
        }
        const emptyRange = urlInfo ? emptyParagraphRangeForPaste(view) : null
        if (!urlInfo || !emptyRange) {
          closePasteAsMenu()
          return false
        }

        window.requestAnimationFrame(() => {
          const currentEditor = editorRef.current
          if (!currentEditor) return
          const pastedNode = currentEditor.state.doc.nodeAt(emptyRange.from)
          if (!pastedNode) return
          const nextRange = { from: emptyRange.from, to: emptyRange.from + pastedNode.nodeSize }
          const coords = currentEditor.view.coordsAtPos(Math.min(nextRange.to - 1, currentEditor.state.doc.content.size))
          const documentTarget = urlInfo.documentId
            ? filesRef.current.find((candidate) => candidate.id === urlInfo.documentId && candidate.type === 'document' && !candidate.isDeleted)
            : undefined
          const nextPasteMenu = {
            urlInfo,
            range: nextRange,
            position: { left: coords.left, top: coords.bottom + 8 },
            documentTarget: documentTarget ? { id: documentTarget.id, name: documentTarget.name } : undefined,
          }
          pasteAsMenuRef.current = nextPasteMenu
          setPasteAsMenu(nextPasteMenu)
        })
        return false
      },
      handleTextInput: (view, from, to, text) => {
        slashMenuDismissedRef.current = false
        if (text === '[' && from === to) {
          const $from = view.state.doc.resolve(from)
          const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')
          if (textBeforeCursor.endsWith('[')) {
            const shortcutFrom = Math.max($from.start(), from - 1)
            const transaction = view.state.tr.delete(shortcutFrom, from)
            transaction.setSelection(TextSelection.create(transaction.doc, shortcutFrom))
            view.dispatch(transaction)
            const coords = view.coordsAtPos(shortcutFrom)
            const nextPicker = {
              query: '',
              range: { from: shortcutFrom, to: shortcutFrom },
              position: { left: coords.left, top: coords.bottom + 8 },
            }
            documentLinkPickerRef.current = nextPicker
            setDocumentLinkPicker(nextPicker)
            documentLinkSelectedIndexRef.current = 0
            setDocumentLinkSelectedIndex(0)
            slashMenuRef.current = null
            setSlashMenu(null)
            return true
          }
        }
        blankOverlayRef.current?.remove()
        blankOverlayRef.current = null
        blankSelectionRangeRef.current = null
        closePasteAsMenu()
        return false
      },
      handleDOMEvents: {
        mouseover: (_view, event) => {
          const target = event.target
          const anchor = target instanceof Element ? target.closest('a[href]') : null
          if (anchor instanceof HTMLAnchorElement && editorRef.current?.view.dom.contains(anchor)) showInlineLinkToolbar(anchor)
          return false
        },
        focusin: (_view, event) => {
          const target = event.target
          const anchor = target instanceof Element ? target.closest('a[href]') : null
          if (anchor instanceof HTMLAnchorElement && editorRef.current?.view.dom.contains(anchor)) showInlineLinkToolbar(anchor)
          return false
        },
        mousedown: (view, event) => {
          if (event.target !== view.dom) return false
          const lastNode = view.state.doc.lastChild
          if (lastNode?.type.name === 'table') {
            const lastPos = view.state.doc.content.size - lastNode.nodeSize
            const lastElement = view.nodeDOM(lastPos)
            if (lastElement instanceof Element && event.clientY > lastElement.getBoundingClientRect().bottom) {
              const insertPos = lastPos + lastNode.nodeSize
              const paragraphType = view.state.schema.nodes.paragraph
              if (!paragraphType) return false
              const paragraph = paragraphType.create()
              const transaction = view.state.tr.insert(insertPos, paragraph)
              transaction
                .setSelection(TextSelection.create(transaction.doc, insertPos + 1))
                .setMeta(emptyBlockPlaceholderKey, { focused: true })
                .scrollIntoView()
              view.dispatch(transaction)
              view.focus()
              return true
            }
          }
          event.preventDefault()
          if (view.state.selection instanceof NodeSelection) {
            view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(view.state.selection.to))))
            view.focus()
            return true
          }
          restoreLastActiveSelection()
          return true
        },
        blur: () => {
          if (!slashMenuRef.current) return false
          slashMenuDismissedRef.current = true
          slashMenuRef.current = null
          setSlashMenu(null)
          slashSelectedIndexRef.current = 0
          setSlashSelectedIndex(0)
          return false
        },
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && editorRef.current) {
          event.preventDefault()
          const currentEditor = editorRef.current
          const current = currentEditor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL. Markdown shortcut: [text](https://example.com)', current ?? 'https://')
          if (url === null) return true
          if (!url.trim()) currentEditor.chain().focus().extendMarkRange('link').unsetLink().run()
          else currentEditor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
          return true
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && editorRef.current) {
          event.preventDefault()
          const editor = editorRef.current
          editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
          return true
        }

        if (editorRef.current && !editorRef.current.state.selection.empty) {
          blankOverlayRef.current?.remove()
          blankOverlayRef.current = null
          blankSelectionRangeRef.current = null
          return false
        }

        if ((event.key === 'Backspace' || event.key === 'Delete') && blankSelectionRangeRef.current && editorRef.current) {
          event.preventDefault()
          const range = blankSelectionRangeRef.current
          blankSelectionRangeRef.current = null
          blankOverlayRef.current?.remove()
          blankOverlayRef.current = null
          editorRef.current.chain().focus().deleteRange(range).run()
          return true
        }

        if (event.key === 'Backspace' && editorRef.current && editorRef.current.state.selection.empty) {
          const { state } = editorRef.current
          const { selection, doc } = state
          if (selection.from === 1 && doc.firstChild && doc.firstChild.isTextblock && doc.firstChild.content.size === 0) {
            if (doc.childCount > 1) {
              event.preventDefault()
              const firstNodeSize = doc.firstChild.nodeSize
              const tr = state.tr.delete(0, firstNodeSize)
              const newSelection = TextSelection.create(tr.doc, 1)
              tr.setSelection(newSelection)
              editorRef.current.view.dispatch(tr)
              editorRef.current.view.focus()
              return true
            } else {
              event.preventDefault()
              editorRef.current.view.focus()
              return true
            }
          }
        }

        if (event.key === 'Escape' && pasteAsMenuRef.current) {
          event.preventDefault()
          closePasteAsMenu()
          return true
        }

        if (event.key === 'Escape' && imagePickerRef.current) {
          event.preventDefault()
          closeImagePicker()
          return true
        }

        if (event.key === 'Escape' && videoPickerRef.current) {
          event.preventDefault()
          closeVideoPicker()
          return true
        }

        if (event.key === 'Escape' && audioPickerRef.current) {
          event.preventDefault()
          closeAudioPicker()
          return true
        }

        if (event.key === 'Escape' && filePickerRef.current) {
          event.preventDefault()
          closeFilePicker()
          return true
        }

        const documentPicker = documentLinkPickerRef.current
        if (documentPicker) {
          const targets = documentLinkTargets(filesRef.current, fileId, documentPicker.query)
          if (event.key === 'Escape') {
            event.preventDefault()
            closeDocumentLinkPicker()
            return true
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = targets.length ? (documentLinkSelectedIndexRef.current + 1) % targets.length : 0
            documentLinkSelectedIndexRef.current = next
            setDocumentLinkSelectedIndex(next)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = targets.length ? (documentLinkSelectedIndexRef.current - 1 + targets.length) % targets.length : 0
            documentLinkSelectedIndexRef.current = next
            setDocumentLinkSelectedIndex(next)
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const selected = targets[documentLinkSelectedIndexRef.current] ?? targets[0]
            const currentEditor = editorRef.current
            if (!selected || !currentEditor) return true
            const insertRange = documentLinkInsertionRange(currentEditor, documentPicker.range)
            closeDocumentLinkPicker()
            insertDocumentLinkAt(currentEditor, insertRange, { id: selected.id, name: selected.name })
            return true
          }
        }

        if ((event.key === 'Backspace' || event.key === 'Delete') && editorRef.current && isWholeDocumentSelection(editorRef.current)) {
          event.preventDefault()
          slashMenuRef.current = null
          setSlashMenu(null)
          resetEditorToEmptyDocument(editorRef.current)
          return true
        }

        const menu = slashMenuRef.current
        if (!menu) return false
        const commands = filterSlashCommands(menu.query)
        if (event.key === 'Escape') {
          event.preventDefault()
          slashMenuRef.current = null
          setSlashMenu(null)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          const next = commands.length ? (slashSelectedIndexRef.current + 1) % commands.length : 0
          slashSelectedIndexRef.current = next
          setSlashSelectedIndex(next)
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          const next = commands.length ? (slashSelectedIndexRef.current - 1 + commands.length) % commands.length : 0
          slashSelectedIndexRef.current = next
          setSlashSelectedIndex(next)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (!commands.length || !editorRef.current) return false
          event.preventDefault()
          const selectedCommand = commands[slashSelectedIndexRef.current] ?? commands[0]!
          runSlashCommand(editorRef.current, selectedCommand.id, menu.range)
          slashMenuRef.current = null
          setSlashMenu(null)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const next = JSON.stringify(currentEditor.getJSON())
      editorContentRef.current = next
      setContent(next)
      updateDocumentLinkPicker(currentEditor)
      updateSlashMenu(currentEditor)
      updatePasteAsMenu(currentEditor)
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      if (!currentEditor.state.selection.empty) {
        blankOverlayRef.current?.remove()
        blankOverlayRef.current = null
        blankSelectionRangeRef.current = null
      }
      lastActiveSelectionRef.current = {
        from: currentEditor.state.selection.from,
        to: currentEditor.state.selection.to,
      }
      updateDocumentLinkPicker(currentEditor)
      updateSlashMenu(currentEditor)
      updatePasteAsMenu(currentEditor)
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    if (!slashMenu) return
    const closeOnScroll = (event: Event) => {
      const scrollTarget = event.target as Node | null
      if (scrollTarget instanceof Element && scrollTarget.closest('[data-slash-command-menu="true"]')) return
      slashMenuRef.current = null
      setSlashMenu(null)
      slashSelectedIndexRef.current = 0
      setSlashSelectedIndex(0)
    }
    window.addEventListener('scroll', closeOnScroll, true)
    return () => window.removeEventListener('scroll', closeOnScroll, true)
  }, [slashMenu])

  useEffect(() => {
    if (!slashMenu) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-slash-command-menu="true"]')) return
      slashMenuDismissedRef.current = true
      slashMenuRef.current = null
      setSlashMenu(null)
      slashSelectedIndexRef.current = 0
      setSlashSelectedIndex(0)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointerDown)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointerDown)
  }, [slashMenu])

  const openImagePicker = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { selection } = currentEditor.state
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const nextPicker: ImagePickerState = {
      range: { from: selection.from, to: selection.to },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    imagePickerRef.current = nextPicker
    setImagePicker(nextPicker)
    currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true }))
    slashMenuRef.current = null
    setSlashMenu(null)
    closeDocumentLinkPicker()
    closeVideoPicker()
    closeAudioPicker()
    closeFilePicker()
    closePasteAsMenu()
  }, [closeDocumentLinkPicker, closeVideoPicker, closeAudioPicker, closeFilePicker, closePasteAsMenu])

  const handleInsertImage = useCallback((src: string, alt: string) => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const picker = imagePickerRef.current
    closeImagePicker()
    if (picker?.range) {
      currentEditor.chain().focus().insertContentAt(picker.range, [imageBlockNode(src, alt), { type: 'paragraph' }]).run()
    } else {
      currentEditor.chain().focus().insertContent([imageBlockNode(src, alt), { type: 'paragraph' }]).run()
    }
  }, [closeImagePicker])

  const openVideoPicker = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { selection } = currentEditor.state
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const nextPicker: VideoPickerState = {
      range: { from: selection.from, to: selection.to },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    videoPickerRef.current = nextPicker
    setVideoPicker(nextPicker)
    currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true }))
    slashMenuRef.current = null
    setSlashMenu(null)
    closeDocumentLinkPicker()
    closeImagePicker()
    closeAudioPicker()
    closeFilePicker()
    closePasteAsMenu()
  }, [closeDocumentLinkPicker, closeImagePicker, closeAudioPicker, closeFilePicker, closePasteAsMenu])

  const handleInsertVideo = useCallback((src: string, alt: string, provider?: 'html5' | 'youtube' | 'vimeo' | 'embed') => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const picker = videoPickerRef.current
    closeVideoPicker()
    if (picker?.range) {
      currentEditor.chain().focus().insertContentAt(picker.range, [videoBlockNode(src, alt, '100%', 'left', '', true, '', provider ?? 'html5'), { type: 'paragraph' }]).run()
    } else {
      currentEditor.chain().focus().insertContent([videoBlockNode(src, alt, '100%', 'left', '', true, '', provider ?? 'html5'), { type: 'paragraph' }]).run()
    }
  }, [closeVideoPicker])

  const openAudioPicker = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { selection } = currentEditor.state
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const nextPicker: AudioPickerState = {
      range: { from: selection.from, to: selection.to },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    audioPickerRef.current = nextPicker
    setAudioPicker(nextPicker)
    currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true }))
    slashMenuRef.current = null
    setSlashMenu(null)
    closeDocumentLinkPicker()
    closeImagePicker()
    closeVideoPicker()
    closeFilePicker()
    closePasteAsMenu()
  }, [closeDocumentLinkPicker, closeImagePicker, closeVideoPicker, closeFilePicker, closePasteAsMenu])

  const handleInsertAudio = useCallback((src: string, title: string, provider?: 'html5' | 'embed') => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const picker = audioPickerRef.current
    closeAudioPicker()
    if (picker?.range) {
      currentEditor.chain().focus().insertContentAt(picker.range, [audioBlockNode(src, title, '100%', 'left', '', provider ?? 'html5'), { type: 'paragraph' }]).run()
    } else {
      currentEditor.chain().focus().insertContent([audioBlockNode(src, title, '100%', 'left', '', provider ?? 'html5'), { type: 'paragraph' }]).run()
    }
  }, [closeAudioPicker])

  const openFilePicker = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { selection } = currentEditor.state
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const nextPicker: FilePickerState = {
      range: { from: selection.from, to: selection.to },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    filePickerRef.current = nextPicker
    setFilePicker(nextPicker)
    currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true }))
    slashMenuRef.current = null
    setSlashMenu(null)
    closeDocumentLinkPicker()
    closeImagePicker()
    closeVideoPicker()
    closeAudioPicker()
    closePasteAsMenu()
  }, [closeDocumentLinkPicker, closeImagePicker, closeVideoPicker, closeAudioPicker, closePasteAsMenu])

  const handleInsertFile = useCallback((src: string, name: string, mimeType = '', size = 0) => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const picker = filePickerRef.current
    closeFilePicker()
    if (picker?.range) {
      currentEditor.chain().focus().insertContentAt(picker.range, [fileAttachmentNode(src, name, mimeType, size), { type: 'paragraph' }]).run()
    } else {
      currentEditor.chain().focus().insertContent([fileAttachmentNode(src, name, mimeType, size), { type: 'paragraph' }]).run()
    }
  }, [closeFilePicker])

  useEffect(() => {
    window.addEventListener('mybook:insert-image', openImagePicker)
    return () => window.removeEventListener('mybook:insert-image', openImagePicker)
  }, [openImagePicker])

  useEffect(() => {
    window.addEventListener('mybook:insert-video', openVideoPicker)
    return () => window.removeEventListener('mybook:insert-video', openVideoPicker)
  }, [openVideoPicker])

  useEffect(() => {
    window.addEventListener('mybook:insert-audio', openAudioPicker)
    return () => window.removeEventListener('mybook:insert-audio', openAudioPicker)
  }, [openAudioPicker])

  useEffect(() => {
    window.addEventListener('mybook:insert-file', openFilePicker)
    return () => window.removeEventListener('mybook:insert-file', openFilePicker)
  }, [openFilePicker])

  const openDocumentLinkPicker = useCallback(() => {
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const { selection } = currentEditor.state
    const coords = currentEditor.view.coordsAtPos(selection.from)
    const nextPicker = {
      query: '',
      range: { from: selection.from, to: selection.from },
      position: { left: coords.left, top: coords.bottom + 8 },
    }
    documentLinkPickerRef.current = nextPicker
    setDocumentLinkPicker(nextPicker)
    currentEditor.view.dispatch(currentEditor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true }))
    documentLinkSelectedIndexRef.current = 0
    setDocumentLinkSelectedIndex(0)
    slashMenuRef.current = null
    setSlashMenu(null)
    closeImagePicker()
    closeVideoPicker()
    closeAudioPicker()
    closeFilePicker()
    closePasteAsMenu()
  }, [closeImagePicker, closeVideoPicker, closeAudioPicker, closeFilePicker, closePasteAsMenu])

  useEffect(() => {
    window.addEventListener('mybook:insert-document-link', openDocumentLinkPicker)
    return () => window.removeEventListener('mybook:insert-document-link', openDocumentLinkPicker)
  }, [openDocumentLinkPicker])

  useEffect(() => {
    if (!file) return
    if (loadedTitleFileIdRef.current !== file.id) {
      loadedTitleFileIdRef.current = file.id
      lastSavedTitleRef.current = file.name
      updateTitle(titleInputValue(file.name))
      return
    }
    if (file.name === lastSavedTitleRef.current) return
    if (titleRef.current === titleInputValue(lastSavedTitleRef.current)) {
      lastSavedTitleRef.current = file.name
      updateTitle(titleInputValue(file.name))
    }
  }, [file, updateTitle])
  useEffect(() => {
    if (!editor || !file || !isHydrated) return
    if (loadedId === file.id && content === editorContentRef.current) return
    editor.commands.setContent(parseContent(content), { emitUpdate: false })
    editorContentRef.current = content
    setLoadedId(file.id)
  }, [content, editor, file, isHydrated, loadedId])
  useEffect(() => {
    const titleElement = pageTitleRef.current
    if (!titleElement) return
    titleElement.style.height = '0px'
    titleElement.style.height = `${titleElement.scrollHeight}px`
  }, [title])
  if (file && lastBackedUpFileIdRef.current !== file.id) {
    lastBackedUpFileIdRef.current = file.id
    if (file.syncStatus === 'backed-up') {
      lastBackedUpContentRef.current = file.content
      lastBackedUpTitleRef.current = file.name
    } else {
      lastBackedUpContentRef.current = null
      lastBackedUpTitleRef.current = null
    }
  }
  const saveTitle = useCallback(async () => {
    const nextTitle = titleRef.current.trim()
    if (!file || !nextTitle || nextTitle === file.name) return
    const result = await fileRepository.update(file.id, { name: nextTitle, syncStatus: isLocalWorkspace() ? 'local' : 'pending' })
    if (result.success) {
      lastSavedTitleRef.current = nextTitle
      updateTitle(nextTitle)
    }
  }, [file, updateTitle])
  useEffect(() => {
    if (!file || file.isDeleted || file.workspaceType === 'local' || file.syncStatus === 'local') return
    if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)

    const trimmedTitle = titleRef.current.trim() || file.name || 'Untitled'
    const hasUnsyncedChanges =
      file.syncStatus === 'pending' ||
      status === 'saved-locally' ||
      content !== (lastBackedUpContentRef.current ?? '') ||
      trimmedTitle !== (lastBackedUpTitleRef.current ?? '')

    if (!hasUnsyncedChanges || file.syncStatus === 'backed-up') return

    cloudTimerRef.current = window.setTimeout(() => {
      if (cloudFlightRef.current || !file || file.isDeleted || file.type !== 'document') return
      cloudFlightRef.current = true
      void (async () => {
        try {
          const [savedContent] = await Promise.all([save(), saveTitle()])
          if (!savedContent) return
          const latest = (await fileRepository.get(file.id)).data
          if (!latest) return
          const latestTitle = latest.name.trim() || 'Untitled'
          const result = await backupDocumentToDrive({ fileId: latest.id, title: latestTitle, content: latest.content, folderId: latest.folderId })
          if (result.success) {
            lastBackedUpContentRef.current = latest.content
            lastBackedUpTitleRef.current = latestTitle
          } else {
            toast.add({ title: "Couldn't sync", description: result.error, type: 'error', priority: 'low' })
          }
        } finally {
          cloudFlightRef.current = false
        }
      })()
    }, 3000)
    return () => {
      if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = null
    }
  }, [content, file, save, saveTitle, status, title])

  if (file === undefined || !editor) return <div role="status" className="p-4 text-muted-foreground">Loading editor…</div>
  if (!file || file.isDeleted) return <EmptyState title="Document not found" description="This document may have been moved to Trash or deleted." />

  const saveAll = async () => { await Promise.all([save(), saveTitle()]) }
  const backupNow = async () => {
    if (!file) return
    await saveAll()
    const latest = (await fileRepository.get(file.id)).data
    if (!latest) return
    const latestTitle = latest.name.trim() || 'Untitled'
    const result = await backupDocumentToDrive({ fileId: latest.id, title: latestTitle, content: latest.content, folderId: latest.folderId })
    if (result.success) {
      lastBackedUpContentRef.current = latest.content
      lastBackedUpTitleRef.current = latestTitle
    } else {
      toast.add({ title: "Couldn't sync", description: result.error ?? 'Sync failed.', type: 'error', priority: 'low' })
    }
  }
  const copyDriveLink = async () => {
    if (!file.driveFileId) return
    const result = await copyDriveFileLink(file.driveFileId)
    toast.add({
      title: result.success ? 'Backup link copied' : 'Could not copy the backup link',
      description: result.success ? undefined : result.error,
      type: result.success ? 'success' : 'error',
      priority: 'low',
    })
  }
  const navigateBack = () => {
    if (typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate(file.folderId ? `/folders/${file.folderId}` : '/home')
    }
  }
  const close = async () => { await saveAll(); navigateBack() }
  const deleteDocument = async () => {
    await saveAll()
    const result = await fileRepository.delete(file.id)
    if (!result.success) return
    navigate(file.folderId ? `/folders/${file.folderId}` : '/home')
    toast.add(deletedToast({
      itemName: documentTitle,
      onUndo: () => { void fileRepository.restore(file.id) },
    }))
  }
  const duplicateDocument = async () => {
    await saveAll()
    const result = await fileRepository.duplicate(file.id)
    if (result.data) navigate(`/document/${result.data.id}`)
  }

  const insertDocumentLink = (target: { id: string; name: string }) => {
    const picker = documentLinkPickerRef.current
    const insertRange = picker ? documentLinkInsertionRange(editor, picker.range) : undefined
    closeDocumentLinkPicker()
    if (insertRange) insertDocumentLinkAt(editor, insertRange, target)
    else insertDocumentLinkAt(editor, { from: editor.state.selection.from, to: editor.state.selection.to }, target)
  }

  const replacePasteAsBlock = (node: object) => {
    if (!pasteAsMenu) return
    editor.commands.insertContentAt(pasteAsMenu.range, [node, { type: 'paragraph' }])
    editor.chain().focus().run()
    closePasteAsMenu()
  }

  const choosePasteAs = (action: 'link' | 'bookmark' | 'mention' | 'embed' | 'image' | 'document-link') => {
    if (!pasteAsMenu) return
    if (action === 'link') {
      closePasteAsMenu()
      editor.chain().focus().run()
      return
    }
    if (action === 'image') {
      replacePasteAsBlock(imageBlockNode(pasteAsMenu.urlInfo.url, pasteAsMenu.urlInfo.title))
      return
    }
    if (action === 'bookmark' || action === 'mention') {
      replacePasteAsBlock(bookmarkBlockNode({
        appearance: action,
        href: pasteAsMenu.urlInfo.url,
        title: pasteAsMenu.urlInfo.title,
        domain: pasteAsMenu.urlInfo.domain,
      }))
      return
    }
    if (action === 'embed' && pasteAsMenu.urlInfo.embedUrl && pasteAsMenu.urlInfo.embedProvider) {
      replacePasteAsBlock(embedBlockNode({
        provider: pasteAsMenu.urlInfo.embedProvider,
        url: pasteAsMenu.urlInfo.url,
        embedUrl: pasteAsMenu.urlInfo.embedUrl,
        title: pasteAsMenu.urlInfo.title,
      }))
      return
    }
    if (action === 'document-link' && pasteAsMenu.documentTarget) {
      replacePasteAsBlock(documentLinkNode({
        targetId: pasteAsMenu.documentTarget.id,
        label: pasteAsMenu.documentTarget.name,
      }))
    }
  }

  const runInlineLinkAction = (action: 'copy' | 'edit' | 'bookmark' | 'mention' | 'embed' | 'image' | 'page' | 'remove', values?: { href: string; text: string }) => {
    const toolbar = inlineLinkToolbarRef.current
    if (!toolbar) return
    if (action === 'copy') {
      void navigator.clipboard?.writeText(toolbar.href)
      closeInlineLinkToolbar()
      return
    }
    if (action === 'edit') {
      const url = values?.href.trim() ?? toolbar.href
      const text = values?.text.trim() || toolbar.text
      if (url) {
        editor.chain().focus().insertContentAt(toolbar.range, {
          type: 'text',
          text,
          marks: [{ type: 'link', attrs: { href: url } }],
        }).run()
      }
      closeInlineLinkToolbar()
      return
    }
    if (action === 'remove') {
      editor.chain().focus().setTextSelection(toolbar.range).unsetLink().run()
      closeInlineLinkToolbar()
      return
    }
    if (action === 'image') {
      const info = analyzePastedUrl(toolbar.href)
      editor.commands.insertContentAt(toolbar.range, imageBlockNode(
        toolbar.href,
        toolbar.text || info?.title || ''
      ))
      closeInlineLinkToolbar()
      return
    }
    if (action === 'bookmark' || action === 'mention') {
      const info = analyzePastedUrl(toolbar.href)
      editor.commands.insertContentAt(toolbar.range, bookmarkBlockNode({
        appearance: action,
        href: toolbar.href,
        title: toolbar.text || info?.title || toolbar.href,
        domain: info?.domain ?? '',
      }))
      closeInlineLinkToolbar()
      return
    }
    if (action === 'embed') {
      const info = analyzePastedUrl(toolbar.href)
      if (info?.embedUrl && info.embedProvider) {
        editor.commands.insertContentAt(toolbar.range, embedBlockNode({
          provider: info.embedProvider,
          url: info.url,
          embedUrl: info.embedUrl,
          title: toolbar.text || info.title,
        }))
      }
      closeInlineLinkToolbar()
      return
    }
    if (action === 'page' && toolbar.documentTarget) {
      editor.commands.insertContentAt(toolbar.range, documentLinkNode({
        targetId: toolbar.documentTarget.id,
        label: toolbar.documentTarget.name,
      }))
      closeInlineLinkToolbar()
    }
  }

  const setEditorLink = () => {
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', current ?? 'https://')
    if (url === null) return
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const exportDocx = async (download: boolean) => {
    try {
      const { createDocxBlob, downloadDocx } = await import('../../utils/docx')
      const blob = await createDocxBlob(documentTitle, editor.getJSON())
      setDocxBlob(blob)
      setDocxMessage(download ? 'DOCX downloaded.' : 'DOCX ready for backup.')
      if (download) downloadDocx(blob, documentTitle)
    } catch (error) {
      devLog('error', 'Could not export DOCX.', error)
      setDocxMessage('DOCX export failed.')
    }
  }

  const exportMarkdown = async (download: boolean) => {
    try {
      const markdown = documentToMyBookMarkdown(documentTitle, editor.getJSON(), { documentId: file.id })
      setDocxMessage(download ? 'Writin Markdown downloaded.' : 'Writin Markdown ready.')
      if (download) downloadMyBookMarkdown(markdown, documentTitle)
    } catch (error) {
      devLog('error', 'Could not export Writin Markdown.', error)
      setDocxMessage('Markdown export failed.')
    }
  }

  const importDocumentFile = async (selectedFile: File) => {
    try {
      if (/\.md$/i.test(selectedFile.name)) {
        const parsed = myBookMarkdownToDocument(await selectedFile.text())
        editor.commands.setContent(parsed)
      } else {
        const mammoth = (await import('mammoth')).default
        const result = await mammoth.convertToHtml({ arrayBuffer: await selectedFile.arrayBuffer() })
        editor.commands.setContent(result.value)
        setDocxMessage(result.messages.length ? 'DOCX imported with some formatting simplified.' : 'DOCX imported.')
      }
      const importedTitle = selectedFile.name.replace(/\.docx$/i, '')
        .replace(/\.mybook\.md$/i, '')
        .replace(/\.md$/i, '')
      const updateResult = await fileRepository.update(file.id, { name: importedTitle })
      if (updateResult.success) {
        lastSavedTitleRef.current = importedTitle
        updateTitle(importedTitle)
      }
      if (/\.md$/i.test(selectedFile.name)) setDocxMessage('Writin Markdown imported.')
    } catch (error) {
      devLog('error', 'Could not import document.', error)
      setDocxMessage('Document import failed.')
    }
  }

  const insertImageFile = async (selectedFile: File) => {
    try {
      if (!selectedFile.type.startsWith('image/')) {
        setDocxMessage('Please choose an image file.')
        return
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setDocxMessage('Image is too large. Choose an image under 5 MB.')
        return
      }
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error ?? new Error('Image read failed.'))
        reader.readAsDataURL(selectedFile)
      })
      editor.chain().focus().insertContent([imageBlockNode(src, selectedFile.name.replace(/\.[^.]+$/u, '')), { type: 'paragraph' }]).run()
      setDocxMessage('Image inserted.')
    } catch (error) {
      devLog('error', 'Could not insert image.', error)
      setDocxMessage('Image insert failed.')
    }
  }

  const insertAttachmentFile = async (selectedFile: File) => {
    try {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setDocxMessage('File is too large. Choose a file under 10 MB.')
        return
      }
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error ?? new Error('File read failed.'))
        reader.readAsDataURL(selectedFile)
      })
      editor.chain().focus().insertContent([fileAttachmentNode(src, selectedFile.name, selectedFile.type, selectedFile.size), { type: 'paragraph' }]).run()
      setDocxMessage('File attached.')
    } catch (error) {
      devLog('error', 'Could not attach file.', error)
      setDocxMessage('File attachment failed.')
    }
  }

  const handleDocumentAction = (key: Key) => {
    const action = String(key)
    if (action === 'save') void saveAll()
    else if (action === 'backup') void backupNow()
    else if (action === 'copy-link') void copyDriveLink()
    else if (action === 'export-markdown') void exportMarkdown(true)
    else if (action === 'download-docx') void exportDocx(true)
    else if (action === 'prepare-docx') void exportDocx(false)
    else if (action === 'open-drive' && file.driveFileId) void openDriveFileInBrowser(file.driveFileId)
    else if (action === 'import') importInputRef.current?.click()
    else if (action === 'duplicate') void duplicateDocument()
    else if (action === 'undo') editor.chain().focus().undo().run()
    else if (action === 'redo') editor.chain().focus().redo().run()
    else if (action === 'clear') editor.chain().focus().unsetAllMarks().clearNodes().run()
    else if (action === 'link') setEditorLink()
    else if (action === 'callout') editor.chain().focus().insertContent(calloutNode()).run()
    else if (action === 'toggle') editor.chain().focus().insertContent(toggleBlockNode()).run()
    else if (action === 'image') openImagePicker()
    else if (action === 'file') openFilePicker()
    else if (action === 'table') editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()
    else if (action === 'hr') editor.chain().focus().setHorizontalRule().insertContent({ type: 'paragraph' }).run()
    else if (action === 'paragraph') editor.chain().focus().setParagraph().run()
    else if (action === 'h1') editor.chain().focus().setHeading({ level: 1 }).run()
    else if (action === 'h2') editor.chain().focus().setHeading({ level: 2 }).run()
    else if (action === 'h3') editor.chain().focus().setHeading({ level: 3 }).run()
      else if (action === 'h4') editor.chain().focus().setHeading({ level: 4 }).run()
    else if (action === 'bold') editor.chain().focus().toggleBold().run()
    else if (action === 'italic') editor.chain().focus().toggleItalic().run()
    else if (action === 'underline') editor.chain().focus().toggleUnderline().run()
    else if (action === 'strike') editor.chain().focus().toggleStrike().run()
    else if (action === 'code') editor.chain().focus().toggleCode().run()
    else if (action === 'code-block') {
      const { from, to } = editor.state.selection
      runSlashCommand(editor, 'code-block', { from, to })
    }
    else if (action === 'quote') {
      const { from, to } = editor.state.selection
      runSlashCommand(editor, 'quote', { from, to })
    }
    else if (action === 'bullet') editor.chain().focus().toggleBulletList().run()
    else if (action === 'numbered') editor.chain().focus().toggleOrderedList().run()
    else if (action === 'task') editor.chain().focus().toggleTaskList().run()
    else if (action === 'page-width') setDocumentViewMode(false)
    else if (action === 'full-width') setDocumentViewMode(true)
    else if (action.startsWith('zoom-')) setZoom(Number(action.replace('zoom-', '')))
    else if (action === 'delete') setIsDeleteDialogOpen(true)
    else void close()
  }

  const runSelectedSlashCommand = (commandId: string, menu: SlashMenuState) => {
    runSlashCommand(editor, commandId, menu.range)
    slashMenuRef.current = null
    setSlashMenu(null)
  }

  const insertBlock = (commandId: string) => {
    const activeSlashMenu = slashMenuRef.current
    if (activeSlashMenu) {
      runSelectedSlashCommand(commandId, activeSlashMenu)
      return
    }
    const { from, to } = editor.state.selection
    runSlashCommand(editor, commandId, { from, to })
  }

  const pageScale = zoom / 100
  const desktopPageWidth = '100%'
  const documentSurfaceClass = 'bg-[var(--app-surface)]'
  const documentPageClass = `mybook-document-page ${isFullWidth ? '' : 'mybook-document-page--continuous '}mx-auto min-h-[calc(100dvh-13rem)] w-full bg-[var(--app-surface)] px-20 pb-[55vh] pt-3 shadow-none sm:px-24 md:px-28 md:pb-[55vh] md:pt-7`
  const placeholderTitle = 'Untitled'
  const documentTitle = title.trim() || placeholderTitle
  const localSaveStatusActive = status === 'editing' || status === 'saving-locally' || status === 'saved-locally'
  const editorStatus = localSaveStatusActive ? status : file.syncStatus
  const editorStatusWorkspace = file.workspaceType === 'local' || file.syncStatus === 'local' ? 'local' : 'drive'
  const setDocumentViewMode = (fullWidth: boolean) => {
    setIsFullWidth(fullWidth)
    window.localStorage.setItem(documentViewModeStorageKey, fullWidth ? 'full' : 'page')
  }
  const toggleDocumentFavorite = async () => {
    const result = await fileRepository.setFavorite(file.id, !file.isFavorite)
    if (!result.success) toast.add({ title: 'Could not update favorite', description: result.error, type: 'error', priority: 'low' })
  }

  const folderPath = file.folderId ? getFolderPath(file.folderId, folders) : []
  const editorBreadcrumbs = [
    { label: 'Library', onPress: () => navigate('/folders') },
    ...folderPath.map((f) => ({ label: f.name, onPress: () => navigate(`/folders/${f.id}`) })),
    { label: documentTitle },
  ]

  return (
    <section className={`mybook-document-editor min-h-dvh w-full pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0 ${documentSurfaceClass}`}>
      <AppHeader
        leadingAction="sidebar"
        onBack={navigateBack}
        breadcrumbs={editorBreadcrumbs}
        hideBreadcrumbsOnMobile
        title={documentTitle}
        titleRef={pageTitleRef}
        onRename={true}
        onBreadcrumbRename={updateTitle}
        status={<EditorStatus status={editorStatus} workspace={editorStatusWorkspace} onRetry={() => void backupNow()} />}
        addNewAction={false}
        shareAction={true}
        favoriteAction={true}
        isFavorite={file.isFavorite}
        onFavorite={() => void toggleDocumentFavorite()}
        moreAction={true}
        moreMenuClassName="min-w-64"
        moreContent={
          <>
            <DropdownMenuItem onClick={() => void saveAll()}>Save now</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void backupNow()}>Sync now</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!file.driveFileId} onClick={() => (file.driveFileId ? openDriveFileInBrowser(file.driveFileId) : undefined)}>
              Open backup in Drive
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!file.driveFileId} onClick={() => void copyDriveLink()}>
              Copy backup link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void duplicateDocument()}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDocumentViewMode(false)}>Page width</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDocumentViewMode(true)}>Full width</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom(75)}>Zoom 75%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom(100)}>Zoom 100%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom(125)}>Zoom 125%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom(150)}>Zoom 150%</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().undo().run()}>Undo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().redo().run()}>Redo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear formatting</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={setEditorLink}>Link</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().insertContent(calloutNode()).run()}>Callout</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().insertContent(toggleBlockNode()).run()}>Toggle</DropdownMenuItem>
            <DropdownMenuItem onClick={openImagePicker}>Image</DropdownMenuItem>
            <DropdownMenuItem onClick={openFilePicker}>File attachment</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}>Basic Table</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().insertContent({ type: 'paragraph' }).run()}>Horizontal rule</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>Paragraph</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}>Heading 1</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}>Heading 2</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}>Heading 3</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleBold().run()}>Bold</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleUnderline().run()}>Underline</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleStrike().run()}>Strikethrough</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void exportMarkdown(true)}>Download Markdown (.md)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportDocx(true)}>Download DOCX</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportDocx(false)}>Prepare DOCX</DropdownMenuItem>
            <DropdownMenuItem onClick={() => importInputRef.current?.click()}>Import document</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>Move to Trash</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void close()}>Close document</DropdownMenuItem>
            {!isLocalWorkspace ? (
              <>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                  <span>Cloud sync</span>
                  <span className="font-medium text-foreground">
                    {editorStatus === 'backing-up' ? 'Syncing…' : file.syncStatus === 'backed-up' ? 'Synced' : 'Saved locally'}
                  </span>
                </div>
              </>
            ) : null}
          </>
        }
      />
      <nav aria-label="Desktop document commands" className="hidden">
        <DesktopMenu label="Document">
          <Dropdown.Menu aria-label="Document menu" onAction={handleDocumentAction}>
            <Dropdown.Item id="save">Save now</Dropdown.Item>
            <Dropdown.Item id="backup">Sync now</Dropdown.Item>
            <Dropdown.Item id="import">Import document</Dropdown.Item>
            <Dropdown.Item id="duplicate">Duplicate</Dropdown.Item>
            <Dropdown.Item id="export-markdown">Export Writin Markdown</Dropdown.Item>
            <Dropdown.Item id="download-docx">Download DOCX</Dropdown.Item>
            <Dropdown.Item id="prepare-docx">Prepare DOCX</Dropdown.Item>
            <Dropdown.Item id="delete" variant="danger">Move to Trash</Dropdown.Item>
            <Dropdown.Item id="close">Close document</Dropdown.Item>
          </Dropdown.Menu>
        </DesktopMenu>
        <DesktopMenu label="Edit">
          <Dropdown.Menu aria-label="Edit menu" onAction={handleDocumentAction}>
            <Dropdown.Item id="undo" isDisabled={!editor.can().chain().focus().undo().run()}>Undo</Dropdown.Item>
            <Dropdown.Item id="redo" isDisabled={!editor.can().chain().focus().redo().run()}>Redo</Dropdown.Item>
            <Dropdown.Item id="clear" isDisabled={!editor.can().chain().focus().unsetAllMarks().clearNodes().run()}>Clear formatting</Dropdown.Item>
          </Dropdown.Menu>
        </DesktopMenu>
        <DesktopMenu label="View">
          <Dropdown.Menu aria-label="View menu" onAction={handleDocumentAction}>
            <Dropdown.Item id="page-width">Page width</Dropdown.Item>
            <Dropdown.Item id="full-width">Full width</Dropdown.Item>
            <Dropdown.Item id="zoom-75">Zoom 75%</Dropdown.Item>
            <Dropdown.Item id="zoom-100">Zoom 100%</Dropdown.Item>
            <Dropdown.Item id="zoom-125">Zoom 125%</Dropdown.Item>
            <Dropdown.Item id="zoom-150">Zoom 150%</Dropdown.Item>
            <Dropdown.Item id="open-drive" isDisabled={!file.driveFileId}>Open backup in Drive</Dropdown.Item>
            <Dropdown.Item id="copy-link" isDisabled={!file.driveFileId}>Copy backup link</Dropdown.Item>
          </Dropdown.Menu>
        </DesktopMenu>
        <DesktopMenu label="Insert">
          <Dropdown.Menu aria-label="Insert menu" onAction={handleDocumentAction}>
            <Dropdown.Item id="link">Link</Dropdown.Item>
            <Dropdown.Item id="callout">Callout</Dropdown.Item>
            <Dropdown.Item id="toggle">Toggle</Dropdown.Item>
            <Dropdown.Item id="image">Image</Dropdown.Item>
            <Dropdown.Item id="file">File attachment</Dropdown.Item>
            <Dropdown.Item id="table" isDisabled={!editor.can().chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}>Basic Table</Dropdown.Item>
            <Dropdown.Item id="hr" isDisabled={!editor.can().chain().focus().setHorizontalRule().run()}>Horizontal rule</Dropdown.Item>
          </Dropdown.Menu>
        </DesktopMenu>
        <DesktopMenu label="Format">
          <Dropdown.Menu aria-label="Format menu" onAction={handleDocumentAction}>
            <Dropdown.Item id="paragraph">Paragraph</Dropdown.Item>
            <Dropdown.Item id="h1">Heading 1</Dropdown.Item>
            <Dropdown.Item id="h2">Heading 2</Dropdown.Item>
            <Dropdown.Item id="h3">Heading 3</Dropdown.Item>
            <Dropdown.Item id="h4">Heading 4</Dropdown.Item>
            <Dropdown.Item id="bold">Bold</Dropdown.Item>
            <Dropdown.Item id="italic">Italic</Dropdown.Item>
            <Dropdown.Item id="underline">Underline</Dropdown.Item>
            <Dropdown.Item id="strike">Strikethrough</Dropdown.Item>
            <Dropdown.Item id="code">Inline code</Dropdown.Item>
            <Dropdown.Item id="code-block">Code block</Dropdown.Item>
            <Dropdown.Item id="quote">Quote</Dropdown.Item>
            <Dropdown.Item id="bullet">Bulleted list</Dropdown.Item>
            <Dropdown.Item id="numbered">Numbered list</Dropdown.Item>
            <Dropdown.Item id="task">To-do list</Dropdown.Item>
          </Dropdown.Menu>
        </DesktopMenu>
        <div className="ml-auto hidden items-center gap-2 text-sm text-muted-foreground lg:flex" role="group" aria-label="Document view controls">
          <button
            type="button"
            aria-pressed={!isFullWidth}
            onClick={() => setDocumentViewMode(false)}
            className={`h-8 rounded-[8px] px-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${!isFullWidth ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)] hover:text-foreground'}`}
          >
            Page
          </button>
          <button
            type="button"
            aria-pressed={isFullWidth}
            onClick={() => setDocumentViewMode(true)}
            className={`h-8 rounded-[8px] px-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${isFullWidth ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)] hover:text-foreground'}`}
          >
            Full
          </button>
          <label className="sr-only" htmlFor="document-zoom">Document zoom</label>
          <select
            id="document-zoom"
            aria-label="Document zoom"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-8 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
        </div>
      </nav>
      <div className="hidden"><DocumentToolbar editor={editor} onInsertFile={openFilePicker} onInsertImage={openImagePicker} onInsertBlock={insertBlock} variant="desktop" /></div>
      <input ref={importInputRef} type="file" accept=".docx,.md,.mybook.md,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Import document file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void importDocumentFile(selectedFile); event.target.value = '' }} />
      <input ref={fileInputRef} type="file" className="sr-only" aria-label="Attach file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void insertAttachmentFile(selectedFile); event.target.value = '' }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" aria-label="Insert image" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void insertImageFile(selectedFile); event.target.value = '' }} />
      {docxMessage ? <p role="status" className="mx-auto mt-3 max-w-3xl px-4 text-sm text-muted-foreground sm:px-6">{docxMessage}<span className="sr-only">{docxBlob ? ` Export size ${docxBlob.size} bytes.` : ''}</span></p> : null}
      <div
        className="mybook-document-canvas w-full overflow-x-clip px-0 py-0"
        onMouseDownCapture={(event) => {
          const target = event.target
          if (!(target instanceof Element)) return
          if (isEditorInteractiveTarget(target) || (target.closest('[contenteditable="true"]') && !editor.view.dom.contains(target))) {
            blankOverlayRef.current?.remove()
            blankOverlayRef.current = null
            blankSelectionRangeRef.current = null
            return
          }
          if (!target.closest('.tableWrapper')) clearTableSelection(editor)
          const isInsideEditor = editor.view.dom.contains(target)
          if (isInsideEditor && !isBlankEditorPoint(editor, target)) {
            blankOverlayRef.current?.remove()
            blankOverlayRef.current = null
            blankSelectionRangeRef.current = null
            clearBlankBlockHighlight(editor)
            return
          }
          keepEditorFocusedOnBlankClick(editor, event.nativeEvent)
          blankOverlayRef.current?.remove()
          blankOverlayRef.current = null
          blankSelectionRangeRef.current = null
          const startY = event.clientY
          let overlay: HTMLDivElement | null = null
          let isDraggingBlankArea = false
          const updateHead = (moveEvent: MouseEvent) => {
            if (!isDraggingBlankArea && Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) < 4) return
            if (!isDraggingBlankArea) {
              isDraggingBlankArea = true
              moveEvent.preventDefault()
              document.getSelection()?.removeAllRanges()
              editor.view.focus()
            }
            overlay?.remove()
            overlay = createBlankBlockOverlay(editor, startY, moveEvent.clientY)
            blankOverlayRef.current = overlay
            blankSelectionRangeRef.current = blockDocumentRangeBetweenY(editor, startY, moveEvent.clientY)
          }
          const finish = () => {
            window.removeEventListener('mousemove', updateHead)
            window.removeEventListener('mouseup', finish)
          }
          window.addEventListener('mousemove', updateHead)
          window.addEventListener('mouseup', finish, { once: true })
          return
        }}
      >
        <div
          className={documentPageClass}
          style={{
            maxWidth: isFullWidth ? '100%' : '1536px',
            width: desktopPageWidth,
          }}
        >
          <div
            className="mybook-document-scale min-w-0 origin-top"
            style={{
              maxWidth: 'none',
              transform: `scale(${pageScale})`,
              transformOrigin: 'top center',
              width: '100%',
            }}
          >
            <DocumentLinkProvider
              currentFileId={file.id}
              files={files}
              openDocument={(targetId) => {
                const target = files.find((item) => item.id === targetId)
                navigate(target?.type === 'spreadsheet' ? `/spreadsheet/${targetId}` : `/document/${targetId}`)
              }}
            >
              <div className="mb-5">
                <label htmlFor="page-document-title" className="sr-only">Page title</label>
                <textarea
                  ref={pageTitleRef}
                  id="page-document-title"
                  value={title}
                  rows={1}
                  placeholder={placeholderTitle}
                  onFocus={(event) => {
                    const titleElement = event.currentTarget
                    window.requestAnimationFrame(() => titleElement.setSelectionRange(0, 0))
                  }}
                  onChange={(event) => updateTitle(event.target.value.replace(/\r?\n/g, ' '))}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    editor.chain().focus('start').run()
                  }}
                  className="block min-h-[2.1875rem] sm:min-h-[3.5rem] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.75rem] font-extrabold leading-[1.25] sm:leading-[1.12] tracking-normal text-foreground outline-none placeholder:text-muted-foreground placeholder:opacity-60 focus-visible:ring-0 sm:text-5xl"
                  aria-label="Page title"
                />
              </div>
              <EditorContent editor={editor} />
            </DocumentLinkProvider>
          </div>
        </div>
      </div>
      {slashMenu ? (
        isMobile ? (
          <MobileSlashCommandMenu
            menu={slashMenu}
            selectedIndex={slashSelectedIndex}
            onSelectIndex={(index) => {
              slashSelectedIndexRef.current = index
              setSlashSelectedIndex(index)
            }}
            onRun={(command) => runSelectedSlashCommand(command.id, slashMenu)}
          />
        ) : (
          <SlashCommandMenu
            menu={slashMenu}
            selectedIndex={slashSelectedIndex}
            onSelectIndex={(index) => {
              slashSelectedIndexRef.current = index
              setSlashSelectedIndex(index)
            }}
            onRun={(command) => runSelectedSlashCommand(command.id, slashMenu)}
          />
        )
      ) : null}
      {pasteAsMenu ? <PasteAsMenu menu={pasteAsMenu} onChoose={choosePasteAs} onClose={closePasteAsMenu} /> : null}
      {inlineLinkToolbar ? <InlineLinkToolbar toolbar={inlineLinkToolbar} onAction={runInlineLinkAction} onClose={closeInlineLinkToolbar} /> : null}
      <EditorBlockControls editor={editor} onInsertBlock={insertBlock} />
      <TableActionsMenu editor={editor} />
      <ChecklistActionsMenu editor={editor} />
      {documentLinkPicker ? (
        <DocumentLinkPicker
          currentFileId={file.id}
          files={files}
          folders={folders}
          position={documentLinkPicker.position}
          query={documentLinkPicker.query}
          selectedIndex={documentLinkSelectedIndex}
          onSelectIndex={(index) => {
            documentLinkSelectedIndexRef.current = index
            setDocumentLinkSelectedIndex(index)
          }}
          onClose={closeDocumentLinkPicker}
          onSelect={insertDocumentLink}
        />
      ) : null}
      {imagePicker ? (
        <ImageBlockPicker
          position={imagePicker.position}
          onClose={closeImagePicker}
          onInsert={handleInsertImage}
        />
      ) : null}
      {videoPicker ? (
        <VideoBlockPicker
          position={videoPicker.position}
          onClose={closeVideoPicker}
          onInsert={handleInsertVideo}
        />
      ) : null}
      {audioPicker ? (
        <AudioBlockPicker
          position={audioPicker.position}
          onClose={closeAudioPicker}
          onInsert={handleInsertAudio}
        />
      ) : null}
      {filePicker ? (
        <FileBlockPicker
          position={filePicker.position}
          onClose={closeFilePicker}
          onInsert={handleInsertFile}
        />
      ) : null}
      <DocumentToolbar editor={editor} onInsertFile={openFilePicker} onInsertImage={openImagePicker} onInsertBlock={insertBlock} variant="mobile" />
      <DeleteFileDialog
        isOpen={isDeleteDialogOpen}
        fileName={documentTitle}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => { void deleteDocument() }}
      />
    </section>
  )
}
