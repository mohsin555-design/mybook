import type { JSONContent } from '@tiptap/core'
import { myBookMarkdownToDocument } from '../../utils/mybookMarkdown'

/**
 * Parses raw OCR text and layout lines into structured markdown,
 * detecting headings, lists, checklists, tables, code blocks, and paragraphs.
 */
export function ocrTextToStructuredMarkdown(rawText: string): string {
  if (!rawText.trim()) return ''

  const lines = rawText.split(/\r?\n/)
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? ''
    const line = rawLine.trim()

    if (!line) {
      processedLines.push('')
      continue
    }

    // Detect checklists
    const todoMatch = line.match(/^(\[\s*[xX]?\s*\]|TODO:?|DONE:?)\s*(.*)/i)
    if (todoMatch && todoMatch[1]) {
      const isChecked = /\[[xX]\]|DONE/i.test(todoMatch[1])
      processedLines.push(`- [${isChecked ? 'x' : ' '}] ${todoMatch[2] || 'Task item'}`)
      continue
    }

    // Detect bullet points
    const bulletMatch = line.match(/^([•\-*o\u2022\u25E6\u25AA])\s+(.*)/)
    if (bulletMatch && bulletMatch[2]) {
      processedLines.push(`- ${bulletMatch[2]}`)
      continue
    }

    // Detect numbered lists
    const numMatch = line.match(/^(\d+)[.)]\s+(.*)/)
    if (numMatch && numMatch[1] && numMatch[2]) {
      processedLines.push(`${numMatch[1]}. ${numMatch[2]}`)
      continue
    }

    // Detect markdown headings or uppercase title lines
    if (/^#{1,6}\s+/.test(line)) {
      processedLines.push(line)
      continue
    }

    // Short standalone lines in uppercase or Title Case without ending punctuation -> Heading 2
    if (line.length < 50 && !/[.,;:!?]$/.test(line) && (line === line.toUpperCase() && /[A-Z]/.test(line))) {
      processedLines.push(`## ${line}`)
      continue
    }

    // Detect table rows
    if (line.includes('|') && line.split('|').length >= 3) {
      processedLines.push(line)
      // Check if next line is table separator or if we need to insert one
      const nextLine = lines[i + 1]?.trim() ?? ''
      if (!nextLine.includes('---') && !nextLine.includes('|--')) {
        const colCount = line.split('|').filter(Boolean).length
        const sep = `| ${new Array(colCount).fill('---').join(' | ')} |`
        processedLines.push(sep)
      }
      continue
    }

    // Detect code fence
    if (line.startsWith('```')) {
      processedLines.push(line)
      continue
    }

    // Normal paragraph line
    processedLines.push(line)
  }

  return processedLines.join('\n')
}

/**
 * Converts raw OCR text into Writin Tiptap block JSONContent objects.
 */
export function convertOcrTextToBlocks(rawText: string): JSONContent[] {
  const structuredMarkdown = ocrTextToStructuredMarkdown(rawText)
  if (!structuredMarkdown.trim()) {
    return [{ type: 'paragraph' }]
  }

  const doc = myBookMarkdownToDocument(structuredMarkdown)
  return doc.content && doc.content.length > 0 ? doc.content : [{ type: 'paragraph', content: [{ type: 'text', text: rawText }] }]
}
