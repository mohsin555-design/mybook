import { ArrowLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '@heroui/react'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import { backupDocumentToDrive, copyDriveFileLink, getDriveFileStatus, importDriveFilesToLocal, openDriveFileInBrowser, refreshDriveFileToLocal } from '../../services/googleDrive'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { DocumentToolbar } from './DocumentToolbar'
import { EditorStatus } from './EditorStatus'
import { devLog } from '../../utils/safeLog'

const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] }

function parseContent(content: string) {
  if (!content) return emptyDocument
  try { return JSON.parse(content) as object } catch { return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } }
}

export function TiptapDocumentEditor({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
  const { content, isHydrated, replaceContent, save, setContent, status } = useAutosave(file)
  const [title, setTitle] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [docxMessage, setDocxMessage] = useState('')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [driveExists, setDriveExists] = useState<boolean | null>(null)
  const [isCheckingDrive, setIsCheckingDrive] = useState(false)
  const [hasCheckedDrive, setHasCheckedDrive] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const cloudTimerRef = useRef<number | null>(null)
  const cloudFlightRef = useRef(false)
  const editorContentRef = useRef('')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Underline,
    ],
    content: emptyDocument,
    editorProps: { attributes: { class: 'tiptap min-h-[65vh] outline-none', 'aria-label': 'Document content' } },
    onUpdate: ({ editor: currentEditor }) => {
      const next = JSON.stringify(currentEditor.getJSON())
      editorContentRef.current = next
      setContent(next)
    },
  })

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
      if (result.modifiedTime && new Date(result.modifiedTime).getTime() > new Date(file.lastSyncedAt).getTime()) {
        await importDriveFilesToLocal()
      } else if (result.modifiedTime) {
        await refreshDriveFileToLocal(file.id)
      }
      const latest = (await fileRepository.get(file.id)).data
      if (latest?.content && latest.content !== editorContentRef.current) {
        replaceContent(latest.content, 'backed-up')
        editor.commands.setContent(parseContent(latest.content), { emitUpdate: false })
        editorContentRef.current = latest.content
        setLoadedId(file.id)
        setTitle(latest.name)
        setCloudMessage('Updated from Drive. Previous local version was saved.')
      }
    } finally { setIsCheckingDrive(false); setHasCheckedDrive(true) }
  }, [editor, file?.driveFileId, file?.id, file?.lastSyncedAt, replaceContent])
  useEffect(() => {
    void checkDriveChanges()
    const onVisible = () => { if (document.visibilityState === 'visible') void checkDriveChanges() }
    const refreshTimer = window.setInterval(() => { void checkDriveChanges() }, 10_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
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

  const importDocx = async (selectedFile: File) => {
    try {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.convertToHtml({ arrayBuffer: await selectedFile.arrayBuffer() })
      editor.commands.setContent(result.value)
      const importedTitle = selectedFile.name.replace(/\.docx$/i, '')
      setTitle(importedTitle)
      await fileRepository.update(file.id, { name: importedTitle })
      setDocxMessage(result.messages.length ? 'DOCX imported with some formatting simplified.' : 'DOCX imported.')
    } catch (error) {
      devLog('error', 'Could not import DOCX.', error)
      setDocxMessage('DOCX import failed.')
    }
  }

  return (
    <section className="min-h-[calc(100dvh-4rem)] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 -mx-4 -mt-6 border-b border-[var(--app-border)] bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-h-16 items-center gap-2">
          <button type="button" onClick={() => void close()} aria-label="Close document" className="flex size-11 shrink-0 items-center justify-center rounded-[10px]"><ArrowLeftIcon className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <label htmlFor="document-title" className="sr-only">Document title</label>
            <input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} className="h-8 w-full truncate bg-transparent text-base font-semibold outline-none" />
            <EditorStatus status={status} />
            {cloudMessage ? <p className="mt-1 text-xs text-muted">{cloudMessage}</p> : null}
            {file.driveFileId ? <p className="mt-1 text-xs text-muted">{driveExists === false ? 'Drive file not found' : 'Drive file exists'}{file.lastSyncedAt ? ` · Last backup ${new Date(file.lastSyncedAt).toLocaleString()}` : ''}{file.syncError ? ` · ${file.syncError}` : ''}</p> : null}
          </div>
          <Dropdown><Dropdown.Trigger aria-label="More document actions" className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label="Document actions" onAction={(key) => {
            if (key === 'save') void saveAll()
            else if (key === 'backup') void backupNow()
            else if (key === 'copy-link') void copyDriveLink()
            else if (key === 'download-local') void exportDocx(true)
            else if (key === 'export-docx') void exportDocx(false)
            else if (key === 'download-docx') void exportDocx(true)
            else if (key === 'open-drive' && file.driveFileId) void openDriveFileInBrowser(file.driveFileId)
            else if (key === 'import-docx') importInputRef.current?.click()
            else void close()
          }}><Dropdown.Item id="save">Save now</Dropdown.Item><Dropdown.Item id="backup">Back up now</Dropdown.Item><Dropdown.Item id="open-drive" isDisabled={!file.driveFileId || driveExists === false}>Open in Drive</Dropdown.Item><Dropdown.Item id="copy-link" isDisabled={!file.driveFileId || driveExists === false}>Copy Drive link</Dropdown.Item><Dropdown.Item id="download-local">Download local copy</Dropdown.Item><Dropdown.Item id="export-docx">Export as DOCX</Dropdown.Item><Dropdown.Item id="import-docx">Import DOCX</Dropdown.Item><Dropdown.Item id="close">Close document</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void saveAll()}>Save</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void backupNow()}>Back up now</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" isDisabled={!file.driveFileId || driveExists === false} onPress={() => file.driveFileId ? openDriveFileInBrowser(file.driveFileId) : undefined}>Open in Drive</AppButton>
          <AppButton className="hidden sm:flex" variant="secondary" isDisabled={isCheckingDrive || !file.driveFileId} onPress={() => void checkDriveChanges()}>Refresh</AppButton>
        </div>
      </header>
      <input ref={importInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Import DOCX file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void importDocx(selectedFile); event.target.value = '' }} />
      {docxMessage ? <p role="status" className="mx-auto mt-3 max-w-3xl px-1 text-sm text-muted sm:px-6">{docxMessage}<span className="sr-only">{docxBlob ? ` Export size ${docxBlob.size} bytes.` : ''}</span></p> : null}
      <div className="mx-auto w-full max-w-3xl px-1 py-8 sm:px-6"><EditorContent editor={editor} /></div>
      <DocumentToolbar editor={editor} />
    </section>
  )
}
