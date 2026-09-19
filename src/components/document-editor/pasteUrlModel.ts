export type PasteUrlKind = 'normal' | 'embed' | 'writin-document'

export interface PasteUrlInfo {
  url: string
  kind: PasteUrlKind
  domain: string
  title: string
  embedUrl?: string
  embedProvider?: string
  youtubeId?: string
  documentId?: string
  isImage?: boolean
}

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])
const figmaHosts = new Set(['figma.com', 'www.figma.com'])
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'tiff'])

export function isImageUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('data:image/')) return true
  try {
    const url = new URL(trimmed)
    const pathname = url.pathname.toLowerCase()
    const ext = pathname.split('.').pop()
    if (ext && imageExtensions.has(ext)) return true
    if (
      url.hostname.includes('images.unsplash.com') ||
      url.hostname.includes('imgur.com') ||
      url.hostname.includes('i.postimg.cc') ||
      url.hostname.includes('cdn.pixabay.com') ||
      url.hostname.includes('images.pexels.com')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function analyzePastedUrl(rawUrl: string, origin = globalThis.location?.origin ?? 'http://localhost'): PasteUrlInfo | null {
  const trimmed = rawUrl.trim()
  if (!trimmed || /\s/u.test(trimmed)) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null

  const documentId = documentIdFromUrl(parsed, origin)
  const embed = supportedEmbedFromUrl(parsed)
  const domain = parsed.hostname.replace(/^www\./u, '')
  const isImage = isImageUrl(parsed.href)
  return {
    url: parsed.href,
    kind: documentId ? 'writin-document' : embed ? 'embed' : 'normal',
    domain,
    title: titleFromUrl(parsed, domain),
    embedUrl: embed?.embedUrl,
    embedProvider: embed?.provider,
    youtubeId: embed?.provider === 'youtube' ? embed.id : undefined,
    documentId,
    isImage,
  }
}

export function isSingleUrlPaste(text: string) {
  const trimmed = text.trim()
  return Boolean(trimmed) && !/\s/u.test(trimmed) && analyzePastedUrl(trimmed) !== null
}

function documentIdFromUrl(url: URL, origin: string) {
  if (url.origin !== origin) return undefined
  const match = url.pathname.match(/^\/document\/([^/?#]+)/u)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

function youtubeIdFromUrl(url: URL) {
  if (!youtubeHosts.has(url.hostname)) return undefined
  if (url.hostname === 'youtu.be') return cleanYoutubeId(url.pathname.slice(1))
  if (url.pathname === '/watch') return cleanYoutubeId(url.searchParams.get('v') ?? '')
  const embedMatch = url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/u)
  return embedMatch?.[1] ? cleanYoutubeId(embedMatch[1]) : undefined
}

function supportedEmbedFromUrl(url: URL) {
  const youtubeId = youtubeIdFromUrl(url)
  if (youtubeId) return { provider: 'youtube', id: youtubeId, embedUrl: `https://www.youtube.com/embed/${youtubeId}` }

  if (figmaHosts.has(url.hostname) && /^\/(?:file|design|proto|board)\//u.test(url.pathname)) {
    return { provider: 'figma', embedUrl: `https://www.figma.com/embed?embed_host=writin&url=${encodeURIComponent(url.href)}` }
  }

  if (url.hostname === 'drive.google.com') {
    const fileId = url.pathname.match(/^\/file\/d\/([^/]+)/u)?.[1]
      ?? url.searchParams.get('id')
    if (fileId) return { provider: 'google-drive', embedUrl: `https://drive.google.com/file/d/${fileId}/preview` }
  }

  return { provider: 'web', embedUrl: url.href }
}

function cleanYoutubeId(value: string) {
  const id = value.trim()
  return /^[\w-]{6,32}$/u.test(id) ? id : undefined
}

function titleFromUrl(url: URL, domain: string) {
  const segments = url.pathname.split('/').filter(Boolean)
  const lastSegment = segments.at(-1)
  if (!lastSegment) return domain
  return decodeURIComponent(lastSegment)
    .replace(/[-_]+/gu, ' ')
    .replace(/\.[a-z0-9]{2,5}$/iu, '')
    .trim() || domain
}
