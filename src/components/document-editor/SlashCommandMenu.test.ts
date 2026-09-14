// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { filterSlashCommands, getSlashCommandMatch, getSlashMenuState, groupSlashCommands, runSlashCommand, slashCommands } from './slashCommands'

let editor: Editor

afterEach(() => editor?.destroy())

describe('SlashCommandMenu grouping', () => {
  it('keeps commands in the shared section order with Markdown shortcuts', () => {
    expect(groupSlashCommands(slashCommands).map((group) => group.category)).toEqual([
      'Basic Blocks',
      'Lists',
      'Media',
      'Data',
      'Advanced',
    ])
    expect(groupSlashCommands(slashCommands)[0]?.commands.map((command) => command.id)).toEqual([
      'paragraph',
      'h1',
      'h2',
      'h3',
      'h4',
      'quote',
      'hr',
    ])
    expect(slashCommands.find((command) => command.id === 'h4')).toMatchObject({ title: 'Heading 4', shortcut: '####' })
    expect(slashCommands.find((command) => command.id === 'quote')).toMatchObject({ shortcut: '>' })
    expect(slashCommands.find((command) => command.id === 'bullet')).toMatchObject({ shortcut: '- or *' })
    expect(slashCommands.find((command) => command.id === 'document-link')).toMatchObject({ title: 'Link to Page', shortcut: '[[' })
    expect(slashCommands.find((command) => command.id === 'callout')?.shortcut).toBeUndefined()
  })
})

describe('SlashCommandMenu database command', () => {
  it('shows To-do list as the task block name and command label', () => {
    expect(slashCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'task',
        title: 'To-do list',
        description: 'Track tasks and todos',
      }),
    ]))
    expect(filterSlashCommands('todo').map((command) => command.id)).toContain('task')
  })

  it('opens from a heading and converts the current block through the selected command', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({
      element,
      extensions: [StarterKit],
      content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '/' }] }] },
    })
    editor.commands.setTextSelection(2)
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 0, right: 0, top: 0, bottom: 0 })

    const menu = getSlashMenuState(editor)

    expect(menu).toMatchObject({ query: '', range: { from: 1, to: 2 } })
    runSlashCommand(editor, 'paragraph', menu!.range)
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
  })

  it('shows Database as a slash command for typed rows and properties', () => {
    expect(slashCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'database',
        title: 'Database',
        description: 'Typed rows and properties',
      }),
    ]))
    expect(filterSlashCommands('database').map((command) => command.id)).toContain('database')
  })

  it('shows Table of contents by title and aliases', () => {
    expect(slashCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'toc',
        title: 'Table of contents',
        description: 'Show document headings',
      }),
    ]))
    expect(filterSlashCommands('toc').map((command) => command.id)).toContain('toc')
    expect(filterSlashCommands('table').map((command) => command.id)).toContain('toc')
    expect(filterSlashCommands('contents').map((command) => command.id)).toContain('toc')
  })

  it('shows Link to Page by title and aliases', () => {
    expect(slashCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'document-link',
        title: 'Link to Page',
        description: 'Link to another workspace item',
      }),
    ]))
    expect(filterSlashCommands('document link').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('link to page').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('page link').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('internal link').map((command) => command.id)).toContain('document-link')
  })

  it('matches slash command ranges without leaving repeated slash fragments', () => {
    expect(getSlashCommandMatch('/')).toEqual({ query: '', fromOffset: 0 })
    expect(getSlashCommandMatch('/da')).toEqual({ query: 'da', fromOffset: 0 })
    expect(getSlashCommandMatch('//da')).toEqual({ query: 'da', fromOffset: 0 })
    expect(getSlashCommandMatch('hello /da')).toEqual({ query: 'da', fromOffset: 6 })
    expect(getSlashCommandMatch('hello/da')).toBeNull()
  })
})
