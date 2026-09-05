import type { JSONContent } from '@tiptap/core'
import { DATABASE_VERSION, normalizeDatabaseAttrs } from '../components/document-editor/databaseModel'
import { normalizeDocumentLinkAttrs } from '../components/document-editor/documentLinkModel'

const FRONTMATTER_BOUNDARY = '---'

export interface MyBookMarkdownMetadata {
  documentId?: string
}

export interface MyBookMarkdownParseResult {
  document: JSONContent
  metadata: MyBookMarkdownMetadata
}

export function isValidPortableDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{3,128}$/u.test(value.trim())
}

function escapeText(value: string) {
  return value.replace(/([\\*_~`[\]()#!>+-])/g, '\\$1')
}

function codeFence(value: string) {
  const longest = Math.max(2, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length))
  return '`'.repeat(longest + 1)
}

function inlineCodeFence(value: string) {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length))
  return '`'.repeat(longest + 1)
}

function readJsonAttribute(value: unknown) {
  return JSON.stringify(String(value ?? ''))
}

function quoteMarkdownAttribute(value: string) {
  return JSON.stringify(value)
}

function inlineMarkdown(node: JSONContent): string {
  if (node.type === 'text') {
    const codeMark = node.marks?.find((mark) => mark.type === 'code')
    if (codeMark) {
      const value = node.text ?? ''
      const fence = inlineCodeFence(value)
      const padding = /^`|`$|^\s|\s$/u.test(value) ? ' ' : ''
      return `${fence}${padding}${value}${padding}${fence}`
    }
    let text = escapeText(node.text ?? '')
    const marks = [...(node.marks ?? [])].sort((a, b) => {
      const order = ['underline', 'strike', 'italic', 'bold', 'link']
      return order.indexOf(a.type) - order.indexOf(b.type)
    })
    for (const mark of marks) {
      if (mark.type === 'underline') text = `<u>${text}</u>`
      if (mark.type === 'bold') text = `**${text}**`
      if (mark.type === 'italic') text = `_${text}_`
      if (mark.type === 'strike') text = `~~${text}~~`
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') text = `[${text}](${mark.attrs.href})`
    }
    return text
  }
  if (node.type === 'hardBreak') return '  \n'
  return (node.content ?? []).map(inlineMarkdown).join('')
}

function indentMarkdown(markdown: string, depth: number) {
  const indent = '  '.repeat(depth)
  return markdown.split('\n').map((line) => line ? `${indent}${line}` : line).join('\n')
}

function blockMarkdown(node: JSONContent, depth = 0): string {
  const inline = (node.content ?? []).map(inlineMarkdown).join('')
  if (node.type === 'heading') return `${'#'.repeat(Math.min(Number(node.attrs?.level) || 1, 6))} ${inline}`
  if (node.type === 'paragraph') return inline
  if (node.type === 'callout') {
    const kind = typeof node.attrs?.kind === 'string' ? node.attrs.kind : 'info'
    const body = (node.content ?? []).map((child) => blockMarkdown(child, depth)).filter(Boolean).join('\n\n')
    return [`:::callout type="${kind}"`, body, ':::'].filter(Boolean).join('\n')
  }
  if (node.type === 'toggleBlock') {
    const title = typeof node.attrs?.title === 'string' ? node.attrs.title : 'Toggle'
    const open = node.attrs?.open === false ? 'false' : 'true'
    const body = (node.content ?? []).map((child) => blockMarkdown(child, depth)).filter(Boolean).join('\n\n')
    return [`:::toggle title=${quoteMarkdownAttribute(title)} open=${open}`, body, ':::'].filter(Boolean).join('\n')
  }
  if (node.type === 'imageBlock' && typeof node.attrs?.src === 'string') {
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.replace(/\[/g, '\\[').replace(/\]/g, '\\]') : ''
    return `![${alt}](${node.attrs.src})`
  }
  if (node.type === 'fileAttachment' && typeof node.attrs?.src === 'string') {
    return [
      `:::file name=${readJsonAttribute(node.attrs.name)} mime=${readJsonAttribute(node.attrs.mimeType)} size=${Number(node.attrs.size ?? 0)}`,
      node.attrs.src,
      ':::',
    ].join('\n')
  }
  if (node.type === 'blockquote') return (node.content ?? []).map((child) => blockMarkdown(child, depth).split('\n').map((line) => `> ${line}`).join('\n')).join('\n')
  if (node.type === 'codeBlock') {
    const code = (node.content ?? []).map((child) => child.text ?? '').join('')
    const fence = codeFence(code)
    const language = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
    return `${fence}${language}\n${code}\n${fence}`
  }
  if (node.type === 'horizontalRule') return '---'
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return (node.content ?? []).map((item, index) => {
      const marker = node.type === 'orderedList'
        ? `${(Number(node.attrs?.start) || 1) + index}.`
        : node.type === 'taskList'
          ? `- [${item.attrs?.checked ? 'x' : ' '}]`
          : '-'
      const children = item.content ?? []
      const [firstChild, ...restChildren] = children
      const firstText = firstChild ? blockMarkdown(firstChild).replace(/\n/g, `\n${'  '.repeat(depth + 1)}`) : ''
      const nested = restChildren.map((child) => (
        child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList'
          ? blockMarkdown(child, depth + 1)
          : indentMarkdown(blockMarkdown(child), depth + 1)
      )).filter(Boolean)
      return [`${'  '.repeat(depth)}${marker} ${firstText}`, ...nested].join('\n')
    }).join('\n')
  }
  if (node.type === 'table') {
    return tableMarkdown(node)
  }
  if (node.type === 'tableOfContents') return [':::toc', ':::'].join('\n')
  if (node.type === 'documentLink') return documentLinkMarkdown(node)
  if (node.type === 'databaseBlock') return databaseMarkdown(node)
  return (node.content ?? []).map((child) => blockMarkdown(child, depth)).join('\n\n')
}

