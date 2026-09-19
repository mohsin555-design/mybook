import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

import { calloutNode } from './extensions/Callout'
import { databaseBlockNode } from './extensions/DatabaseBlock'
import { tableOfContentsNode } from './extensions/TableOfContents'
import { toggleBlockNode } from './extensions/ToggleBlock'

export interface SlashCommand {
  id: string
  title: string
  description: string
  keywords: string[]
  category: 'Basic Blocks' | 'Lists' | 'Media' | 'Data' | 'Advanced'
  shortcut?: string
  hidden?: boolean
}

export interface SlashMenuState {
  query: string
  range: { from: number; to: number }
  rect: DOMRect
}

export function commandMenuTop(rect: DOMRect, menuHeight: number, gap = 8, minTop = gap) {
  const below = rect.bottom + gap
  const hasRoomBelow = below + menuHeight <= window.innerHeight - gap
  if (hasRoomBelow) return below
  const above = rect.top - menuHeight - gap
  if (above >= minTop) return above
  return Math.max(minTop, window.innerHeight - menuHeight - gap)
}

export function getSlashCommandMatch(textBeforeCursor: string) {
  const match = /(?:^|\s)(\/+[a-zA-Z0-9-]*)$/.exec(textBeforeCursor)
  if (!match) return null
  const token = match[1] ?? ''
  const fromOffset = textBeforeCursor.length - token.length
  return {
    query: token.replace(/^\/+/u, ''),
    fromOffset,
  }
}

export function getSlashMenuState(editor: Pick<Editor, 'state' | 'view'>): SlashMenuState | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const { $from } = selection
  if (!['paragraph', 'heading'].includes($from.parent.type.name)) return null
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')
  const match = getSlashCommandMatch(textBeforeCursor)
  if (!match) return null
  const from = $from.start() + match.fromOffset
  const to = $from.pos
  const coords = editor.view.coordsAtPos(to)
  return { query: match.query, range: { from, to }, rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top) }
}

export const ENABLE_DATABASE_BLOCK = false

