import { ArrowLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '../ui/compat-dropdown'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { Extension } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { AllSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import { useLibraryData } from '../../hooks/useLibraryData'
import { useIsMobile } from '../../hooks/use-mobile'
import { backupDocumentToDrive, copyDriveFileLink, openDriveFileInBrowser } from '../../services/googleDrive'
import { documentToMyBookMarkdown, downloadMyBookMarkdown, myBookMarkdownToDocument } from '../../utils/mybookMarkdown'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { DeleteFileDialog } from '../files/DeleteFileDialog'
import { FolderBreadcrumb } from '../files/FolderBreadcrumb'
import { ChecklistActionsMenu } from './ChecklistActionsMenu'
import { DocumentToolbar } from './DocumentToolbar'
import { EditorBlockControls } from './EditorBlockControls'
import { EditorStatus } from './EditorStatus'
import { Callout, calloutNode } from './extensions/Callout'
import { CodeBlock } from './extensions/CodeBlock'
import { DatabaseBlock } from './extensions/DatabaseBlock'
import { DocumentLink, documentLinkNode } from './extensions/DocumentLink'
import { FileAttachment, fileAttachmentNode } from './extensions/FileAttachment'
import { ImageBlock, imageBlockNode } from './extensions/ImageBlock'
import { TableOfContents } from './extensions/TableOfContents'
import { ToggleBlock, toggleBlockNode } from './extensions/ToggleBlock'
import { FixedTable } from './extensions/FixedTable'
import { TableInteraction } from './extensions/TableInteraction'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { DocumentLinkProvider } from './DocumentLinkContext'
import { documentLinkTargets } from './documentLinkModel'
import { clearTableSelection, isBlankEditorPoint, isEditorInteractiveTarget, keepEditorFocusedOnBlankClick } from './editorFocus'
import { MobileSlashCommandMenu, SlashCommandMenu } from './SlashCommandMenu'
import { filterSlashCommands, getSlashMenuState, runSlashCommand, type SlashMenuState } from './slashCommands'
import { TableActionsMenu } from './TableActionsMenu'
import { devLog } from '../../utils/safeLog'
import { deletedToast } from '../../utils/deleteToast'
import { toast } from '../ui/toast'

const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] }
const documentViewModeStorageKey = 'mybook-document-view-mode'
const emptyBlockPlaceholderClass = 'mybook-empty-block-placeholder'
const quoteEmptyPlaceholderClass = 'mybook-quote-empty-placeholder'
const emptyBlockPlaceholderKey = new PluginKey<{ focused: boolean }>('emptyBlockPlaceholder')
const listMarkerDepthKey = new PluginKey('listMarkerDepth')
const blankBlockSelectionKey = new PluginKey<{ anchor: number | null; head: number | null }>('blankBlockSelection')
const blankSelectableBlockSelector = ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote, :scope > pre, :scope > .mybook-toggle, :scope > ul > li, :scope > ol > li, :scope > [data-type="taskItem"]'
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
        init: () => ({ focused: false }),
        apply(transaction, value) {
          const focused = transaction.getMeta(emptyBlockPlaceholderKey)?.focused
          return focused === undefined ? value : { focused }
        },
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          const isEditorFocused = emptyBlockPlaceholderKey.getState(state)?.focused === true
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

function DesktopMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Dropdown>
      <Dropdown.Trigger
        className="h-9 rounded-[8px] px-3 text-sm font-medium text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-label={`${label} menu`}
      >
        {label}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">{children}</Dropdown.Popover>
    </Dropdown>
  )
}

