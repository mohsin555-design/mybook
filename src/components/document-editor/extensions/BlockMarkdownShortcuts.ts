import { Extension, InputRule } from '@tiptap/core'

export const BlockMarkdownShortcuts = Extension.create({
  name: 'blockMarkdownShortcuts',

  addInputRules() {
    return [
      // Bullet list: "- " or "* " or "+ "
      new InputRule({
        find: /^\s*([-*+])\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .wrapInList('bulletList')
            .run()
        },
      }),

      // Numbered list: "1. "
      new InputRule({
        find: /^\s*(\d+)\.\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .wrapInList('orderedList')
            .run()
        },
      }),

      // To-do list: "[] " or "[ ] "
      new InputRule({
        find: /^\s*(\[ ?\])\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .wrapInList('taskList')
            .run()
        },
      }),

      // Heading 1: "# "
      new InputRule({
        find: /^#\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setHeading({ level: 1 })
            .run()
        },
      }),

      // Heading 2: "## "
      new InputRule({
        find: /^##\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setHeading({ level: 2 })
            .run()
        },
      }),

      // Heading 3: "### "
      new InputRule({
        find: /^###\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setHeading({ level: 3 })
            .run()
        },
      }),

      // Heading 4: "#### "
      new InputRule({
        find: /^####\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setHeading({ level: 4 })
            .run()
        },
      }),

      // Blockquote: "> "
      new InputRule({
        find: /^\s*>\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setBlockquote()
            .run()
        },
      }),

      // Code block: "``` "
      new InputRule({
        find: /^```\s$/,
        handler: ({ chain, range }) => {
          chain()
            .deleteRange(range)
            .clearNodes()
            .setCodeBlock()
            .run()
        },
      }),
    ]
  },
})
