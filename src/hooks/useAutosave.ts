import { useCallback, useEffect, useRef, useState } from 'react'

import { fileRepository } from '../database/repositories'
import type { EditorSaveStatus, MyBookFile } from '../types/files'

const SAVE_DELAY = 500

export function useAutosave(file: MyBookFile | undefined) {
  const recoveryKey = file ? `mybook-recovery:${file.id}` : ''
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<EditorSaveStatus>(navigator.onLine ? 'pending' : 'offline')
  const lastSaved = useRef(file?.content ?? '')
  const contentRef = useRef(content)
  const fileRef = useRef(file)

  useEffect(() => { fileRef.current = file }, [file])
  useEffect(() => {
    if (!file) return
    const draft = localStorage.getItem(`mybook-recovery:${file.id}`)
    let next = file.content
    if (draft) {
      try {
        const recovered = JSON.parse(draft) as { content?: unknown }
        if (typeof recovered.content === 'string') next = recovered.content
      } catch {
        localStorage.removeItem(`mybook-recovery:${file.id}`)
      }
    }
    setContent(next); contentRef.current = next; lastSaved.current = file.content
    if (next !== file.content) setStatus('editing')
  }, [file])

  const save = useCallback(async () => {
    const currentFile = fileRef.current
    if (!currentFile || contentRef.current === lastSaved.current) return true
    setStatus('saving-locally')
    const result = await fileRepository.update(currentFile.id, { content: contentRef.current, syncStatus: 'pending' })
    if (!result.success) { setStatus('failed'); return false }
    lastSaved.current = contentRef.current
    localStorage.removeItem(`mybook-recovery:${currentFile.id}`)
    setStatus('saved-locally')
    window.setTimeout(() => setStatus(navigator.onLine ? 'pending' : 'offline'), 700)
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
    if (file) localStorage.setItem(recoveryKey, JSON.stringify({ content: value, updatedAt: new Date().toISOString() }))
  }

  return { content, status, setContent: changeContent, save }
}
