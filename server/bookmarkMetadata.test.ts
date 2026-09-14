import { describe, expect, it } from 'vitest'
import { extractMetadata, isPublicIPv4, publicUrl } from './bookmarkMetadata'

describe('bookmark metadata', () => {
  it('prefers page previews and decodes HTML entities without replacing the original URL', () => {
    expect(extractMetadata('<title>Fallback</title><meta content="Page &amp; title" property="og:title"><meta name="description" content="Summary"><meta property="og:image" content="/preview.png">', 'https://example.com/page?search=delete')).toEqual({ title: 'Page & title', description: 'Summary', image: 'https://example.com/preview.png' })
  })
  it('falls back to HTML title and handles missing or unsafe images', () => {
    expect(extractMetadata('<title>Real title</title><meta property="og:image" content="javascript:alert(1)">', 'https://example.com')).toEqual({ title: 'Real title', description: '', image: '' })
  })
  it('supports Twitter metadata', () => {
    expect(extractMetadata('<meta name="twitter:title" content="Tweet title"><meta name="twitter:image" content="https://example.com/card.png">', 'https://example.com').image).toBe('https://example.com/card.png')
  })
  it('rejects local networks and non-web targets', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '::1']) expect(isPublicIPv4(ip)).toBe(false)
    expect(isPublicIPv4('93.184.216.34')).toBe(true)
    expect(() => publicUrl('file:///etc/passwd')).toThrow()
    expect(() => publicUrl('https://user:password@example.com')).toThrow()
    expect(() => publicUrl('https://example.com:8080')).toThrow()
  })
})
