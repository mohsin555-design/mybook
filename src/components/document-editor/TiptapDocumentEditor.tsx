import { ArrowLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '@heroui/react'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState, type Key, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import { backupDocumentToDrive, copyDriveFileLink, getDriveFileStatus, openDriveFileInBrowser } from '../../services/googleDrive'
import { documentToMyBookMarkdown, downloadMyBookMarkdown, myBookMarkdownToDocument } from '../../utils/mybookMarkdown'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { BlockActionsMenu } from './BlockActionsMenu'
import { ChecklistActionsMenu } from './ChecklistActionsMenu'
import { DocumentToolbar } from './DocumentToolbar'
import { EditorStatus } from './EditorStatus'
import { Callout, calloutNode } from './extensions/Callout'
import { FileAttachment, fileAttachmentNode } from './extensions/FileAttachment'
import { ImageBlock, imageBlockNode } from './extensions/ImageBlock'
import { ToggleBlock, toggleBlockNode } from './extensions/ToggleBlock'
import { filterSlashCommands, runSlashCommand, SlashCommandMenu, type SlashMenuState } from './SlashCommandMenu'
import { TableActionsMenu } from './TableActionsMenu'
import { devLog } from '../../utils/safeLog'

const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] }

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

function getSlashMenuState(editor: NonNullable<ReturnType<typeof useEditor>>): SlashMenuState | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return null
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')
  const match = /(?:^|\s)\/([a-zA-Z0-9-]*)$/.exec(textBeforeCursor)
  if (!match) return null
  const query = match[1] ?? ''
  const slashOffset = textBeforeCursor.length - query.length - 1
  const from = $from.start() + slashOffset
  const to = $from.pos
  const coords = editor.view.coordsAtPos(to)
  return { query, range: { from, to }, rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top) }
}

function DesktopMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Dropdown>
      <Dropdown.Trigger
        className="h-9 rounded-[8px] px-3 text-sm font-medium text-muted transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-label={`${label} menu`}
      >
        {label}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">{children}</Dropdown.Popover>
    </Dropdown>
  )
}