export function documentToMyBookMarkdown(title: string, json: JSONContent, options: { documentId?: string | null } = {}) {
  const safeTitle = title.trim() || 'Untitled document'
  const body = (json.content ?? []).map((node) => blockMarkdown(node)).filter(Boolean).join('\n\n')
  const documentId = isValidPortableDocumentId(options.documentId) ? options.documentId.trim() : null
  return [
    FRONTMATTER_BOUNDARY,
    'mybook_version: 1',
    'type: document',
    ...(documentId ? [`document_id: ${JSON.stringify(documentId)}`] : []),
    `title: ${JSON.stringify(safeTitle)}`,
    FRONTMATTER_BOUNDARY,
    '',
    body,
  ].join('\n').trimEnd() + '\n'
}

type InlineMark = NonNullable<JSONContent['marks']>[number]
type CustomBlockKind = 'callout' | 'toggle' | 'file' | 'table' | 'database' | 'toc' | 'document-link' | 'unknown'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function findUnescaped(value: string, needle: string, start: number) {
  for (let index = start; index <= value.length - needle.length; index += 1) {
    if (value[index - 1] === '\\') continue
    if (value.slice(index, index + needle.length) === needle) return index
  }
  return -1
}

function findClosingParen(value: string, start: number) {
  let depth = 0
  for (let index = start; index < value.length; index += 1) {
    if (value[index - 1] === '\\') continue
    if (value[index] === '(') depth += 1
    if (value[index] === ')') {
      if (depth === 0) return index
      depth -= 1
    }
  }
  return -1
}

function textNodes(value: string, marks: InlineMark[]) {
  return value ? [{ type: 'text', text: value, ...(marks.length ? { marks } : {}) }] as JSONContent[] : []
}

function withMark(nodes: JSONContent[], mark: InlineMark) {
  return nodes.map((node) => {
    if (node.type !== 'text') return node
    return { ...node, marks: [...(node.marks ?? []), mark] }
  })
}

