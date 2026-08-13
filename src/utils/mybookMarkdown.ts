import type { JSONContent } from '@tiptap/core'

const FRONTMATTER_BOUNDARY = '---'

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, '\\`')
}

function readJsonAttribute(value: unknown) {
  return JSON.stringify(String(value ?? ''))
}

function inlineMarkdown(node: JSONContent): string {
  if (node.type === 'text') {
    let text = escapeText(node.text ?? '')
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = `**${text}**`
      if (mark.type === 'italic') text = `_${text}_`
      if (mark.type === 'strike') text = `~~${text}~~`
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') text = `[${text}](${mark.attrs.href})`
    }
    return text
  }
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(inlineMarkdown).join('')
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
    const body = (node.content ?? []).map((child) => blockMarkdown(child, depth)).filter(Boolean).join('\n\n')
    return [`:::toggle title=${JSON.stringify(title)}`, body, ':::'].filter(Boolean).join('\n')
  }
  if (node.type === 'imageBlock' && typeof node.attrs?.src === 'string') {
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.replace(/\]/g, '\\]') : ''
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
  if (node.type === 'horizontalRule') return '---'
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return (node.content ?? []).map((item, index) => {
      const marker = node.type === 'orderedList' ? `${index + 1}.` : '-'
      const text = (item.content ?? []).map((child) => blockMarkdown(child, depth + 1)).join('\n').replace(/\n/g, `\n${'  '.repeat(depth + 1)}`)
      return `${'  '.repeat(depth)}${marker} ${text}`
    }).join('\n')
  }
  if (node.type === 'table') {
    const rows = node.content ?? []
    const cells = rows.map((row) => (row.content ?? []).map((cell) => (cell.content ?? []).map((child) => blockMarkdown(child)).join(' ').replace(/\|/g, '\\|')))
    if (!cells.length) return ''
    const header = cells[0] ?? []
    const separator = header.map(() => '---')
    return [header, separator, ...cells.slice(1)].map((row = []) => `| ${row.join(' | ')} |`).join('\n')
  }
  return (node.content ?? []).map((child) => blockMarkdown(child, depth)).join('\n\n')
}

export function documentToMyBookMarkdown(title: string, json: JSONContent) {
  const safeTitle = title.trim() || 'Untitled document'
  const body = (json.content ?? []).map((node) => blockMarkdown(node)).filter(Boolean).join('\n\n')
  return [
    FRONTMATTER_BOUNDARY,
    'mybook_version: 1',
    'type: document',
    `title: ${JSON.stringify(safeTitle)}`,
    FRONTMATTER_BOUNDARY,
    '',
    body,
  ].join('\n').trimEnd() + '\n'
}

function parseInline(text: string): JSONContent[] {
  const nodes: JSONContent[] = []
  let rest = text
  const token = /(\*\*([^*]+)\*\*|_([^_]+)_|~~([^~]+)~~|\[([^\]]+)\]\(([^)]+)\))/u
  while (rest) {
    const match = token.exec(rest)
    if (!match?.index && match?.index !== 0) {
      if (rest) nodes.push({ type: 'text', text: rest })
      break
    }
    if (match.index > 0) nodes.push({ type: 'text', text: rest.slice(0, match.index) })
    if (match[2]) nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
    else if (match[3]) nodes.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] })
    else if (match[4]) nodes.push({ type: 'text', text: match[4], marks: [{ type: 'strike' }] })
    else if (match[5] && match[6]) nodes.push({ type: 'text', text: match[5], marks: [{ type: 'link', attrs: { href: match[6] } }] })
    rest = rest.slice(match.index + match[0].length)
  }
  return nodes
}

function paragraph(text: string): JSONContent {
  const content = parseInline(text.trim())
  return { type: 'paragraph', ...(content.length ? { content } : {}) }
}

function stripFrontmatter(markdown: string) {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) return markdown
  const end = trimmed.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length + 1)
  return end >= 0 ? trimmed.slice(end + FRONTMATTER_BOUNDARY.length + 2).trimStart() : markdown
}