function DocumentLinkPicker({
  currentFileId,
  files,
  folderLabel,
  isOpen,
  onClose,
  onSelect,
}: {
  currentFileId: string
  files: NonNullable<ReturnType<typeof useLibraryData>['files']>
  folderLabel: (folderId: string | null) => string
  isOpen: boolean
  onClose: () => void
  onSelect: (target: { id: string; name: string }) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
    if (isOpen) setQuery('')
  }, [isOpen])

  const documents = useMemo(() => {
    return documentLinkTargets(files, currentFileId, query)
  }, [currentFileId, files, query])

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-1rem))] rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop:bg-black/35"
      aria-labelledby="document-link-picker-title"
    >
      <div className="border-b border-[var(--app-border)] px-4 py-3">
        <h2 id="document-link-picker-title" className="text-sm font-semibold">Link to document</h2>
        <label className="sr-only" htmlFor="document-link-search">Search documents</label>
        <input
          id="document-link-search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents..."
          className="mt-3 h-10 w-full rounded-[8px] border border-[var(--app-border)] bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      </div>
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
        {documents.length ? documents.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect({ id: item.id, name: item.name })}
            className="flex min-h-12 w-full flex-col rounded-[7px] px-3 py-2 text-left transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={`Link to document ${item.name}`}
          >
            <span className="break-words text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{folderLabel(item.folderId)}</span>
          </button>
        )) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{query.trim() ? 'No documents found.' : 'No other documents available.'}</p>
        )}
      </div>
      <div className="flex justify-end border-t border-[var(--app-border)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-[8px] px-3 text-sm font-medium text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Cancel
        </button>
      </div>
    </dialog>
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
  const [isDocumentLinkPickerOpen, setIsDocumentLinkPickerOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pageTitleRef = useRef<HTMLTextAreaElement>(null)
  const cloudTimerRef = useRef<number | null>(null)
  const cloudFlightRef = useRef(false)
  const editorContentRef = useRef('')
  const titleRef = useRef('')
  const lastSavedTitleRef = useRef('')
  const loadedTitleFileIdRef = useRef<string | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashSelectedIndexRef = useRef(0)
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
  const updateSlashMenu = useCallback((currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3, 4] } }),
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
      FileAttachment,
      ImageBlock,
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
      handleTextInput: () => {
        blankOverlayRef.current?.remove()
        blankOverlayRef.current = null
        blankSelectionRangeRef.current = null
        return false
      },
      handleDOMEvents: {
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
          restoreLastActiveSelection()
          return true
        },
      },
      handleKeyDown: (_view, event) => {
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
      updateSlashMenu(currentEditor)
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
      updateSlashMenu(currentEditor)
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

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

  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  useEffect(() => {
    window.addEventListener('mybook:insert-image', openImagePicker)
    return () => window.removeEventListener('mybook:insert-image', openImagePicker)
  }, [openImagePicker])

  useEffect(() => {
    window.addEventListener('mybook:insert-file', openFilePicker)
    return () => window.removeEventListener('mybook:insert-file', openFilePicker)
  }, [openFilePicker])

  const openDocumentLinkPicker = useCallback(() => {
    setIsDocumentLinkPickerOpen(true)
  }, [])

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
  const saveTitle = useCallback(async () => {
    const nextTitle = titleRef.current.trim()
    if (!file || !nextTitle || nextTitle === file.name) return
    const result = await fileRepository.update(file.id, { name: nextTitle })
    if (result.success) {
      lastSavedTitleRef.current = nextTitle
      updateTitle(nextTitle)
    }
  }, [file, updateTitle])
  useEffect(() => {
    if (!file || file.isDeleted) return
    if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)
    if (status !== 'pending' && status !== 'saved-locally') return
    cloudTimerRef.current = window.setTimeout(() => {
      if (cloudFlightRef.current || !file || file.isDeleted || file.type !== 'document') return
      cloudFlightRef.current = true
      void (async () => {
        try {
          const [savedContent] = await Promise.all([save(), saveTitle()])
          if (!savedContent) return
          const result = await backupDocumentToDrive({ fileId: file.id, title: titleRef.current.trim() || file.name || 'Untitled', content, folderId: file.folderId })
          if (!result.success) toast.add({ title: "Couldn't sync", description: result.error, type: 'error', priority: 'low' })
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
    const result = await backupDocumentToDrive({ fileId: latest.id, title: latest.name, content: latest.content, folderId: latest.folderId })
    if (!result.success) toast.add({ title: "Couldn't sync", description: result.error ?? 'Sync failed.', type: 'error', priority: 'low' })
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
  const close = async () => { await saveAll(); navigate(file.folderId ? `/folders/${file.folderId}` : '/home') }
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

  const folderLabel = (folderId: string | null) => {
    if (!folderId) return 'MyBook root'
    return folders.find((folder) => folder.id === folderId)?.name ?? 'Unknown folder'
  }

  const insertDocumentLink = (target: { id: string; name: string }) => {
    editor.chain().focus().insertContent(documentLinkNode({ targetId: target.id, label: target.name })).run()
    setIsDocumentLinkPickerOpen(false)
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
      setDocxMessage(download ? 'MyBook Markdown downloaded.' : 'MyBook Markdown ready.')
      if (download) downloadMyBookMarkdown(markdown, documentTitle)
    } catch (error) {
      devLog('error', 'Could not export MyBook Markdown.', error)
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
      if (/\.md$/i.test(selectedFile.name)) setDocxMessage('MyBook Markdown imported.')
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
    else if (action === 'code-block') editor.chain().focus().toggleCodeBlock().run()
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

  return (
    <section className={`mybook-document-editor min-h-dvh w-full pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0 ${documentSurfaceClass}`}>
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center gap-2">
          <button type="button" onClick={() => void close()} aria-label="Close document" className="flex size-11 shrink-0 items-center justify-center rounded-[10px] transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><ArrowLeftIcon aria-hidden="true" className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <label htmlFor="document-title" className="sr-only">Document title</label>
            <input
              id="document-title"
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              onBlur={() => void saveTitle()}
              placeholder={placeholderTitle}
                  className="h-8 w-full truncate rounded-[6px] bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground placeholder:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <EditorStatus status={editorStatus} workspace={editorStatusWorkspace} onRetry={() => void backupNow()} />
            <div className="mt-1">
              <FolderBreadcrumb currentFolderId={file.folderId} folders={folders} currentPageLabel={title.trim() || placeholderTitle} onNavigate={navigate} />
            </div>
          </div>
          <Dropdown><Dropdown.Trigger aria-label="More document actions" className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon aria-hidden="true" className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label="Document actions" onAction={handleDocumentAction}><Dropdown.Item id="save">Save now</Dropdown.Item><Dropdown.Item id="backup">Sync now</Dropdown.Item><Dropdown.Item id="open-drive" isDisabled={!file.driveFileId}>Open backup in Drive</Dropdown.Item><Dropdown.Item id="copy-link" isDisabled={!file.driveFileId}>Copy backup link</Dropdown.Item><Dropdown.Item id="duplicate">Duplicate</Dropdown.Item><Dropdown.Item id="export-markdown">Export MyBook Markdown</Dropdown.Item><Dropdown.Item id="download-docx">Download DOCX</Dropdown.Item><Dropdown.Item id="prepare-docx">Prepare DOCX</Dropdown.Item><Dropdown.Item id="import">Import document</Dropdown.Item><Dropdown.Item id="delete" variant="danger">Move to Trash</Dropdown.Item><Dropdown.Item id="close">Close document</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void saveAll()}>Save</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void backupNow()}>Sync now</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" isDisabled={!file.driveFileId} onPress={() => file.driveFileId ? openDriveFileInBrowser(file.driveFileId) : undefined}>Open backup</AppButton>
        </div>
        <nav aria-label="Desktop document commands" className="hidden min-h-10 items-center gap-1 border-t border-[var(--app-border)] md:flex">
          <DesktopMenu label="Document">
            <Dropdown.Menu aria-label="Document menu" onAction={handleDocumentAction}>
              <Dropdown.Item id="save">Save now</Dropdown.Item>
              <Dropdown.Item id="backup">Sync now</Dropdown.Item>
              <Dropdown.Item id="import">Import document</Dropdown.Item>
              <Dropdown.Item id="duplicate">Duplicate</Dropdown.Item>
              <Dropdown.Item id="export-markdown">Export MyBook Markdown</Dropdown.Item>
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
        <DocumentToolbar editor={editor} onInsertFile={openFilePicker} onInsertImage={openImagePicker} onInsertBlock={insertBlock} variant="desktop" />
      </header>
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
              openDocument={(targetId) => navigate(`/document/${targetId}`)}
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
                  className="block min-h-[3.5rem] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[2.75rem] font-extrabold leading-[1.12] tracking-normal text-foreground outline-none placeholder:text-muted-foreground placeholder:opacity-60 focus-visible:ring-0 sm:text-5xl"
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
      <EditorBlockControls editor={editor} onInsertBlock={insertBlock} />
      <TableActionsMenu editor={editor} />
      <ChecklistActionsMenu editor={editor} />
      <DocumentLinkPicker
        currentFileId={file.id}
        files={files}
        folderLabel={folderLabel}
        isOpen={isDocumentLinkPickerOpen}
        onClose={() => setIsDocumentLinkPickerOpen(false)}
        onSelect={insertDocumentLink}
      />
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
