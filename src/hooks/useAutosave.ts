import { useCallback, useEffect, useRef, useState } from 'react'

import { fileRepository } from '../database/repositories'
import { isLocalWorkspace } from '../stores/useWorkspaceStore'
import type { EditorSaveStatus, MyBookFile } from '../types/files'

const SAVE_DELAY = 500

export function useAutosave(file: MyBookFile | undefined) {
  const [content, setContent] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [status, setStatus] = useState<EditorSaveStatus>(
    isLocalWorkspace() ? 'local' : (file?.syncStatus ?? (navigator.onLine ? 'backed-up' : 'offline'))
  )
  const lastSaved = useRef(file?.content ?? '')
  const contentRef = useRef(content)
  const fileRef = useRef(file)
  const hydratedFileIdRef = useRef<string | null>(null)

  useEffect(() => { fileRef.current = file }, [file])
  useEffect(() => {
    if (!file) return
    const isNewFile = hydratedFileIdRef.current !== file.id
    const next = file.content

    if (isNewFile) {
      setIsHydrated(false)
      hydratedFileIdRef.current = file.id
      setContent(next)
      contentRef.current = next
      lastSaved.current = next
      setStatus(isLocalWorkspace() ? 'local' : (file.syncStatus ?? (navigator.onLine ? 'backed-up' : 'offline')))
      setIsHydrated(true)
      return
    }

    if (next === contentRef.current) {
      lastSaved.current = next
      return
    }

    if (contentRef.current === lastSaved.current) {
      if (next || !contentRef.current) {
        setContent(next)
        contentRef.current = next
        lastSaved.current = next
      }
    }
    setIsHydrated(true)
  }, [file])

  const save = useCallback(async () => {
    const currentFile = fileRef.current
    if (!currentFile || contentRef.current === lastSaved.current) return true
    setStatus('saving-locally')
    const result = await fileRepository.update(currentFile.id, { content: contentRef.current, syncStatus: isLocalWorkspace() ? 'local' : 'pending' })
    if (!result.success) { setStatus('failed'); return false }
    lastSaved.current = contentRef.current
    setStatus('saved-locally')
    window.setTimeout(() => setStatus(isLocalWorkspace() ? 'local' : (fileRef.current?.syncStatus ?? (navigator.onLine ? 'pending' : 'offline'))), 700)
    return true
  }, [])

  useEffect(() => {
    if (!file || content === lastSaved.current) return
    const timer = window.setTimeout(() => void save(), SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [content, file, save])

  useEffect(() => {
    const flush = () => { void save() }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    const online = () => setStatus('pending')
    const offline = () => { setStatus('offline'); flush() }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visibility)
    return () => { flush(); window.removeEventListener('pagehide', flush); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visibility) }
  }, [save])

  const changeContent = (value: string) => {
    setContent(value); contentRef.current = value; setStatus('editing')
  }

  const replaceContent = (value: string, nextStatus: EditorSaveStatus = 'saved-locally') => {
    setContent(value)
    contentRef.current = value
    lastSaved.current = value
    setStatus(nextStatus)
  }

  return { content, isHydrated, status, setContent: changeContent, replaceContent, save }
}
