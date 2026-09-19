import { isExternalUrl, resolveInternalDocumentId } from './imageClipboard'

export { isExternalUrl, resolveInternalDocumentId }

export interface ParsedAudioInfo {
  provider: 'html5' | 'embed'
  embedUrl: string
  originalUrl: string
  title?: string
}

/**
 * Parses an audio URL into either a direct HTML5 audio or an embed URL.
 */
export function parseAudioUrl(candidate: string): ParsedAudioInfo | null {
  try {
    const trimmed = candidate.trim()
    if (!trimmed) return null

    // Direct HTML5 audio / data / blob / audio file extensions
    if (
      trimmed.startsWith('data:audio/') ||
      trimmed.startsWith('blob:') ||
      /\.(mp3|wav|ogg|m4a|aac|flac|weba|opus)(?:[?#]|$)/i.test(trimmed)
    ) {
      let title = ''
      try {
        const urlObj = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
        const pathname = urlObj.pathname
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
        if (filename) title = decodeURIComponent(filename.replace(/\.[^.]+$/u, ''))
      } catch {
        // ignore
      }

      return {
        provider: 'html5',
        embedUrl: trimmed,
        originalUrl: trimmed,
        title: title || undefined,
      }
    }

    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)

    // Default: treat valid web URL as direct HTML5 audio source
    let title = ''
    const pathname = parsed.pathname
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
    if (filename) title = decodeURIComponent(filename.replace(/\.[^.]+$/u, ''))

    return {
      provider: 'html5',
      embedUrl: parsed.href,
      originalUrl: trimmed,
      title: title || undefined,
    }
  } catch {
    return null
  }
}

/**
 * Downloads an audio file/blob with a sanitized file name.
 */
export async function downloadAudio(src: string, title = ''): Promise<void> {
  if (!src) return

  let ext = '.mp3'
  if (src.startsWith('data:audio/wav')) ext = '.wav'
  else if (src.startsWith('data:audio/ogg') || src.startsWith('data:audio/opus')) ext = '.ogg'
  else if (src.startsWith('data:audio/aac')) ext = '.aac'
  else if (src.startsWith('data:audio/flac')) ext = '.flac'
  else if (src.startsWith('data:audio/m4a') || src.startsWith('data:audio/mp4')) ext = '.m4a'
  else if (src.startsWith('data:audio/webm')) ext = '.weba'
  else {
    try {
      const pathname = new URL(src, window.location.href).pathname
      const match = pathname.match(/\.(mp3|wav|ogg|m4a|aac|flac|weba|opus)$/i)
      if (match?.[1]) ext = `.${match[1].toLowerCase()}`
    } catch {
      // ignore
    }
  }

  const baseName = (title?.trim() || 'audio-track').replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`

  try {
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      const anchor = document.createElement('a')
      anchor.href = src
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    }

    const response = await fetch(src, { mode: 'cors' })
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
  } catch {
    const anchor = document.createElement('a')
    anchor.href = src
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }
}
