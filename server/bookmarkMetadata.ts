import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { parse } from 'parse5'

export function isPublicIPv4(address: string) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2))
    || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0))
}

export function publicUrl(raw: string, base?: string) {
  const url = new URL(raw, base)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Unsupported URL')
  return url
}

export function extractMetadata(html: string, pageUrl: string) {
  const values = new Map<string, string>()
  let title = ''
  type HtmlNode = { nodeName: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: HtmlNode[] }
  const text = (node: HtmlNode): string => node.value ?? node.childNodes?.map(text).join('') ?? ''
  const visit = (node: HtmlNode) => {
    const attrs = Object.fromEntries(node.attrs?.map(({ name, value }) => [name, value]) ?? [])
    if (node.nodeName === 'meta') {
      const key = (attrs.property || attrs.name || '').toLowerCase()
      if (attrs.content && !values.has(key)) values.set(key, attrs.content.trim())
    }
    if (node.nodeName === 'title' && !title) title = text(node).trim()
    node.childNodes?.forEach(visit)
  }
  visit(parse(html))
  let image = ''
  const rawImage = values.get('og:image') || values.get('twitter:image') || values.get('twitter:image:src')
  if (rawImage) {
    try { image = publicUrl(rawImage, pageUrl).href } catch { /* No usable preview. */ }
  }
  return {
    ...(values.get('og:site_name') ? { siteName: values.get('og:site_name')!.slice(0, 200) } : {}),
    title: (values.get('og:title') || values.get('twitter:title') || title || new URL(pageUrl).hostname).slice(0, 500),
    description: (values.get('og:description') || values.get('twitter:description') || values.get('description') || '').slice(0, 2000),
    image,
  }
}

async function fetchPage(raw: string, signal: AbortSignal, redirects = 0): Promise<{ html: string; url: string }> {
  const url = publicUrl(raw)
  const addresses = await lookup(url.hostname, { all: true, family: 4 })
  if (!addresses.length || addresses.some(({ address }) => !isPublicIPv4(address))) throw new Error('Unsupported host')
  // Pin the validated address so DNS cannot change between validation and connection.
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal,
      family: 4,
      lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
      headers: { Accept: 'text/html', 'User-Agent': 'MyBook-LinkPreview/1.0' },
    }, (response) => {
      const status = response.statusCode ?? 500
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        if (redirects >= 3) { reject(new Error('Too many redirects')); return }
        try { resolve(fetchPage(publicUrl(response.headers.location, url.href).href, signal, redirects + 1)) } catch (error) { reject(error) }
        return
      }
      if (status !== 200 || !response.headers['content-type']?.includes('text/html')) {
        response.resume()
        reject(new Error('Page unavailable'))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 2 * 1024 * 1024) { request.destroy(new Error('Page too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: url.href }))
    })
    request.on('error', reject)
  })
}

export default async function bookmarkMetadata(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return }
  try {
    const raw = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
    if (!raw || raw.length > 4096) throw new Error('Invalid URL')
    const page = await fetchPage(raw, AbortSignal.timeout(8000))
    res.end(JSON.stringify(extractMetadata(page.html, page.url)))
  } catch {
    res.statusCode = 422
    res.end(JSON.stringify({ error: 'Preview unavailable' }))
  }
}
