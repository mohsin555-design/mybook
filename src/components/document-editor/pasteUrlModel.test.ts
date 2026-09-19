import { describe, expect, it } from 'vitest'

import { analyzePastedUrl, isSingleUrlPaste } from './pasteUrlModel'

describe('pasteUrlModel', () => {
  it('recognizes normal website URLs as link, bookmark, and embed candidates', () => {
    expect(analyzePastedUrl('https://example.com/articles/good-link')?.kind).toBe('embed')
    expect(analyzePastedUrl('https://example.com/articles/good-link')?.title).toBe('good link')
  })

  it('recognizes supported YouTube URLs as embeddable', () => {
    expect(analyzePastedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.youtubeId).toBe('dQw4w9WgXcQ')
    expect(analyzePastedUrl('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('embed')
    expect(analyzePastedUrl('https://youtu.be/dQw4w9WgXcQ')?.embedProvider).toBe('youtube')
  })

  it('recognizes provider and generic webpage embed URLs', () => {
    expect(analyzePastedUrl('https://www.figma.com/file/abc123/Design')?.embedProvider).toBe('figma')
    expect(analyzePastedUrl('https://www.figma.com/board/abc123/Whiteboard')?.embedProvider).toBe('figma')
    expect(analyzePastedUrl('https://drive.google.com/open?id=file_123')?.embedProvider).toBe('google-drive')
    expect(analyzePastedUrl('https://mohsinali.in/resources.html')?.embedProvider).toBe('web')
    expect(analyzePastedUrl('https://drive.google.com/drive/u/1/home')?.embedProvider).toBe('web')
    expect(analyzePastedUrl('https://www.figma.com/login')?.embedProvider).toBe('web')
  })

  it('recognizes current-origin Writin document URLs without treating external URLs as pages', () => {
    expect(analyzePastedUrl('https://writin.test/document/doc_123', 'https://writin.test')?.documentId).toBe('doc_123')
    expect(analyzePastedUrl('https://example.com/document/doc_123', 'https://writin.test')?.kind).toBe('embed')
  })

  it('recognizes image URLs as image paste candidates', () => {
    expect(analyzePastedUrl('https://example.com/photo.png')?.isImage).toBe(true)
    expect(analyzePastedUrl('https://images.unsplash.com/photo-123456')?.isImage).toBe(true)
    expect(analyzePastedUrl('https://example.com/article')?.isImage).toBe(false)
  })

  it('keeps the paste menu limited to single URL paste content', () => {
    expect(isSingleUrlPaste('https://example.com')).toBe(true)
    expect(isSingleUrlPaste('See https://example.com')).toBe(false)
  })
})