export function TiptapDocumentEditor({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
  const { content, isHydrated, save, setContent, status } = useAutosave(file)
  const [title, setTitle] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [docxMessage, setDocxMessage] = useState('')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [driveExists, setDriveExists] = useState<boolean | null>(null)
  const [isCheckingDrive, setIsCheckingDrive] = useState(false)
  const [hasCheckedDrive, setHasCheckedDrive] = useState(false)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [isFullWidth, setIsFullWidth] = useState(false)
  const [zoom, setZoom] = useState(100)
  const importInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cloudTimerRef = useRef<number | null>(null)
  const cloudFlightRef = useRef(false)
  const editorContentRef = useRef('')
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashSelectedIndexRef = useRef(0)
  const editorRef = useRef<NonNullable<ReturnType<typeof useEditor>> | null>(null)
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
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Underline,
      Callout,
      FileAttachment,
      ImageBlock,
      ToggleBlock,
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
      handleKeyDown: (_view, event) => {
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
    onSelectionUpdate: ({ editor: currentEditor }) => updateSlashMenu(currentEditor),
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

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

  useEffect(() => { if (file) setTitle(file.name) }, [file])
  useEffect(() => {
    if (!file?.driveFileId) { setDriveExists(null); return }
    void getDriveFileStatus(file.driveFileId).then((result) => setDriveExists(result.exists))
  }, [file?.driveFileId])
  const checkDriveChanges = useCallback(async () => {
    if (!file?.driveFileId || !file.lastSyncedAt) { setHasCheckedDrive(true); return }
    setIsCheckingDrive(true)
    try {
      const result = await getDriveFileStatus(file.driveFileId)
      setDriveExists(result.exists)
      if (result.exists) setCloudMessage('Drive backup is available.')
      else if (result.error) setCloudMessage(result.error)
    } finally { setIsCheckingDrive(false); setHasCheckedDrive(true) }
  }, [file?.driveFileId, file?.lastSyncedAt])
  useEffect(() => {
    void checkDriveChanges()
  }, [checkDriveChanges])
  useEffect(() => {
    if (!editor || !file || !isHydrated) return
    if (loadedId === file.id && content === editorContentRef.current) return
    editor.commands.setContent(parseContent(content), { emitUpdate: false })
    editorContentRef.current = content
    setLoadedId(file.id)
  }, [content, editor, file, isHydrated, loadedId])
  const saveTitle = useCallback(async () => {
    if (title !== file?.name && file) await fileRepository.update(file.id, { name: title })
  }, [file, title])
  useEffect(() => {
    if (!file || file.isDeleted || isCheckingDrive || !hasCheckedDrive) return
    if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)
    if (status !== 'pending' && status !== 'saved-locally') return
    cloudTimerRef.current = window.setTimeout(() => {
      if (cloudFlightRef.current || !file || file.isDeleted || file.type !== 'document') return
      cloudFlightRef.current = true
      setCloudMessage('Preparing cloud backup…')
      void (async () => {
        try {
          const [savedContent] = await Promise.all([save(), saveTitle()])
          if (!savedContent) {
            setCloudMessage('Local save failed. Cloud backup paused.')
            return
          }
          const result = await backupDocumentToDrive({ fileId: file.id, title, content, folderId: file.folderId })
          if (result.success) setCloudMessage(result.created ? 'Google Drive backup created.' : 'Google Drive backup updated.')
          else setCloudMessage(result.error)
        } finally {
          cloudFlightRef.current = false
        }
      })()
    }, 3000)
    return () => {
      if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = null
    }
  }, [content, file, hasCheckedDrive, isCheckingDrive, save, saveTitle, status, title])

  if (file === undefined || !editor) return <div role="status" className="p-4 text-muted">Loading editor…</div>
  if (!file || file.isDeleted) return <EmptyState title="Document not found" description="This document may have been moved to Trash or deleted." />

  const saveAll = async () => { await Promise.all([save(), saveTitle()]) }
  const backupNow = async () => {
    if (!file) return
    await saveAll()
    const latest = (await fileRepository.get(file.id)).data
    if (!latest) return
    setCloudMessage('Backing up to Google Drive…')
    const result = await backupDocumentToDrive({ fileId: latest.id, title: latest.name, content: latest.content, folderId: latest.folderId })
    setCloudMessage(result.success ? 'Google Drive backup complete.' : result.error ?? 'Google Drive backup failed.')
    if (result.success) setDriveExists(true)
  }
  const copyDriveLink = async () => {
    if (!file.driveFileId) return
    const result = await copyDriveFileLink(file.driveFileId)
    setCloudMessage(result.success ? 'Drive link copied.' : result.error ?? 'Could not copy the Drive link.')
  }
  const close = async () => { await saveAll(); navigate(file.folderId ? `/folders/${file.folderId}` : '/home') }

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
      const blob = await createDocxBlob(title, editor.getJSON())
      setDocxBlob(blob)
      setDocxMessage(download ? 'DOCX downloaded.' : 'DOCX ready for backup.')
      if (download) downloadDocx(blob, title)
    } catch (error) {
      devLog('error', 'Could not export DOCX.', error)
      setDocxMessage('DOCX export failed.')
    }
  }

  const exportMarkdown = async (download: boolean) => {
    try {
      const markdown = documentToMyBookMarkdown(title, editor.getJSON())
      setDocxMessage(download ? 'MyBook Markdown downloaded.' : 'MyBook Markdown ready.')
      if (download) downloadMyBookMarkdown(markdown, title)
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
      setTitle(importedTitle)
      await fileRepository.update(file.id, { name: importedTitle })
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
      editor.chain().focus().insertContent(imageBlockNode(src, selectedFile.name.replace(/\.[^.]+$/u, ''))).run()
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
      editor.chain().focus().insertContent(fileAttachmentNode(src, selectedFile.name, selectedFile.type, selectedFile.size)).run()
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
    else if (action === 'refresh') void checkDriveChanges()
    else if (action === 'import') importInputRef.current?.click()
    else if (action === 'undo') editor.chain().focus().undo().run()
    else if (action === 'redo') editor.chain().focus().redo().run()
    else if (action === 'clear') editor.chain().focus().unsetAllMarks().clearNodes().run()
    else if (action === 'link') setEditorLink()
    else if (action === 'callout') editor.chain().focus().insertContent(calloutNode()).run()
    else if (action === 'toggle') editor.chain().focus().insertContent(toggleBlockNode()).run()
    else if (action === 'image') openImagePicker()
    else if (action === 'file') openFilePicker()
    else if (action === 'table') editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    else if (action === 'hr') editor.chain().focus().setHorizontalRule().run()
    else if (action === 'paragraph') editor.chain().focus().setParagraph().run()
    else if (action === 'h1') editor.chain().focus().setHeading({ level: 1 }).run()
    else if (action === 'h2') editor.chain().focus().setHeading({ level: 2 }).run()
    else if (action === 'h3') editor.chain().focus().setHeading({ level: 3 }).run()
    else if (action === 'bold') editor.chain().focus().toggleBold().run()
    else if (action === 'italic') editor.chain().focus().toggleItalic().run()
    else if (action === 'underline') editor.chain().focus().toggleUnderline().run()
    else if (action === 'strike') editor.chain().focus().toggleStrike().run()
    else if (action === 'code') editor.chain().focus().toggleCode().run()
    else if (action === 'code-block') editor.chain().focus().toggleCodeBlock().run()
    else if (action === 'quote') editor.chain().focus().toggleBlockquote().run()
    else if (action === 'bullet') editor.chain().focus().toggleBulletList().run()
    else if (action === 'numbered') editor.chain().focus().toggleOrderedList().run()
    else if (action === 'task') editor.chain().focus().toggleTaskList().run()
    else if (action === 'page-width') setIsFullWidth(false)
    else if (action === 'full-width') setIsFullWidth(true)
    else if (action.startsWith('zoom-')) setZoom(Number(action.replace('zoom-', '')))
    else void close()
  }

  const runSelectedSlashCommand = (commandId: string, menu: SlashMenuState) => {
    runSlashCommand(editor, commandId, menu.range)
    slashMenuRef.current = null
    setSlashMenu(null)
  }

  const pageScale = zoom / 100
  const desktopPageWidth = isFullWidth ? '100%' : `${Math.round(1024 * pageScale)}px`
  const documentSurfaceClass = isFullWidth ? 'bg-[var(--app-surface)]' : 'bg-[var(--app-subtle)]'
  const documentPageClass = isFullWidth
    ? 'mybook-document-page mx-auto min-h-[calc(100dvh-13rem)] w-full bg-[var(--app-surface)] px-6 py-10 shadow-none sm:px-8 md:min-h-[calc(100dvh-13rem)] md:px-12 md:py-16 lg:px-16'
    : 'mybook-document-page mybook-document-page--continuous mx-auto min-h-[calc(100dvh-13rem)] w-full bg-transparent px-4 pb-[55vh] pt-6 shadow-none sm:px-6 md:px-16 md:pb-[55vh] md:pt-14'

  return (
    <section className={`mybook-document-editor min-h-dvh w-full pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0 ${documentSurfaceClass}`}>
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center gap-2">
          <button type="button" onClick={() => void close()} aria-label="Close document" className="flex size-11 shrink-0 items-center justify-center rounded-[10px] transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><ArrowLeftIcon aria-hidden="true" className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <label htmlFor="document-title" className="sr-only">Document title</label>
            <input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} className="h-8 w-full truncate rounded-[6px] bg-transparent text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
            <EditorStatus status={status} />
            {cloudMessage ? <p className="mt-1 text-xs text-muted">{cloudMessage}</p> : null}
            {file.driveFileId ? <p className="mt-1 text-xs text-muted">{driveExists === false ? 'Drive file not found' : 'Drive file exists'}{file.lastSyncedAt ? ` · Last backup ${new Date(file.lastSyncedAt).toLocaleString()}` : ''}{file.syncError ? ` · ${file.syncError}` : ''}</p> : null}
          </div>
          <Dropdown><Dropdown.Trigger aria-label="More document actions" className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon aria-hidden="true" className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label="Document actions" onAction={handleDocumentAction}><Dropdown.Item id="save">Save now</Dropdown.Item><Dropdown.Item id="backup">Back up now</Dropdown.Item><Dropdown.Item id="open-drive" isDisabled={!file.driveFileId || driveExists === false}>Open in Drive</Dropdown.Item><Dropdown.Item id="copy-link" isDisabled={!file.driveFileId || driveExists === false}>Copy Drive link</Dropdown.Item><Dropdown.Item id="export-markdown">Export MyBook Markdown</Dropdown.Item><Dropdown.Item id="download-docx">Download DOCX</Dropdown.Item><Dropdown.Item id="prepare-docx">Prepare DOCX</Dropdown.Item><Dropdown.Item id="import">Import document</Dropdown.Item><Dropdown.Item id="close">Close document</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void saveAll()}>Save</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void backupNow()}>Back up now</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" isDisabled={!file.driveFileId || driveExists === false} onPress={() => file.driveFileId ? openDriveFileInBrowser(file.driveFileId) : undefined}>Open in Drive</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" isDisabled={isCheckingDrive || !file.driveFileId} onPress={() => void checkDriveChanges()}>Refresh</AppButton>
        </div>
        <nav aria-label="Desktop document commands" className="hidden min-h-10 items-center gap-1 border-t border-[var(--app-border)] md:flex">
          <DesktopMenu label="Document">
            <Dropdown.Menu aria-label="Document menu" onAction={handleDocumentAction}>
              <Dropdown.Item id="save">Save now</Dropdown.Item>
              <Dropdown.Item id="backup">Back up now</Dropdown.Item>
              <Dropdown.Item id="import">Import document</Dropdown.Item>
              <Dropdown.Item id="export-markdown">Export MyBook Markdown</Dropdown.Item>
              <Dropdown.Item id="download-docx">Download DOCX</Dropdown.Item>
              <Dropdown.Item id="prepare-docx">Prepare DOCX</Dropdown.Item>
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
              <Dropdown.Item id="open-drive" isDisabled={!file.driveFileId || driveExists === false}>Open in Drive</Dropdown.Item>
              <Dropdown.Item id="copy-link" isDisabled={!file.driveFileId || driveExists === false}>Copy Drive link</Dropdown.Item>
              <Dropdown.Item id="refresh" isDisabled={isCheckingDrive || !file.driveFileId}>Refresh backup status</Dropdown.Item>
            </Dropdown.Menu>
          </DesktopMenu>
          <DesktopMenu label="Insert">
            <Dropdown.Menu aria-label="Insert menu" onAction={handleDocumentAction}>
              <Dropdown.Item id="link">Link</Dropdown.Item>
              <Dropdown.Item id="callout">Callout</Dropdown.Item>
              <Dropdown.Item id="toggle">Toggle</Dropdown.Item>
              <Dropdown.Item id="image">Image</Dropdown.Item>
              <Dropdown.Item id="file">File attachment</Dropdown.Item>
              <Dropdown.Item id="table" isDisabled={!editor.can().chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</Dropdown.Item>
              <Dropdown.Item id="hr" isDisabled={!editor.can().chain().focus().setHorizontalRule().run()}>Horizontal rule</Dropdown.Item>
            </Dropdown.Menu>
          </DesktopMenu>
          <DesktopMenu label="Format">
            <Dropdown.Menu aria-label="Format menu" onAction={handleDocumentAction}>
              <Dropdown.Item id="paragraph">Paragraph</Dropdown.Item>
              <Dropdown.Item id="h1">Heading 1</Dropdown.Item>
              <Dropdown.Item id="h2">Heading 2</Dropdown.Item>
              <Dropdown.Item id="h3">Heading 3</Dropdown.Item>
              <Dropdown.Item id="bold">Bold</Dropdown.Item>
              <Dropdown.Item id="italic">Italic</Dropdown.Item>
              <Dropdown.Item id="underline">Underline</Dropdown.Item>
              <Dropdown.Item id="strike">Strikethrough</Dropdown.Item>
              <Dropdown.Item id="code">Inline code</Dropdown.Item>
              <Dropdown.Item id="code-block">Code block</Dropdown.Item>
              <Dropdown.Item id="quote">Blockquote</Dropdown.Item>
              <Dropdown.Item id="bullet">Bulleted list</Dropdown.Item>
              <Dropdown.Item id="numbered">Numbered list</Dropdown.Item>
              <Dropdown.Item id="task">Checklist</Dropdown.Item>
            </Dropdown.Menu>
          </DesktopMenu>
          <div className="ml-auto hidden items-center gap-2 text-sm text-muted lg:flex" role="group" aria-label="Document view controls">
            <button
              type="button"
              aria-pressed={!isFullWidth}
              onClick={() => setIsFullWidth(false)}
              className={`h-8 rounded-[8px] px-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${!isFullWidth ? 'bg-accent text-accent-foreground' : 'hover:bg-[var(--app-subtle)] hover:text-foreground'}`}
            >
              Page
            </button>
            <button
              type="button"
              aria-pressed={isFullWidth}
              onClick={() => setIsFullWidth(true)}
              className={`h-8 rounded-[8px] px-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${isFullWidth ? 'bg-accent text-accent-foreground' : 'hover:bg-[var(--app-subtle)] hover:text-foreground'}`}
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
        <DocumentToolbar editor={editor} onInsertFile={openFilePicker} onInsertImage={openImagePicker} variant="desktop" />
      </header>
      <input ref={importInputRef} type="file" accept=".docx,.md,.mybook.md,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Import document file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void importDocumentFile(selectedFile); event.target.value = '' }} />
      <input ref={fileInputRef} type="file" className="sr-only" aria-label="Attach file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void insertAttachmentFile(selectedFile); event.target.value = '' }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" aria-label="Insert image" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void insertImageFile(selectedFile); event.target.value = '' }} />
      {docxMessage ? <p role="status" className="mx-auto mt-3 max-w-3xl px-4 text-sm text-muted sm:px-6">{docxMessage}<span className="sr-only">{docxBlob ? ` Export size ${docxBlob.size} bytes.` : ''}</span></p> : null}
      <div className={`w-full overflow-x-auto px-0 py-0 ${isFullWidth ? 'md:px-0 md:py-0' : 'mybook-document-canvas md:px-8 md:py-8'}`}>
        <div
          className={documentPageClass}
          style={{
            maxWidth: '100%',
            width: desktopPageWidth,
          }}
        >
          <div
            className="mybook-document-scale mx-auto min-w-0 origin-top"
            style={{
              maxWidth: isFullWidth ? 'none' : '680px',
              transform: `scale(${pageScale})`,
              transformOrigin: 'top center',
              width: `${100 / pageScale}%`,
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      {slashMenu ? (
        <SlashCommandMenu
          menu={slashMenu}
          selectedIndex={slashSelectedIndex}
          onSelectIndex={(index) => {
            slashSelectedIndexRef.current = index
            setSlashSelectedIndex(index)
          }}
          onRun={(command) => runSelectedSlashCommand(command.id, slashMenu)}
        />
      ) : null}
      <TableActionsMenu editor={editor} />
      <ChecklistActionsMenu editor={editor} />
      <BlockActionsMenu editor={editor} />
      <DocumentToolbar editor={editor} onInsertFile={openFilePicker} onInsertImage={openImagePicker} variant="mobile" />
    </section>
  )
}
