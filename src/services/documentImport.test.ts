// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { convertRtfToHtml, documentImportTitle, isSupportedDocumentImport, normalizeInlineFormatting, plainTextToHtml } from './documentImport'

describe('document import helpers', () => {
  it.each(['notes.md', 'notes.markdown', 'notes.txt', 'notes.docx', 'notes.html', 'notes.htm', 'notes.rtf', 'notes.mybook.md'])(
    'accepts %s',
    (name) => expect(isSupportedDocumentImport({ name })).toBe(true),
  )

  it('rejects unsupported formats', () => {
    expect(isSupportedDocumentImport({ name: 'report.pdf' })).toBe(false)
    expect(isSupportedDocumentImport({ name: 'sheet.xlsx' })).toBe(false)
  })

  it('removes the complete recognized extension from the new document title', () => {
    expect(documentImportTitle('Project Notes.mybook.md')).toBe('Project Notes')
    expect(documentImportTitle('Project Notes.markdown')).toBe('Project Notes')
  })

  it('converts plain text paragraphs and line breaks into escaped HTML', () => {
    expect(plainTextToHtml('First <line>\ncontinued\n\nSecond & final')).toBe(
      '<p>First &lt;line&gt;<br>continued</p><p>Second &amp; final</p>',
    )
  })

  it('keeps inline rich text marks when source HTML uses inline styles', () => {
    expect(normalizeInlineFormatting('<p><span style="font-weight: 700; font-style: italic; text-decoration: underline">Keep this</span></p>'))
      .toContain('<strong><em><u>Keep this</u></em></strong>')
  })

  it('converts RTF content to HTML in the browser', async () => {
    const rtf = String.raw`{\rtf1\ansi\deff0 {\fonttbl {\f0 Calibri;}}\f0\fs24 Hello \b bold\b0 world.\par}`
    const bytes = new TextEncoder().encode(rtf)
    const html = await convertRtfToHtml(bytes.buffer)

    expect(html).toContain('Hello')
    expect(html).toContain('bold')
    expect(normalizeInlineFormatting(html)).toMatch(/<strong>bold<\/strong>/)
  })
})