export const allSlashCommands: SlashCommand[] = [
  { id: 'paragraph', title: 'Text', description: 'Start with plain text', keywords: ['paragraph', 'text'], category: 'Basic Blocks' },
  { id: 'h1', title: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'], category: 'Basic Blocks', shortcut: '#' },
  { id: 'h2', title: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'], category: 'Basic Blocks', shortcut: '##' },
  { id: 'h3', title: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'], category: 'Basic Blocks', shortcut: '###' },
  { id: 'h4', title: 'Heading 4', description: 'Smallest section heading', keywords: ['h4', 'heading'], category: 'Basic Blocks', shortcut: '####' },
  { id: 'quote', title: 'Quote', description: 'Highlight quoted text', keywords: ['quote', 'blockquote'], category: 'Basic Blocks', shortcut: '>' },
  { id: 'hr', title: 'Divider', description: 'Separate sections', keywords: ['divider', 'rule', 'hr', 'line'], category: 'Basic Blocks', shortcut: '---' },
  { id: 'bullet', title: 'Bulleted list', description: 'Create a simple list', keywords: ['bullet', 'list', 'ul'], category: 'Lists', shortcut: '- or *' },
  { id: 'numbered', title: 'Numbered list', description: 'Create an ordered list', keywords: ['numbered', 'ordered', 'list', 'ol'], category: 'Lists', shortcut: '1.' },
  { id: 'task', title: 'To-do list', description: 'Track tasks and todos', keywords: ['task', 'check', 'todo', 'todo list', 'checklist'], category: 'Lists', shortcut: '[]' },
  { id: 'toggle', title: 'Toggle', description: 'Hide details under a title', keywords: ['toggle', 'details', 'collapse'], category: 'Lists' },
  { id: 'image', title: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'media'], category: 'Media' },
  { id: 'file', title: 'File attachment', description: 'Attach a file block', keywords: ['file', 'attachment', 'upload', 'pdf', 'doc'], category: 'Media' },
  { id: 'document-link', title: 'Link to Page', description: 'Link to another workspace item', keywords: ['document link', 'link to page', 'page link', 'internal link', 'document', 'database', 'spreadsheet'], category: 'Media', shortcut: '[[' },
  { id: 'table', title: 'Basic Table', description: 'Insert a basic table', keywords: ['table', 'basic table', 'grid'], category: 'Data' },
  { id: 'database', title: 'Database', description: 'Typed rows and properties', keywords: ['database', 'data', 'properties', 'status'], category: 'Data', hidden: !ENABLE_DATABASE_BLOCK },
  { id: 'callout', title: 'Callout', description: 'Add a highlighted note', keywords: ['callout', 'note', 'info', 'warning'], category: 'Advanced' },
  { id: 'toc', title: 'Table of contents', description: 'Show document headings', keywords: ['toc', 'table of contents', 'contents', 'outline'], category: 'Advanced' },
  { id: 'code-block', title: 'Code block', description: 'Insert multiline code', keywords: ['code', 'pre', 'block'], category: 'Advanced', shortcut: '```' },
]

export const slashCommands: SlashCommand[] = allSlashCommands.filter((command) => !command.hidden)

export function groupSlashCommands(commands: SlashCommand[]) {
  const categoryOrder: SlashCommand['category'][] = ['Basic Blocks', 'Lists', 'Media', 'Data', 'Advanced']
  return categoryOrder
    .map((category) => ({ category, commands: commands.filter((command) => command.category === category) }))
    .filter((group) => group.commands.length > 0)
}

export function filterSlashCommands(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return slashCommands
  return slashCommands.filter((command) => {
    const haystack = [command.title, command.description, ...command.keywords].join(' ').toLowerCase()
    return haystack.includes(normalized)
  })
}

function insertQuoteBlock(editor: Editor, range: SlashMenuState['range']) {
  const insertAt = range.from
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({ type: 'blockquote', content: [{ type: 'paragraph' }] })
    .run()

  const quoteTextStart = Math.min(insertAt + 2, editor.state.doc.content.size)
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, quoteTextStart)).scrollIntoView())
}

export function runSlashCommand(editor: Editor, commandId: string, range: SlashMenuState['range']) {
  const chain = editor.chain().focus().deleteRange(range)
  if (commandId === 'paragraph') chain.setParagraph().run()
  else if (commandId === 'h1') chain.setHeading({ level: 1 }).run()
  else if (commandId === 'h2') chain.setHeading({ level: 2 }).run()
  else if (commandId === 'h3') chain.setHeading({ level: 3 }).run()
    else if (commandId === 'h4') chain.setHeading({ level: 4 }).run()
  else if (commandId === 'bullet') chain.toggleBulletList().run()
  else if (commandId === 'numbered') chain.toggleOrderedList().run()
  else if (commandId === 'task') chain.toggleTaskList().run()
  else if (commandId === 'callout') chain.insertContent(calloutNode()).run()
  else if (commandId === 'toggle') chain.insertContent(toggleBlockNode()).run()
  else if (commandId === 'toc') chain.insertContent([tableOfContentsNode(), { type: 'paragraph' }]).run()
  else if (commandId === 'database') chain.insertContent([databaseBlockNode(), { type: 'paragraph' }]).run()
  else if (commandId === 'document-link') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-document-link'))
  }
  else if (commandId === 'image') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-image'))
  }
  else if (commandId === 'file') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-file'))
  }
  else if (commandId === 'quote') insertQuoteBlock(editor, range)
  else if (commandId === 'code-block') chain.toggleCodeBlock().run()
  else if (commandId === 'table') chain.insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()
  else if (commandId === 'hr') chain.setHorizontalRule().insertContent({ type: 'paragraph' }).run()
}
