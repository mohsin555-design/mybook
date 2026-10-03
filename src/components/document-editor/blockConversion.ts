import type { Editor } from '@tiptap/core'
import { Selection, TextSelection } from '@tiptap/pm/state'
import type { BlockTarget } from './EditorBlockControls'

export const FORMAT_COMMAND_IDS = new Set([
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'bullet',
  'numbered',
  'task',
  'quote',
  'code-block',
])

export function isFormatCommand(commandId: string): boolean {
  return FORMAT_COMMAND_IDS.has(commandId)
}

/**
 * Safely resolves a text selection within a block node, avoiding invalid inline endpoint errors.
 */
export function safeSelectionForBlock(editor: Editor, pos: number): Selection {
  const doc = editor.state.doc
  const node = doc.nodeAt(pos)
  if (!node) {
    return TextSelection.near(doc.resolve(Math.min(pos, doc.content.size)))
  }

  if (node.isTextblock) {
    return TextSelection.create(doc, Math.min(pos + 1, doc.content.size))
  }

  // If node is taskItem or listItem, find inner textblock
  let innerPos: number | null = null
  node.descendants((child, childPos) => {
    if (innerPos !== null) return false
    if (child.isTextblock) {
      innerPos = pos + 1 + childPos + 1
      return false
    }
  })

  if (innerPos !== null) {
    return TextSelection.create(doc, Math.min(innerPos, doc.content.size))
  }

  return TextSelection.near(doc.resolve(Math.min(pos + 1, doc.content.size)))
}

/**
 * Converts selected blocks or the targeted block to another block type.
 * Works uniformly for single blocks and multiple selected blocks/items (e.g. checklist -> bullet list).
 */
export function convertSelectedBlocks(
  editor: Editor,
  commandId: string,
  blockTarget?: BlockTarget | null,
): boolean {
  const { state } = editor
  const { selection } = state

  // If selection is collapsed/empty but a blockTarget is provided, position selection inside target
  if (selection.empty && blockTarget) {
    const sel = safeSelectionForBlock(editor, blockTarget.pos)
    editor.view.dispatch(editor.state.tr.setSelection(sel))
  }

  // Lift any list items out of their lists before applying non-matching list or textblock types
  const liftAllFromLists = () => {
    let changed = false
    let depthGuard = 0
    while (
      (editor.can().liftListItem('taskItem') || editor.can().liftListItem('listItem')) &&
      depthGuard < 20
    ) {
      if (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
        changed = true
      } else if (editor.can().liftListItem('listItem')) {
        editor.commands.liftListItem('listItem')
        changed = true
      }
      depthGuard += 1
    }
    return changed
  }

  switch (commandId) {
    case 'bullet': {
      // If inside taskList, lift first so items become paragraphs, then wrap in bulletList
      while (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
      }
      // If inside orderedList, lift first so items become paragraphs, then wrap in bulletList
      if (editor.isActive('orderedList')) {
        while (editor.can().liftListItem('listItem')) {
          editor.commands.liftListItem('listItem')
        }
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('bulletList').run()
    }

    case 'numbered': {
      // If inside taskList, lift first
      while (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
      }
      // If inside bulletList, lift first
      if (editor.isActive('bulletList')) {
        while (editor.can().liftListItem('listItem')) {
          editor.commands.liftListItem('listItem')
        }
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('orderedList').run()
    }

    case 'task': {
      // If inside bulletList or orderedList, lift first
      while (editor.can().liftListItem('listItem')) {
        editor.commands.liftListItem('listItem')
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('taskList').run()
    }

    case 'paragraph': {
      liftAllFromLists()
      return editor.chain().focus().setParagraph().run()
    }

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4': {
      liftAllFromLists()
      const level = Number(commandId.replace('h', '')) as 1 | 2 | 3 | 4
      return editor.chain().focus().setHeading({ level }).run()
    }

    case 'quote': {
      liftAllFromLists()
      return editor.chain().focus().setBlockquote().run()
    }

    case 'code-block': {
      liftAllFromLists()
      return editor.chain().focus().setCodeBlock().run()
    }

    default:
      return false
  }
}