export function myBookMarkdownToDocument(markdown: string): JSONContent {
  const lines = stripFrontmatter(markdown).replace(/\r\n/g, '\n').split('\n')
  const content: JSONContent[] = []
  let paragraphLines: string[] = []
  let listItems: JSONContent[] = []
  let listType: 'bulletList' | 'orderedList' | null = null

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    content.push(paragraph(paragraphLines.join(' ')))
    paragraphLines = []
  }
  const flushList = () => {
    if (!listType || !listItems.length) return
    content.push({ type: listType, content: listItems })
    listItems = []
    listType = null
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex] ?? ''
    const line = rawLine.trimEnd()
    const callout = /^:::callout(?:\s+type="([^"]+)")?/u.exec(line.trim())
    const toggle = /^:::toggle(?:\s+title=("([^"]*)"|'([^']*)'|[^\s]+))?/u.exec(line.trim())
    const file = /^:::file\s+name=("([^"]*)"|'([^']*)'|[^\s]+)(?:\s+mime=("([^"]*)"|'([^']*)'|[^\s]+))?(?:\s+size=(\d+))?/u.exec(line.trim())
    if (file) {
      flushParagraph()
      flushList()
      const srcLines: string[] = []
      lineIndex += 1
      while (lineIndex < lines.length) {
        const next = lines[lineIndex]
        if (next?.trim() === ':::') break
        if (next !== undefined) srcLines.push(next.trim())
        lineIndex += 1
      }
      const rawName = file[2] ?? file[3] ?? file[1] ?? 'Attachment'
      const rawMime = file[5] ?? file[6] ?? file[4] ?? ''
      content.push({
        type: 'fileAttachment',
        attrs: {
          name: rawName.replace(/^['"]|['"]$/g, ''),
          mimeType: rawMime.replace(/^['"]|['"]$/g, ''),
          size: Number(file[7] ?? 0),
          src: srcLines.join(''),
        },
      })
      continue
    }
    if (callout || toggle) {
      flushParagraph()
      flushList()
      const containerLines: string[] = []
      lineIndex += 1
      while (lineIndex < lines.length) {
        const next = lines[lineIndex]
        if (next?.trim() === ':::') break
        if (next !== undefined) containerLines.push(next)
        lineIndex += 1
      }
      const parsed = myBookMarkdownToDocument(containerLines.join('\n'))
      if (toggle) {
        const rawTitle = toggle[2] ?? toggle[3] ?? toggle[1] ?? 'Toggle'
        content.push({
          type: 'toggleBlock',
          attrs: { title: rawTitle.replace(/^['"]|['"]$/g, ''), open: true },
          content: parsed.content?.length ? parsed.content : [{ type: 'paragraph' }],
        })
        continue
      }
      content.push({
        type: 'callout',
        attrs: { kind: callout?.[1] ?? 'info' },
        content: parsed.content?.length ? parsed.content : [{ type: 'paragraph' }],
      })
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    const image = /^!\[([^\]]*)\]\((.+)\)$/u.exec(line.trim())
    if (image) {
      flushParagraph()
      flushList()
      content.push({ type: 'imageBlock', attrs: { alt: image[1]?.replace(/\\\]/g, ']') ?? '', src: image[2] ?? '' } })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      const marker = heading[1] ?? '#'
      const text = heading[2] ?? ''
      content.push({ type: 'heading', attrs: { level: Math.min(marker.length, 3) }, content: parseInline(text) })
      continue
    }
    const unordered = /^[-*]\s+(.+)$/u.exec(line)
    const ordered = /^\d+\.\s+(.+)$/u.exec(line)
    if (unordered || ordered) {
      flushParagraph()
      const nextType = ordered ? 'orderedList' : 'bulletList'
      if (listType && listType !== nextType) flushList()
      listType = nextType
      listItems.push({ type: 'listItem', content: [paragraph((unordered?.[1] ?? ordered?.[1] ?? '').replace(/^\[[ x]\]\s+/iu, ''))] })
      continue
    }
    if (line === '---' || line === '***') {
      flushParagraph()
      flushList()
      content.push({ type: 'horizontalRule' })
      continue
    }
    flushList()
    paragraphLines.push(line.trim())
  }
  flushParagraph()
  flushList()
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
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
