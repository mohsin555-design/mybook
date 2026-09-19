export interface ParsedFileInfo {
  src: string
  name: string
  extension?: string
}

/**
 * Derives a human-readable file name and extension from a file URL or path.
 */
export function parseFileUrl(candidate: string): ParsedFileInfo | null {
  const trimmed = (candidate || '').trim()
  if (!trimmed) return null

  try {
    let fileName = ''
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return {
        src: trimmed,
        name: 'Attachment',
      }
    }

    const urlObj = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const pathname = urlObj.pathname
    const lastSlash = pathname.lastIndexOf('/')
    const candidateName = lastSlash >= 0 ? pathname.substring(lastSlash + 1) : pathname
    if (candidateName) {
      fileName = decodeURIComponent(candidateName)
    } else {
      fileName = urlObj.hostname
    }

    return {
      src: urlObj.href,
      name: fileName || 'File',
    }
  } catch {
    return {
      src: trimmed,
      name: 'File',
    }
  }
}

/**
 * Downloads a file locally from blob/data URL or external URL.
 */
export async function downloadFile(src: string, fileName = 'attachment'): Promise<void> {
  if (!src) return

  const cleanFileName = fileName.trim() || 'attachment'

  try {
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      const anchor = document.createElement('a')
      anchor.href = src
      anchor.download = cleanFileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    }

    const response = await fetch(src, { mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = cleanFileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    // Fallback: open URL in new window/tab
    window.open(src, '_blank', 'noopener,noreferrer')
  }
}
