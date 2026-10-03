import { Extension, InputRule } from '@tiptap/core'
import { convertSelectedBlocks } from '../blockConversion'

export const BlockMarkdownShortcuts = Extension.create({
  name: 'blockMarkdownShortcuts',

  addInputRules() {
    return [
      // Bullet list: "- " or "* " or "+ "
      new InputRule({
        find: /^\s*([-*+])\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'bullet')
        },
      }),

      // Numbered list: "1. "
      new InputRule({
        find: /^\s*(\d+)\.\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'numbered')
        },
      }),

      // To-do list: "[] " or "[ ] "
      new InputRule({
        find: /^\s*(\[ ?\])\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'task')
        },
      }),

      // Heading 1: "# "
      new InputRule({
        find: /^#\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'h1')
        },
      }),

      // Heading 2: "## "
      new InputRule({
        find: /^##\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'h2')
        },
      }),

      // Heading 3: "### "
      new InputRule({
        find: /^###\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'h3')
        },
      }),

      // Heading 4: "#### "
      new InputRule({
        find: /^####\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'h4')
        },
      }),

      // Blockquote: "> "
      new InputRule({
        find: /^\s*>\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'quote')
        },
      }),

      // Code block: "``` "
      new InputRule({
        find: /^```\s$/,
        handler: ({ range }) => {
          this.editor.chain().deleteRange(range).run()
          convertSelectedBlocks(this.editor, 'code-block')
        },
      }),
    ]
  },
})