function parseInline(text: string, marks: InlineMark[] = []): JSONContent[] {
  const nodes: JSONContent[] = []
  let plain = ''
  let index = 0
  const flush = () => {
    nodes.push(...textNodes(plain, marks))
    plain = ''
  }

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      plain += text[index + 1]
      index += 2
      continue
    }

    const code = /^`+/u.exec(text.slice(index))?.[0]
    if (code) {
      const end = text.indexOf(code, index + code.length)
      if (end >= 0) {
        flush()
        const codeText = text.slice(index + code.length, end)
        const unpadded = codeText.startsWith(' ') && codeText.endsWith(' ') && /(^`|`$|^\s|\s$)/u.test(codeText.slice(1, -1))
          ? codeText.slice(1, -1)
          : codeText
        nodes.push(...textNodes(unpadded, [{ type: 'code' }]))
        index = end + code.length
        continue
      }
    }

    if (text.startsWith('<u>', index)) {
      const end = text.indexOf('</u>', index + 3)
      if (end >= 0) {
        flush()
        nodes.push(...withMark(parseInline(text.slice(index + 3, end), marks), { type: 'underline' }))
        index = end + 4
        continue
      }
    }

    if (text.startsWith('**', index)) {
      const end = findUnescaped(text, '**', index + 2)
      if (end >= 0) {
        flush()
        nodes.push(...withMark(parseInline(text.slice(index + 2, end), marks), { type: 'bold' }))
        index = end + 2
        continue
      }
    }

    if (text.startsWith('~~', index)) {
      const end = findUnescaped(text, '~~', index + 2)
      if (end >= 0) {
        flush()
        nodes.push(...withMark(parseInline(text.slice(index + 2, end), marks), { type: 'strike' }))
        index = end + 2
        continue
      }
    }

    if (text[index] === '_') {
      const end = findUnescaped(text, '_', index + 1)
      if (end >= 0) {
        flush()
        nodes.push(...withMark(parseInline(text.slice(index + 1, end), marks), { type: 'italic' }))
        index = end + 1
        continue
      }
    }

    if (text[index] === '[') {
      const closeBracket = findUnescaped(text, ']', index + 1)
      if (closeBracket >= 0 && text[closeBracket + 1] === '(') {
        const closeParen = findClosingParen(text, closeBracket + 2)
        if (closeParen >= 0) {
          flush()
          nodes.push(...withMark(parseInline(text.slice(index + 1, closeBracket), marks), {
            type: 'link',
            attrs: { href: text.slice(closeBracket + 2, closeParen).replace(/\\([()\\])/g, '$1') },
          }))
          index = closeParen + 1
          continue
        }
      }
    }

    plain += text[index]
    index += 1
  }
  flush()
  return nodes
}

function paragraph(value: string | string[]): JSONContent {
  const lines = Array.isArray(value) ? value : [value]
  const content = lines.flatMap((line, index) => {
    const hasHardBreak = / {2,}$/.test(line) && index < lines.length - 1
    const parsed = parseInline(hasHardBreak ? line.replace(/ {2,}$/u, '') : line.trim())
    return hasHardBreak ? [...parsed, { type: 'hardBreak' }] : parsed
  })
  return { type: 'paragraph', ...(content.length ? { content } : {}) }
}

function paragraphContent(content: JSONContent[]): JSONContent {
  return { type: 'paragraph', ...(content.length ? { content } : {}) }
}

function sortJson(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    )
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  return null
}

function tableMarkdown(node: JSONContent) {
  return [':::table', JSON.stringify(sortJson(node), null, 2), ':::'].join('\n')
}

function databaseMarkdown(node: JSONContent) {
  return [':::database', JSON.stringify(sortJson({
    type: 'databaseBlock',
    attrs: normalizeDatabaseAttrs(node.attrs),
  }), null, 2), ':::'].join('\n')
}

function documentLinkMarkdown(node: JSONContent) {
  const attrs = normalizeDocumentLinkAttrs(node.attrs)
  if (!attrs) return ''
  return [':::document-link', JSON.stringify(sortJson(attrs), null, 2), ':::'].join('\n')
}

function rawParagraph(lines: string[]): JSONContent {
  const value = lines.join('\n')
  return { type: 'paragraph', ...(value ? { content: [{ type: 'text', text: value }] } : {}) }
}

function readAttributeValue(value: string | undefined) {
  if (value === undefined) return undefined
  return value.replace(/^['"]|['"]$/g, '')
}

function customBlockKind(line: string): CustomBlockKind | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith(':::')) return null
  if (trimmed === ':::') return null
  const name = /^:::([A-Za-z][\w-]*)(?:\s|$)/u.exec(trimmed)?.[1]
  if (!name) return null
  if (name === 'callout' || name === 'toggle' || name === 'file' || name === 'table' || name === 'database' || name === 'toc' || name === 'document-link') return name
  return 'unknown'
}

function collectCustomBlock(lines: string[], startIndex: number) {
  const blockLines = [lines[startIndex] ?? '']
  let index = startIndex + 1
  while (index < lines.length) {
    const next = lines[index] ?? ''
    blockLines.push(next)
    index += 1
    if (next.trim() === ':::') return { closed: true, index, lines: blockLines }
  }
  return { closed: false, index, lines: blockLines }
}

function parseToggleOpen(value: string | undefined) {
  if (value === undefined) return true
  if (/^true$/iu.test(value)) return true
  if (/^false$/iu.test(value)) return false
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function sanitizeAttrs(value: unknown) {
  return isRecord(value) ? value : undefined
}

function sanitizeTableCell(value: unknown): JSONContent | null {
  if (!isRecord(value) || (value.type !== 'tableCell' && value.type !== 'tableHeader')) return null
  const content = Array.isArray(value.content) && value.content.length ? value.content as JSONContent[] : [paragraph('')]
  return {
    type: value.type,
    ...(sanitizeAttrs(value.attrs) ? { attrs: sanitizeAttrs(value.attrs) } : {}),
    content,
  }
}

function sanitizeTableRow(value: unknown): JSONContent | null {
  if (!isRecord(value) || value.type !== 'tableRow') return null
  const cells = Array.isArray(value.content) ? value.content.map(sanitizeTableCell) : []
  if (cells.some((cell) => !cell)) return null
  return { type: 'tableRow', content: cells as JSONContent[] }
}

function parseStructuredTable(lines: string[]): JSONContent | null {
  try {
    const parsed: unknown = JSON.parse(lines.join('\n'))
    if (!isRecord(parsed) || parsed.type !== 'table') return null
    const rows = Array.isArray(parsed.content) ? parsed.content.map(sanitizeTableRow) : []
    if (!rows.length || rows.some((row) => !row)) return null
    return { type: 'table', content: rows as JSONContent[] }
  } catch {
    return null
  }
}

function parseStructuredDatabase(lines: string[]): JSONContent | null {
  try {
    const parsed: unknown = JSON.parse(lines.join('\n'))
    if (!isRecord(parsed) || parsed.type !== 'databaseBlock' || !isRecord(parsed.attrs)) return null
    if (parsed.attrs.version !== DATABASE_VERSION) return null
    if (typeof parsed.attrs.id !== 'string' || !parsed.attrs.id) return null
    if (typeof parsed.attrs.title !== 'string') return null
    if (!Array.isArray(parsed.attrs.columns) || !Array.isArray(parsed.attrs.rows)) return null
    return { type: 'databaseBlock', attrs: normalizeDatabaseAttrs(parsed.attrs) }
  } catch {
    return null
  }
}

function parseStructuredDocumentLink(lines: string[]): JSONContent | null {
  try {
    const parsed: unknown = JSON.parse(lines.join('\n'))
    const attrs = normalizeDocumentLinkAttrs(parsed)
    return attrs ? { type: 'documentLink', attrs } : null
  } catch {
    return null
  }
}

function isEscaped(value: string, index: number) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}

function trimOuterPipes(value: string) {
  let trimmed = value.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|') && !isEscaped(trimmed, trimmed.length - 1)) trimmed = trimmed.slice(0, -1)
  return trimmed
}

function splitPipeRow(value: string) {
  const cells: string[] = []
  let cell = ''
  let codeFenceLength = 0
  const row = trimOuterPipes(value)

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    if (char === '\\' && index + 1 < row.length) {
      cell += row[index + 1]
      index += 1
      continue
    }
    if (char === '`') {
      const match = /^`+/u.exec(row.slice(index))?.[0] ?? '`'
      if (!codeFenceLength) codeFenceLength = match.length
      else if (match.length === codeFenceLength) codeFenceLength = 0
      cell += match
      index += match.length - 1
      continue
    }
    if (char === '|' && !codeFenceLength) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell.trim())
  return cells
}

