import { ArrowLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '@heroui/react'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { DocumentToolbar } from './DocumentToolbar'
import { EditorStatus } from './EditorStatus'

const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] }

function parseContent(content: string) {
  if (!content) return emptyDocument
  try { return JSON.parse(content) as object } catch { return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } }
}

export function TiptapDocumentEditor({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
  const { content, isHydrated, save, setContent, status } = useAutosave(file)
  const [title, setTitle] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [docxMessage, setDocxMessage] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: emptyDocument,
    editorProps: { attributes: { class: 'tiptap min-h-[65vh] outline-none' } },
    onUpdate: ({ editor: currentEditor }) => setContent(JSON.stringify(currentEditor.getJSON())),
  })

  useEffect(() => { if (file) setTitle(file.name) }, [file])
  useEffect(() => {
    if (!editor || !file || !isHydrated || loadedId === file.id) return
    editor.commands.setContent(parseContent(content), { emitUpdate: false })
    setLoadedId(file.id)
  }, [content, editor, file, isHydrated, loadedId])

  if (file === undefined || !editor) return <div role="status" className="p-4 text-muted">Loading editor…</div>
  if (!file || file.isDeleted) return <EmptyState title="Document not found" description="This document may have been moved to Trash or deleted." />

  const saveTitle = async () => { if (title !== file.name) await fileRepository.update(file.id, { name: title }) }
  const saveAll = async () => { await Promise.all([save(), saveTitle()]) }
  const close = async () => { await saveAll(); navigate(file.folderId ? `/folders/${file.folderId}` : '/home') }

  const exportDocx = async (download: boolean) => {
    try {
      const { createDocxBlob, downloadDocx } = await import('../../utils/docx')
      const blob = await createDocxBlob(title, editor.getJSON())
      setDocxBlob(blob)
      setDocxMessage(download ? 'DOCX downloaded.' : 'DOCX ready for backup.')
      if (download) downloadDocx(blob, title)
    } catch (error) {
      console.error('Could not export DOCX.', error)
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
      console.error('Could not import DOCX.', error)
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
          </div>
          <Dropdown><Dropdown.Trigger aria-label="More document actions" className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label="Document actions" onAction={(key) => {
            if (key === 'save') void saveAll()
            else if (key === 'export-docx') void exportDocx(false)
            else if (key === 'download-docx') void exportDocx(true)
            else if (key === 'import-docx') importInputRef.current?.click()
            else void close()
          }}><Dropdown.Item id="save">Save now</Dropdown.Item><Dropdown.Item id="export-docx">Export as DOCX</Dropdown.Item><Dropdown.Item id="download-docx">Download DOCX</Dropdown.Item><Dropdown.Item id="import-docx">Import DOCX</Dropdown.Item><Dropdown.Item id="close">Close document</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
          <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void saveAll()}>Save</AppButton>
        </div>
      </header>
      <input ref={importInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Import DOCX file" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) void importDocx(selectedFile); event.target.value = '' }} />
      {docxMessage ? <p role="status" className="mx-auto mt-3 max-w-3xl px-1 text-sm text-muted sm:px-6">{docxMessage}<span className="sr-only">{docxBlob ? ` Export size ${docxBlob.size} bytes.` : ''}</span></p> : null}
      <div className="mx-auto w-full max-w-3xl px-1 py-8 sm:px-6"><EditorContent editor={editor} /></div>
      <DocumentToolbar editor={editor} />
    </section>
  )
}
