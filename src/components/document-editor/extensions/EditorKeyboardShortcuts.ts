import { Extension } from '@tiptap/core'

export const EditorKeyboardShortcuts = Extension.create({
  name: 'editorKeyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      // Formatting marks
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-B': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-I': () => this.editor.commands.toggleItalic(),
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      'Mod-U': () => this.editor.commands.toggleUnderline(),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-X': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-s': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-S': () => this.editor.commands.toggleStrike(),
      'Mod-e': () => this.editor.commands.toggleCode(),
      'Mod-E': () => this.editor.commands.toggleCode(),

      // Headings 1 to 4
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-Alt-4': () => this.editor.commands.toggleHeading({ level: 4 }),
      'Mod-Shift-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Shift-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Shift-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-Shift-4': () => this.editor.commands.toggleHeading({ level: 4 }),

      // Paragraph / Normal text
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
      'Mod-Shift-0': () => this.editor.commands.setParagraph(),

      // Lists
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),

      // Blockquote
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
      'Mod-Shift-B': () => this.editor.commands.toggleBlockquote(),
      'Mod-Alt-5': () => this.editor.commands.toggleBlockquote(),

      // Code Block
      'Mod-Shift-c': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Shift-C': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Alt-C': () => this.editor.commands.toggleCodeBlock(),

      // Indent (Tab) & Outdent (Shift+Tab)
      Tab: () => {
        if (this.editor.can().sinkListItem('listItem')) {
          return this.editor.commands.sinkListItem('listItem')
        }
        if (this.editor.can().sinkListItem('taskItem')) {
          return this.editor.commands.sinkListItem('taskItem')
        }
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToNextCell()
        }
        if (this.editor.isActive('codeBlock')) {
          return this.editor.commands.insertContent('  ')
        }
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return true
        }
        return false
      },
      'Shift-Tab': () => {
        if (this.editor.can().liftListItem('listItem')) {
          return this.editor.commands.liftListItem('listItem')
        }
        if (this.editor.can().liftListItem('taskItem')) {
          return this.editor.commands.liftListItem('taskItem')
        }
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToPreviousCell()
        }
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return true
        }
        return false
      },
    }
  },
})