function isPipeTableSeparator(line: string) {
  const cells = splitPipeRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()))
}

function parsePipeTable(lines: string[], startIndex: number): { index: number, node: JSONContent } | null {
  if (startIndex + 1 >= lines.length || !isPipeTableSeparator(lines[startIndex + 1] ?? '')) return null
  const rows: string[][] = []
  let index = startIndex
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim() || !line.includes('|')) break
    rows.push(splitPipeRow(line))
    index += 1
  }
  if (rows.length < 2) return null

  const [header = [], , ...bodyRows] = rows
  const tableRows: JSONContent[] = [
    {
      type: 'tableRow',
      content: header.map((cell) => tableHeader(paragraphContent(parseInline(cell)))),
    },
    ...bodyRows.map((row) => ({
      type: 'tableRow',
      content: row.map((cell) => tableCell(paragraphContent(parseInline(cell)))),
    })),
  ]
  return { index, node: { type: 'table', content: tableRows } }
}

function tableCell(...content: JSONContent[]): JSONContent {
  return { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content }
}

function tableHeader(...content: JSONContent[]): JSONContent {
  return { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content }
}

type ListType = 'bulletList' | 'orderedList' | 'taskList'

type ListLine = {
  checked?: boolean
  indent: number
  orderNumber?: number
  text: string
  type: ListType
}

