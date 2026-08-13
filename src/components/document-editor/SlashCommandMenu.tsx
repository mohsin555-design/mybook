import type { Editor } from '@tiptap/react'

import { calloutNode } from './extensions/Callout'
import { toggleBlockNode } from './extensions/ToggleBlock'

export interface SlashCommand {
  id: string
  title: string
  description: string
  keywords: string[]
}

export interface SlashMenuState {
  query: string
  range: { from: number; to: number }
  rect: DOMRect
}

export const slashCommands: SlashCommand[] = [
  { id: 'paragraph', title: 'Text', description: 'Start with plain text', keywords: ['paragraph', 'text'] },
  { id: 'h1', title: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'] },
  { id: 'h2', title: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'] },
  { id: 'h3', title: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'] },
  { id: 'bullet', title: 'Bulleted list', description: 'Create a simple list', keywords: ['bullet', 'list', 'ul'] },
  { id: 'numbered', title: 'Numbered list', description: 'Create an ordered list', keywords: ['numbered', 'ordered', 'list', 'ol'] },
  { id: 'task', title: 'Checklist', description: 'Track tasks and todos', keywords: ['task', 'check', 'todo', 'checklist'] },
  { id: 'callout', title: 'Callout', description: 'Add a highlighted note', keywords: ['callout', 'note', 'info', 'warning'] },
  { id: 'toggle', title: 'Toggle', description: 'Hide details under a title', keywords: ['toggle', 'details', 'collapse'] },
  { id: 'image', title: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'media'] },
  { id: 'file', title: 'File attachment', description: 'Attach a file block', keywords: ['file', 'attachment', 'upload', 'pdf', 'doc'] },
  { id: 'quote', title: 'Blockquote', description: 'Highlight quoted text', keywords: ['quote', 'blockquote'] },
  { id: 'code-block', title: 'Code block', description: 'Insert multiline code', keywords: ['code', 'pre', 'block'] },
  { id: 'table', title: 'Table', description: 'Insert a 3 x 3 table', keywords: ['table', 'grid'] },
  { id: 'hr', title: 'Divider', description: 'Separate sections', keywords: ['divider', 'rule', 'hr', 'line'] },
]

export function filterSlashCommands(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return slashCommands
  return slashCommands.filter((command) => {
    const haystack = [command.title, command.description, ...command.keywords].join(' ').toLowerCase()
    return haystack.includes(normalized)
  })
}

export function runSlashCommand(editor: Editor, commandId: string, range: SlashMenuState['range']) {
  const chain = editor.chain().focus().deleteRange(range)
  if (commandId === 'paragraph') chain.setParagraph().run()
  else if (commandId === 'h1') chain.setHeading({ level: 1 }).run()
  else if (commandId === 'h2') chain.setHeading({ level: 2 }).run()
  else if (commandId === 'h3') chain.setHeading({ level: 3 }).run()
  else if (commandId === 'bullet') chain.toggleBulletList().run()
  else if (commandId === 'numbered') chain.toggleOrderedList().run()
  else if (commandId === 'task') chain.toggleTaskList().run()
  else if (commandId === 'callout') chain.insertContent(calloutNode()).run()
  else if (commandId === 'toggle') chain.insertContent(toggleBlockNode()).run()
  else if (commandId === 'image') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-image'))
  }
  else if (commandId === 'file') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-file'))
  }
  else if (commandId === 'quote') chain.toggleBlockquote().run()
  else if (commandId === 'code-block') chain.toggleCodeBlock().run()
  else if (commandId === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  else if (commandId === 'hr') chain.setHorizontalRule().run()
}

interface SlashCommandMenuProps {
  menu: SlashMenuState
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onRun: (command: SlashCommand) => void
}

export function SlashCommandMenu({ menu, selectedIndex, onSelectIndex, onRun }: SlashCommandMenuProps) {
  const commands = filterSlashCommands(menu.query)
  const top = Math.min(menu.rect.bottom + 8, window.innerHeight - 340)
  const left = Math.min(menu.rect.left, window.innerWidth - 320)

  return (
    <div
      className="fixed z-50 w-[min(20rem,calc(100vw-1rem))] rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
      style={{ top: Math.max(8, top), left: Math.max(8, left) }}
      role="listbox"
      aria-label="Slash command menu"
    >
      {commands.length ? commands.map((command, index) => {
        const isSelected = index === selectedIndex
        return (
          <button
            key={command.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => onSelectIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onRun(command)
            }}
            className={`flex w-full flex-col rounded-[7px] px-3 py-2 text-left ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-[var(--app-subtle)]'}`}
          >
            <span className="text-sm font-semibold">{command.title}</span>
            <span className={`text-xs ${isSelected ? 'text-accent-foreground/80' : 'text-muted'}`}>{command.description}</span>
          </button>
        )
      }) : (
        <p className="px-3 py-2 text-sm text-muted">No matching blocks</p>
      )}
    </div>
  )
}
