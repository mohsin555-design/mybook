// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { filterSlashCommands, groupSlashCommands, runSlashCommand, slashCommands } from './slashCommands'

describe('slashCommands', () => {
  it('includes Video command under Media category', () => {
    const videoCmd = slashCommands.find((c) => c.id === 'video')
    expect(videoCmd).toBeDefined()
    expect(videoCmd?.category).toBe('Media')
    expect(videoCmd?.title).toBe('Video')

    const groups = groupSlashCommands(slashCommands)
    const mediaGroup = groups.find((g) => g.category === 'Media')
    expect(mediaGroup?.commands.some((c) => c.id === 'video')).toBe(true)
    expect(mediaGroup?.commands.some((c) => c.id === 'audio')).toBe(true)
  })

  it('includes Audio command under Media category', () => {
    const audioCmd = slashCommands.find((c) => c.id === 'audio')
    expect(audioCmd).toBeDefined()
    expect(audioCmd?.category).toBe('Media')
    expect(audioCmd?.title).toBe('Audio')
  })

  it('filters video command on query "video" or "youtube"', () => {
    const results = filterSlashCommands('video')
    expect(results.some((c) => c.id === 'video')).toBe(true)

    const youtubeResults = filterSlashCommands('youtube')
    expect(youtubeResults.some((c) => c.id === 'video')).toBe(true)
  })

  it('filters audio command on query "audio", "music", or "sound"', () => {
    const results = filterSlashCommands('audio')
    expect(results.some((c) => c.id === 'audio')).toBe(true)

    const musicResults = filterSlashCommands('music')
    expect(musicResults.some((c) => c.id === 'audio')).toBe(true)
  })

  it('dispatches mybook:insert-video event on runSlashCommand with video', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    } as unknown as Editor

    runSlashCommand(mockEditor, 'video', { from: 0, to: 5 })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mybook:insert-video' })
    )
  })

  it('dispatches mybook:insert-audio event on runSlashCommand with audio', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    } as unknown as Editor

    runSlashCommand(mockEditor, 'audio', { from: 0, to: 5 })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mybook:insert-audio' })
    )
  })

  it('executes code-block slash command, sets code block, and moves selection inside', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [StarterKit],
      content: '<p>/code</p>',
    })
    editor.commands.setTextSelection(6)

    runSlashCommand(editor, 'code-block', { from: 1, to: 6 })

    expect(editor.isActive('codeBlock')).toBe(true)
    expect(editor.state.selection.from).toBe(1)
    editor.destroy()
    element.remove()
  })
})