function parseListLine(line: string): ListLine | null {
  const task = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/u.exec(line)
  if (task) {
    return {
      checked: task[2]?.toLowerCase() === 'x',
      indent: task[1]?.length ?? 0,
      text: task[3] ?? '',
      type: 'taskList',
    }
  }

  const unordered = /^(\s*)[-*]\s+(.+)$/u.exec(line)
  if (unordered) return { indent: unordered[1]?.length ?? 0, text: unordered[2] ?? '', type: 'bulletList' }

  const ordered = /^(\s*)(\d+)\.\s+(.+)$/u.exec(line)
  if (ordered) return { indent: ordered[1]?.length ?? 0, orderNumber: Number(ordered[2] ?? 1), text: ordered[3] ?? '', type: 'orderedList' }

  return null
}

function parseListBlocks(lines: string[], startIndex: number, baseIndent: number): { index: number, nodes: JSONContent[] } {
  const nodes: JSONContent[] = []
  let index = startIndex

  while (index < lines.length) {
    const firstLine = parseListLine(lines[index] ?? '')
    if (!firstLine || firstLine.indent !== baseIndent) break

    const listType = firstLine.type
    const items: JSONContent[] = []

    while (index < lines.length) {
      const currentLine = parseListLine(lines[index] ?? '')
      if (!currentLine || currentLine.indent !== baseIndent || currentLine.type !== listType) break

      const content: JSONContent[] = [paragraph(currentLine.text)]
      index += 1

      while (index < lines.length) {
        const next = lines[index] ?? ''
        if (!next.trim()) break

        const nextListLine = parseListLine(next)
        if (nextListLine) {
          if (nextListLine.indent <= baseIndent) break
          const nested = parseListBlocks(lines, index, nextListLine.indent)
          content.push(...nested.nodes)
          index = nested.index
          continue
        }

        const continuationIndent = next.match(/^\s*/u)?.[0].length ?? 0
        if (continuationIndent <= baseIndent) break
        content.push(paragraph(next.trim()))
        index += 1
      }

      items.push(listType === 'taskList'
        ? { type: 'taskItem', attrs: { checked: currentLine.checked ?? false }, content }
        : { type: 'listItem', content })
    }

    const attrs = listType === 'orderedList' && firstLine.orderNumber && firstLine.orderNumber !== 1
      ? { start: firstLine.orderNumber }
      : undefined
    nodes.push({ type: listType, ...(attrs ? { attrs } : {}), content: items })
  }

  return { index, nodes }
}

