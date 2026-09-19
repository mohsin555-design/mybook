/**
 * Copies an image to the clipboard as an actual binary image (image/png)
 * along with rich HTML text so pasting in rich text editors (including Tiptap)
 * immediately inserts the image rather than pasting raw text or URL.
 */
export async function copyImageToClipboard(src: string, alt = ''): Promise<boolean> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image for copying'))
      img.src = src
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width || 300
    canvas.height = img.naturalHeight || img.height || 150
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(img, 0, 0)

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })

    if (!pngBlob) throw new Error('Could not create PNG blob')

    const cleanAlt = (alt || 'image').replace(/"/g, '&quot;')
    const htmlBlob = new Blob([`<img src="${src}" alt="${cleanAlt}" />`], {
      type: 'text/html',
    })

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
          'text/html': htmlBlob,
        }),
      ])
      return true
    }
  } catch (error) {
    console.warn('Direct image clipboard copy failed, using fallback:', error)
  }

  // Fallback to text copy if binary clipboard copy is unavailable or blocked
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(src)
      return true
    }
  } catch {
    // ignore
  }

  return false
}

/**
 * Downloads an image file with a sanitized name, fetching cross-origin images
 * as blobs when necessary so the browser initiates a real file download instead
 * of navigating or opening in a new tab.
 */
export async function downloadImage(src: string, alt = ''): Promise<void> {
  if (!src) return

  let ext = ''
  if (src.startsWith('data:image/png')) ext = '.png'
  else if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) ext = '.jpg'
  else if (src.startsWith('data:image/svg')) ext = '.svg'
  else if (src.startsWith('data:image/webp')) ext = '.webp'
  else if (src.startsWith('data:image/gif')) ext = '.gif'
  else {
    try {
      const pathname = new URL(src, window.location.href).pathname
      const match = pathname.match(/\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i)
      if (match?.[1]) ext = `.${match[1].toLowerCase()}`
    } catch {
      // ignore
    }
    if (!ext) ext = '.png'
  }

  const baseName = (alt?.trim() || 'image').replace(/[^a-zA-Z0-9_-]/g, '_')
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

/**
 * Resolves an internal document ID from a link href, internal URL, or file list.
 */
export function resolveInternalDocumentId(
  href: string | null | undefined,
  files?: Array<{ id: string; name: string; isDeleted?: boolean }>
): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('doc:')) return trimmed.slice(4).trim()
  if (trimmed.startsWith('file:')) return trimmed.slice(5).trim()

  // Match /document/:id or /spreadsheet/:id with or without domain/hash
  const match = trimmed.match(/(?:^|[/#])(?:document|spreadsheet)\/([^/?#]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1])

  if (files && files.length > 0) {
    const directFile = files.find((f) => !f.isDeleted && f.id === trimmed)
    if (directFile) return directFile.id

    const nameMatch = files.find(
      (f) => !f.isDeleted && f.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (nameMatch) return nameMatch.id
  }

  return null
}

/**
 * Checks if a given link href is an external web URL (and not an internal doc: or relative route or internal app url).
 */
export function isExternalUrl(
  href: string | null | undefined,
  files?: Array<{ id: string; name: string; isDeleted?: boolean }>
): boolean {
  if (!href) return false
  const trimmed = href.trim()
  if (!trimmed) return false

  // If it resolves to an internal document, it is NOT external
  if (resolveInternalDocumentId(trimmed, files)) return false

  // Internal doc/file prefixes, relative routes, hash anchors
  if (
    trimmed.startsWith('doc:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return false
  }

  // Internal routes without leading slash
  if (/^(?:document|spreadsheet|folders|files|home|favorites|search|trash|settings)(?:\/|$|\?|#)/i.test(trimmed)) {
    return false
  }

  try {
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const parsed = new URL(candidate)

    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:' || parsed.protocol === 'sms:') {
      return true
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'ftp:') {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()
    if (!hostname) return false

    // Localhost or loopback IPs are internal
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      return false
    }

    // Check if hostname matches current window location
    if (typeof window !== 'undefined' && window.location) {
      const windowHost = window.location.host.toLowerCase()
      const windowHostname = window.location.hostname.toLowerCase()
      const windowOrigin = window.location.origin.toLowerCase()

      if (
        parsed.origin.toLowerCase() === windowOrigin ||
        parsed.host.toLowerCase() === windowHost ||
        hostname === windowHostname
      ) {
        return false
      }
    }

    // Must have at least a top-level domain dot (e.g. google.com, example.org)
    if (!hostname.includes('.')) {
      return false
    }

    // Also check if pathname points to internal app routes
    if (
      /^\/(?:document|spreadsheet|folders|files|home|favorites|search|trash|settings)(?:\/|$|\?|#)/i.test(
        parsed.pathname
      )
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}
