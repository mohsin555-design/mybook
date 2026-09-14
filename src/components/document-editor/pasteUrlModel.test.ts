import { describe, expect, it } from 'vitest'

import { analyzePastedUrl, isSingleUrlPaste } from './pasteUrlModel'

describe('pasteUrlModel', () => {
  it('recognizes normal website URLs as link and bookmark candidates', () => {
    expect(analyzePastedUrl('https://example.com/articles/good-link')?.kind).toBe('normal')
    expect(analyzePastedUrl('https://example.com/articles/good-link')?.title).toBe('good link')
  })

  it('recognizes supported YouTube URLs as embeddable', () => {
    expect(analyzePastedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.youtubeId).toBe('dQw4w9WgXcQ')
    expect(analyzePastedUrl('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('youtube')
  })

  it('recognizes current-origin Writin document URLs without treating external URLs as pages', () => {
    expect(analyzePastedUrl('https://writin.test/document/doc_123', 'https://writin.test')?.documentId).toBe('doc_123')
    expect(analyzePastedUrl('https://example.com/document/doc_123', 'https://writin.test')?.kind).toBe('normal')
  })

  it('keeps the paste menu limited to single URL paste content', () => {
    expect(isSingleUrlPaste('https://example.com')).toBe(true)
    expect(isSingleUrlPaste('See https://example.com')).toBe(false)
  })
})