function parseFrontmatter(markdown: string) {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) return { body: markdown, metadata: {} }
  const end = trimmed.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length + 1)
  if (end < 0) return { body: markdown, metadata: {} }
  const frontmatter = trimmed.slice(FRONTMATTER_BOUNDARY.length + 1, end)
  const metadata: MyBookMarkdownMetadata = {}
  for (const line of frontmatter.split('\n')) {
    const match = /^document_id:\s*(.+?)\s*$/u.exec(line)
    if (!match) continue
    const raw = match[1] ?? ''
    let value = raw
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'string') value = parsed
    } catch {
      value = raw.replace(/^['"]|['"]$/gu, '')
    }
    if (isValidPortableDocumentId(value)) metadata.documentId = value.trim()
  }
  return { body: trimmed.slice(end + FRONTMATTER_BOUNDARY.length + 2).trimStart(), metadata }
}

export function myBookMarkdownToDocument(markdown: string): JSONContent {
  return parseMyBookMarkdown(markdown).document
}

export function parseMyBookMarkdown(markdown: string): MyBookMarkdownParseResult {
  const parsedFrontmatter = parseFrontmatter(markdown)
  const lines = parsedFrontmatter.body.replace(/\r\n/g, '\n').split('\n')
  const content: JSONContent[] = []
  let paragraphLines: string[] = []

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    content.push(paragraph(paragraphLines))
    paragraphLines = []
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex] ?? ''
    const line = rawLine
    const codeBlock = /^(`{3,})([^\s`]*)\s*$/u.exec(line.trim())
    if (codeBlock) {
      flushParagraph()
      const fence = codeBlock[1] ?? '```'
      const language = codeBlock[2] ?? ''
      const codeLines: string[] = []
      lineIndex += 1
      while (lineIndex < lines.length) {
        const next = lines[lineIndex] ?? ''
        if (next.trim() === fence) break
        codeLines.push(next)
        lineIndex += 1
      }
      content.push({
        type: 'codeBlock',
        ...(language ? { attrs: { language } } : {}),
        content: codeLines.length ? [{ type: 'text', text: codeLines.join('\n') }] : [],
      })
      continue
    }
    const blockKind = customBlockKind(line)
    if (blockKind === 'table') {
      flushParagraph()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      const table = collected.closed ? parseStructuredTable(collected.lines.slice(1, -1)) : null
      content.push(table ?? rawParagraph(collected.lines))
      continue
    }
    if (blockKind === 'database') {
      flushParagraph()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      const database = collected.closed ? parseStructuredDatabase(collected.lines.slice(1, -1)) : null
      content.push(database ?? rawParagraph(collected.lines))
      continue
    }
    if (blockKind === 'toc') {
      flushParagraph()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      const body = collected.lines.slice(1, -1)
      const toc = collected.closed && body.every((item) => !item.trim()) ? { type: 'tableOfContents' } : null
      content.push(toc ?? rawParagraph(collected.lines))
      continue
    }
    if (blockKind === 'document-link') {
      flushParagraph()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      const documentLink = collected.closed ? parseStructuredDocumentLink(collected.lines.slice(1, -1)) : null
      content.push(documentLink ?? rawParagraph(collected.lines))
      continue
    }
    if (blockKind === 'file') {
      flushParagraph()
      const opener = line.trim()
      const file = /^:::file\s+name=("([^"]*)"|'([^']*)'|[^\s]+)(?:\s+mime=("([^"]*)"|'([^']*)'|[^\s]+))?(?:\s+size=(\d+))?\s*$/u.exec(opener)
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      if (!file || !collected.closed) {
        content.push(rawParagraph(collected.lines))
        continue
      }
      const rawName = file[2] ?? file[3] ?? file[1] ?? 'Attachment'
      const rawMime = file[5] ?? file[6] ?? file[4] ?? ''
      const srcLines = collected.lines.slice(1, -1)
      content.push({
        type: 'fileAttachment',
        attrs: {
          name: readAttributeValue(rawName) ?? 'Attachment',
          mimeType: readAttributeValue(rawMime) ?? '',
          size: Number(file[7] ?? 0),
          src: srcLines.map((srcLine) => srcLine.trim()).join(''),
        },
      })
      continue
    }
    if (blockKind === 'callout' || blockKind === 'toggle') {
      flushParagraph()
      const opener = line.trim()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      if (blockKind === 'callout') {
        const callout = /^:::callout(?:\s+type="([^"]+)")?\s*$/u.exec(opener)
        if (!callout || !collected.closed) {
          content.push(rawParagraph(collected.lines))
          continue
        }
        const parsed = myBookMarkdownToDocument(collected.lines.slice(1, -1).join('\n'))
        content.push({
          type: 'callout',
          attrs: { kind: callout[1] ?? 'info' },
          content: parsed.content?.length ? parsed.content : [{ type: 'paragraph' }],
        })
        continue
      }

      const toggle = /^:::toggle(?:\s+title=("([^"]*)"|'([^']*)'|[^\s]+))?(?:\s+open=(\S+))?\s*$/iu.exec(opener)
      if (!toggle || !collected.closed) {
        content.push(rawParagraph(collected.lines))
        continue
      }
      const parsed = myBookMarkdownToDocument(collected.lines.slice(1, -1).join('\n'))
        const rawTitle = toggle[2] ?? toggle[3] ?? toggle[1] ?? 'Toggle'
        content.push({
          type: 'toggleBlock',
          attrs: { title: readAttributeValue(rawTitle) ?? 'Toggle', open: parseToggleOpen(toggle[4]) },
          content: parsed.content?.length ? parsed.content : [{ type: 'paragraph' }],
        })
        continue
    }
    if (blockKind === 'unknown') {
      flushParagraph()
      const collected = collectCustomBlock(lines, lineIndex)
      lineIndex = collected.index - 1
      content.push(rawParagraph(collected.lines))
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      continue
    }
    const image = /^!\[([^\]]*)\]\((.+)\)$/u.exec(line.trim())
    if (image) {
      flushParagraph()
      content.push({ type: 'imageBlock', attrs: { alt: image[1]?.replace(/\\(\[|\])/g, '$1') ?? '', src: image[2] ?? '' } })
      continue
    }
    if (/^>\s?/u.test(line)) {
      flushParagraph()
      const quoteLines = [line.replace(/^>\s?/u, '')]
      while (lineIndex + 1 < lines.length && /^>\s?/u.test(lines[lineIndex + 1] ?? '')) {
        lineIndex += 1
        quoteLines.push((lines[lineIndex] ?? '').replace(/^>\s?/u, ''))
      }
      const parsed = myBookMarkdownToDocument(quoteLines.join('\n'))
      content.push({ type: 'blockquote', content: parsed.content?.length ? parsed.content : [paragraph('')] })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line)
    if (heading) {
      flushParagraph()
      const marker = heading[1] ?? '#'
      const text = heading[2] ?? ''
      content.push({ type: 'heading', attrs: { level: Math.min(marker.length, 3) }, content: parseInline(text) })
      continue
    }
    const pipeTable = parsePipeTable(lines, lineIndex)
    if (pipeTable) {
      flushParagraph()
      content.push(pipeTable.node)
      lineIndex = pipeTable.index - 1
      continue
    }
    const listLine = parseListLine(line)
    if (listLine && listLine.indent === 0) {
      flushParagraph()
      const parsed = parseListBlocks(lines, lineIndex, 0)
      content.push(...parsed.nodes)
      lineIndex = parsed.index - 1
      continue
    }
    if (line === '---' || line === '***') {
      flushParagraph()
      content.push({ type: 'horizontalRule' })
      continue
    }
    paragraphLines.push(line)
  }
  flushParagraph()
  return {
    document: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] },
    metadata: parsedFrontmatter.metadata,
  }
}

export function downloadMyBookMarkdown(markdown: string, title: string) {
  const safeName = (title.trim() || 'Untitled document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}.mybook.md`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
