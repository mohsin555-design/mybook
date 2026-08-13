import type { JSONContent } from '@tiptap/core'
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'

function textRun(node: JSONContent): ParagraphChild {
  const marks = node.marks ?? []
  const options = {
    text: node.text ?? '',
    bold: marks.some((mark) => mark.type === 'bold'),
    italics: marks.some((mark) => mark.type === 'italic'),
    strike: marks.some((mark) => mark.type === 'strike'),
    underline: marks.some((mark) => mark.type === 'underline') ? {} : undefined,
  }
  const link = marks.find((mark) => mark.type === 'link')
  const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null
  return href
    ? new ExternalHyperlink({ link: href, children: [new TextRun({ ...options, color: '2563EB', underline: {} })] })
    : new TextRun(options)
}

function inlineChildren(node: JSONContent): ParagraphChild[] {
  const children: ParagraphChild[] = []
  for (const child of node.content ?? []) {
    if (child.type === 'text') children.push(textRun(child))
    else if (child.type === 'hardBreak') children.push(new TextRun({ text: '', break: 1 }))
    else children.push(...inlineChildren(child))
  }
  return children.length ? children : [new TextRun('')]
}

function listParagraphs(node: JSONContent, ordered: boolean, level = 0): Paragraph[] {
  const paragraphs: Paragraph[] = []
  for (const item of node.content ?? []) {
    const firstBlock = item.content?.find((child) => child.type === 'paragraph') ?? item
    paragraphs.push(new Paragraph({
      children: inlineChildren(firstBlock),
      ...(ordered
        ? { numbering: { reference: 'mybook-numbering', level: Math.min(level, 2) } }
        : { bullet: { level: Math.min(level, 2) } }),
    }))
    for (const nested of item.content ?? []) {
      if (nested.type === 'bulletList') paragraphs.push(...listParagraphs(nested, false, level + 1))
      if (nested.type === 'orderedList') paragraphs.push(...listParagraphs(nested, true, level + 1))
    }
  }
  return paragraphs
}

function tableFromNode(node: JSONContent): Table {
  const rows = (node.content ?? []).map((row) => new TableRow({
    children: (row.content ?? []).map((cell) => new TableCell({
      children: (cell.content ?? []).map((block) => new Paragraph({ children: inlineChildren(block) })),
    })),
  }))
  return new Table({ rows: rows.length ? rows : [new TableRow({ children: [new TableCell({ children: [new Paragraph('')] })] })], width: { size: 100, type: WidthType.PERCENTAGE } })
}

function blocks(node: JSONContent): Array<Paragraph | Table> {
  const output: Array<Paragraph | Table> = []
  for (const child of node.content ?? []) {
    if (child.type === 'paragraph') output.push(new Paragraph({ children: inlineChildren(child) }))
    else if (child.type === 'heading') {
      const levels = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }
      const level = Number(child.attrs?.level) as 1 | 2 | 3
      output.push(new Paragraph({ heading: levels[level] ?? HeadingLevel.HEADING_1, children: inlineChildren(child) }))
    } else if (child.type === 'bulletList') output.push(...listParagraphs(child, false))
    else if (child.type === 'orderedList') output.push(...listParagraphs(child, true))
    else if (child.type === 'taskList') output.push(...listParagraphs(child, false))
    else if (child.type === 'blockquote') output.push(new Paragraph({ children: inlineChildren(child), indent: { left: 540 } }))
    else if (child.type === 'horizontalRule') output.push(new Paragraph({ thematicBreak: true }))
    else if (child.type === 'table') output.push(tableFromNode(child))
    else if (child.type === 'fileAttachment') {
      const name = typeof child.attrs?.name === 'string' ? child.attrs.name : 'Attachment'
      output.push(new Paragraph({ children: [new TextRun({ text: `Attachment: ${name}`, bold: true })] }))
    }
    else if (child.content?.length) output.push(...blocks(child))
  }
  return output
}

export function createDocxDocument(title: string, json: JSONContent): Document {
  const children = blocks(json)
  return new Document({
    title: title.trim() || 'Untitled document',
    numbering: {
      config: [{
        reference: 'mybook-numbering',
        levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } } })),
      }],
    },
    sections: [{ children }],
  })
}

export async function createDocxBlob(title: string, json: JSONContent): Promise<Blob> {
  return Packer.toBlob(createDocxDocument(title, json))
}

export function downloadDocx(blob: Blob, title: string) {
  const safeName = (title.trim() || 'Untitled document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}.docx`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
