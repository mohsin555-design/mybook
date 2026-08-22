import { ArrowLeftIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import type { FileType } from '../../types/files'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { EditorStatus } from './EditorStatus'

export function EditorWorkspace({ fileId, type }: { fileId: string; type: FileType }) {
  const navigate = useNavigate()
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
  const { content, save, setContent, status } = useAutosave(file)
  const Icon = type === 'document' ? DocumentTextIcon : TableCellsIcon

  if (file === undefined) return <div className="p-4 text-base text-muted-foreground" role="status">Loading editor…</div>
  if (!file || file.isDeleted) return <EmptyState title="File not found" description="This file may have been moved to Trash or deleted." />

  const closeEditor = async () => {
    await save()
    navigate(file.folderId ? `/folders/${file.folderId}` : '/home')
  }

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] flex-col" aria-labelledby="editor-title">
      <header className="sticky top-0 z-10 -mx-4 -mt-6 flex min-h-16 items-center gap-2 border-b border-[var(--app-border)] bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <button type="button" onClick={() => void closeEditor()} aria-label="Close editor" className="flex size-11 shrink-0 items-center justify-center rounded-[10px]"><ArrowLeftIcon aria-hidden="true" className="size-5" /></button>
        <Icon aria-hidden="true" className="hidden size-5 text-primary sm:block" />
        <h1 id="editor-title" className="min-w-0 flex-1 truncate text-base font-semibold">{file.name}</h1>
        <EditorStatus status={status} />
        <AppButton variant="secondary" onPress={() => void save()}>Save</AppButton>
      </header>
      <label htmlFor="editor-content" className="sr-only">{type === 'document' ? 'Document content' : 'Spreadsheet data'}</label>
      <textarea
        id="editor-content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={type === 'document'}
        placeholder={type === 'document' ? 'Start writing…' : 'Enter spreadsheet data…'}
        className={`min-h-[70vh] w-full flex-1 resize-none bg-transparent px-0 py-6 text-base leading-8 outline-none ${type === 'spreadsheet' ? 'font-mono' : ''}`}
      />
    </section>
  )
}
