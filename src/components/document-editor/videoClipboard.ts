import { isExternalUrl, resolveInternalDocumentId } from './imageClipboard'

export { isExternalUrl, resolveInternalDocumentId }

export interface ParsedVideoInfo {
  provider: 'html5' | 'youtube' | 'vimeo' | 'embed'
  embedUrl: string
  originalUrl: string
  title?: string
}

/**
 * Parses a video URL into either a direct HTML5 video or an embed URL (YouTube, Vimeo, etc.).
 */
export function parseVideoUrl(candidate: string): ParsedVideoInfo | null {
  try {
    const trimmed = candidate.trim()
    if (!trimmed) return null

    // Check direct HTML5 video / data / blob
    if (
      trimmed.startsWith('data:video/') ||
      trimmed.startsWith('blob:') ||
      /\.(mp4|webm|ogg|mov|m4v|mkv)(?:[?#]|$)/i.test(trimmed)
    ) {
      return {
        provider: 'html5',
        embedUrl: trimmed,
        originalUrl: trimmed,
      }
    }

    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)

    // YouTube
    const ytMatch = parsed.hostname.match(/(?:^|\.)(?:youtube\.com|youtu\.be)$/i)
    if (ytMatch) {
      let videoId = ''
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] || ''
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.slice('/embed/'.length).split('/')[0] || ''
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.slice('/shorts/'.length).split('/')[0] || ''
      } else {
        videoId = parsed.searchParams.get('v') || ''
      }

      if (videoId) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
          originalUrl: trimmed,
          title: 'YouTube video',
        }
      }
    }

    // Vimeo
    const vimeoMatch = parsed.hostname.match(/(?:^|\.)vimeo\.com$/i)
    if (vimeoMatch) {
      const match = parsed.pathname.match(/\/(\d+)(?:$|[/?#])/u)
      if (match?.[1]) {
        return {
          provider: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${match[1]}`,
          originalUrl: trimmed,
          title: 'Vimeo video',
        }
      }
    }

    // Default: treat valid web URL as direct or embed
    return {
      provider: 'html5',
      embedUrl: parsed.href,
      originalUrl: trimmed,
    }
  } catch {
    return null
  }
}

/**
 * Downloads a video file/blob with a sanitized file name.
 */
export async function downloadVideo(src: string, alt = ''): Promise<void> {
  if (!src) return

  let ext = '.mp4'
  if (src.startsWith('data:video/webm')) ext = '.webm'
  else if (src.startsWith('data:video/ogg')) ext = '.ogg'
  else if (src.startsWith('data:video/quicktime')) ext = '.mov'
  else {
    try {
      const pathname = new URL(src, window.location.href).pathname
      const match = pathname.match(/\.(mp4|webm|ogg|mov|m4v|mkv)$/i)
      if (match?.[1]) ext = `.${match[1].toLowerCase()}`
    } catch {
      // ignore
    }
  }

  const baseName = (alt?.trim() || 'video').replace(/[^a-zA-Z0-9_-]/g, '_')
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
