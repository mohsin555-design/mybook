import { describe, expect, it } from 'vitest'

import { filterSlashCommands, slashCommands } from './SlashCommandMenu'

describe('SlashCommandMenu database command', () => {
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

  it('shows Document link by title and aliases', () => {
    expect(slashCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'document-link',
        title: 'Document link',
        description: 'Link to another document',
      }),
    ]))
    expect(filterSlashCommands('document link').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('link to page').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('page link').map((command) => command.id)).toContain('document-link')
    expect(filterSlashCommands('internal link').map((command) => command.id)).toContain('document-link')
  })
})
